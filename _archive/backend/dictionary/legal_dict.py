"""
Legal Dictionary Lookup Module

Provides a high-performance dictionary lookup class for German→English
translation lookups. Designed for integration with app.py.

Features:
- LRU caching for frequent lookups
- Exact, prefix, and fuzzy matching
- Compound word decomposition
- Legal priority term boosting
- Query statistics tracking

Usage:
    from dictionary.legal_dict import LegalDictionary

    legal_dict = LegalDictionary()
    translations = legal_dict.get_translations("Kündigung")
"""

import json
import logging
import os
import re
import sqlite3
import threading
import time
from collections import OrderedDict
from typing import Dict, List, Optional, Tuple

# Configuration
DB_PATH = "./dictionary/dictionary.db"
CACHE_SIZE = int(os.environ.get("DICT_CACHE_SIZE", "5000"))
QUERY_TIMEOUT = 2.0  # seconds

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


class LegalDictionary:
    """
    German→English legal dictionary with caching and advanced lookup.

    Thread-safe, connection-pooled dictionary lookup with support for:
    - Exact word matching
    - Prefix matching (for inflected forms)
    - Legal priority term boosting
    - Compound word decomposition
    """

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._cache: OrderedDict[str, List[Dict]] = OrderedDict()
        self._cache_lock = threading.Lock()
        
        # Use thread-local storage for database connections (one per thread)
        self._local = threading.local()
        
        # Verify database exists
        if not os.path.exists(db_path):
            logger.warning(f"Dictionary database not found: {db_path}")
            logger.warning("Run: python dictionary/build_dictionary_db.py")
            self._db_exists = False
        else:
            self._db_exists = True
            logger.info(f"Dictionary loaded: {db_path}")

    def _get_connection(self) -> sqlite3.Connection:
        """Get thread-local database connection (connection per thread)."""
        if not hasattr(self._local, 'connection') or self._local.connection is None:
            self._local.connection = sqlite3.connect(
                self.db_path, 
                timeout=30,  # Increased timeout for concurrent access
                check_same_thread=False
            )
            self._local.connection.row_factory = sqlite3.Row
            # Enable WAL mode for better concurrent access
            self._local.connection.execute("PRAGMA journal_mode=WAL")
            # Set busy timeout to wait up to 30 seconds for locks
            self._local.connection.execute("PRAGMA busy_timeout=30000")
        return self._local.connection

    def _add_to_cache(self, key: str, value: List[Dict]):
        """Add item to LRU cache."""
        with self._cache_lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = value

            # Enforce cache size limit
            while len(self._cache) > CACHE_SIZE:
                self._cache.popitem(last=False)

    def _get_from_cache(self, key: str) -> Optional[List[Dict]]:
        """Get item from cache."""
        with self._cache_lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
        return None

    def normalize_word(self, word: str) -> str:
        """Normalize German word for lookup."""
        if not word:
            return ""

        word = word.lower().strip()

        # Remove articles and prefixes
        word = re.sub(r"^(der|die|das|den|dem|des|ein|eine)\s*", "", word)

        # Strip punctuation
        word = re.sub(r"^[^\w]+|[^\w]+$", "", word)

        return word

    def get_translations(self, german_word: str, limit: int = 5) -> List[Dict]:
        """
        Get English translations for a German word.

        Args:
            german_word: German word to translate
            limit: Maximum number of translations to return

        Returns:
            List of translation dicts with keys:
            - english: English translation
            - frequency: Confidence score
            - pos: Part of speech
            - source: 'legal_priority', 'dictionary', 'prefix', 'fuzzy'
        """
        if not self._db_exists:
            return self._fallback_translation(german_word)

        normalized = self.normalize_word(german_word)
        if not normalized:
            return []

        # Check cache
        cached = self._get_from_cache(normalized)
        if cached:
            return cached[:limit]

        results = []

        # 1. Try exact match in legal priority terms (highest priority)
        results = self._lookup_legal_priority(normalized)

        # 2. Try exact match in main dictionary
        if not results:
            results = self._lookup_exact(normalized)

        # 3. Try prefix match
        if not results and len(normalized) >= 4:
            results = self._lookup_prefix(normalized)

        # 4. Try compound word decomposition
        if not results and len(normalized) >= 10:
            results = self._lookup_compound(normalized)

        # Cache and return
        if results:
            self._add_to_cache(normalized, results)

        return results[:limit]

    def get_german_terms(self, english_word: str, limit: int = 10) -> List[str]:
        """
        Look up German terms for a given English word (English -> German).
        Uses FTS5 for efficient lookup.
        """
        if not self._db_exists:
            return []

        english_word = english_word.lower().strip()
        if not english_word:
            return []

        # Check cache
        cache_key = f"en2de:{english_word}"
        cached = self._get_from_cache(cache_key)
        if cached:
            return [res["german"] for res in cached]

        results = []
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            # 1. Try exact match in legal priority terms (reversed)
            cursor.execute(
                """
                SELECT german_term, priority_level
                FROM legal_priority_terms
                WHERE english_translation LIKE ?
                OR alternative_translations LIKE ?
                ORDER BY priority_level ASC
                LIMIT ?
            """,
                (f"%{english_word}%", f"%{english_word}%", limit),
            )

            for row in cursor.fetchall():
                results.append(
                    {
                        "german": row["german_term"],
                        "score": 100 - row["priority_level"] * 10,
                    }
                )

            # 2. Try FTS search on main dictionary
            cursor.execute(
                """
                SELECT german_word, frequency
                FROM de_en_fts
                JOIN de_en_dictionary ON de_en_fts.rowid = de_en_dictionary.id
                WHERE english_translation MATCH ?
                ORDER BY frequency DESC
                LIMIT ?
            """,
                (english_word, limit),
            )

            for row in cursor.fetchall():
                results.append(
                    {"german": row["german_word"], "score": row["frequency"]}
                )

        except Exception as e:
            logger.debug(f"Reverse lookup error for {english_word}: {e}")

        # Deduplicate and sort by score
        unique_results = {}
        for res in results:
            g = res["german"]
            if g not in unique_results or res["score"] > unique_results[g]:
                unique_results[g] = res["score"]

        sorted_german = sorted(
            unique_results.keys(), key=lambda x: unique_results[x], reverse=True
        )[:limit]

        # Cache as a list of dicts to stay consistent with internal cache structure
        self._add_to_cache(cache_key, [{"german": g} for g in sorted_german])

        return sorted_german

    def _lookup_exact(self, normalized: str) -> List[Dict]:
        """Exact match lookup in main dictionary."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT english_translation, frequency, part_of_speech
                FROM de_en_dictionary
                WHERE german_word_normalized = ?
                ORDER BY frequency DESC
                LIMIT 10
            """,
                (normalized,),
            )

            results = []
            for row in cursor.fetchall():
                results.append(
                    {
                        "english": row["english_translation"],
                        "frequency": row["frequency"],
                        "pos": row["part_of_speech"],
                        "source": "dictionary",
                    }
                )

            return results

        except Exception as e:
            logger.debug(f"Exact lookup error: {e}")
            return []

    def _lookup_legal_priority(self, normalized: str) -> List[Dict]:
        """Lookup in legal priority terms."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT english_translation, alternative_translations,
                       priority_level, context_category
                FROM legal_priority_terms
                WHERE german_term_normalized = ?
                ORDER BY priority_level ASC
                LIMIT 5
            """,
                (normalized,),
            )

            results = []
            for row in cursor.fetchall():
                # Parse alternative translations
                alts = []
                if row["alternative_translations"]:
                    try:
                        alts = json.loads(row["alternative_translations"])
                    except json.JSONDecodeError:
                        alts = [row["alternative_translations"]]

                results.append(
                    {
                        "english": row["english_translation"],
                        "alternatives": alts,
                        "frequency": 100
                        - row["priority_level"]
                        * 10,  # Higher priority = higher score
                        "pos": None,
                        "category": row["context_category"],
                        "source": "legal_priority",
                    }
                )

            return results

        except Exception as e:
            logger.debug(f"Legal priority lookup error: {e}")
            return []

    def _lookup_prefix(self, prefix: str) -> List[Dict]:
        """Prefix match lookup."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT english_translation, frequency, part_of_speech,
                       german_word_normalized
                FROM de_en_dictionary
                WHERE german_word_normalized LIKE ?
                ORDER BY frequency DESC, LENGTH(german_word_normalized) ASC
                LIMIT 5
            """,
                (prefix + "%",),
            )

            results = []
            for row in cursor.fetchall():
                results.append(
                    {
                        "english": row["english_translation"],
                        "frequency": row["frequency"] * 0.7,
                        "pos": row["part_of_speech"],
                        "matched_word": row["german_word_normalized"],
                        "source": "prefix",
                    }
                )

            return results

        except Exception as e:
            logger.debug(f"Prefix lookup error: {e}")
            return []

    def _lookup_compound(self, word: str) -> List[Dict]:
        """
        Attempt compound word decomposition.
        e.g., "Kündigungsschutzfrist" → "Kündigung" + "Schutz" + "Frist"
        """
        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            cursor.execute(
                """
                SELECT components, english_translation
                FROM compound_words
                WHERE full_word = ?
            """,
                (word,),
            )

            row = cursor.fetchone()
            if row:
                return [
                    {
                        "english": row["english_translation"] or "[compound word]",
                        "frequency": 50,
                        "pos": None,
                        "components": json.loads(row["components"]),
                        "source": "compound",
                    }
                ]

        except Exception as e:
            logger.debug(f"Compound lookup error: {e}")

        # Try to decompose and translate components
        # This is a simplified approach - full decomposition needs a component dictionary
        translations = []

        # Common German compound patterns
        patterns = [
            (r"(.+)(ung)$", "ung"),
            (r"(.+)(keit)$", "keit"),
            (r"(.+)(heit)$", "heit"),
            (r"(.+)(schaft)$", "schaft"),
            (r"(.+)(schutz)$", "schutz"),
            (r"(.+)(recht)$", "recht"),
            (r"(.+)(gesetz)$", "gesetz"),
        ]

        for pattern, suffix in patterns:
            match = re.match(pattern, word)
            if match:
                stem = match.group(1)
                if len(stem) >= 3:
                    # Translate stem
                    stem_trans = self.get_translations(stem, limit=1)
                    if stem_trans:
                        translations.append(
                            {
                                "english": f"[{stem}→{stem_trans[0]['english']}] + {suffix}",
                                "frequency": 30,
                                "pos": None,
                                "stem": stem,
                                "suffix": suffix,
                                "source": "compound_decomposed",
                            }
                        )
                break

        return translations

    def _fallback_translation(self, word: str) -> List[Dict]:
        """Fallback when database is not available.
        
        Returns empty list - no fallback to avoid circular dependency with app.py.
        """
        # Note: Previously tried to import from app.py here, but that creates
        # a circular dependency. If you need fallback translations, pass them
        # as a parameter or use memory_dict.py instead.
        logger.debug(f"No fallback translations available for '{word}'")
        return []

    def translate_phrase(self, german_text: str) -> str:
        """
        Translate a short German phrase using dictionary lookups.

        This is a simple word-by-word translation. For proper translation,
        use the AI translation endpoint.

        Args:
            german_text: German text to translate

        Returns:
            Best-effort English translation
        """
        # Tokenize
        tokens = re.findall(r"\b\w+\b|[^\w\s]", german_text, flags=re.UNICODE)

        translated = []
        for token in tokens:
            # Keep punctuation as-is
            if re.match(r"^[^\w]$", token):
                translated.append(token)
                continue

            # Look up word
            translations = self.get_translations(token, limit=1)
            if translations:
                translated.append(translations[0]["english"])
            else:
                translated.append(token)  # Keep German if no translation

        return " ".join(translated)

    def get_stats(self) -> Dict:
        """Get dictionary statistics."""
        if not self._db_exists:
            return {"error": "Database not found"}

        try:
            conn = self._get_connection()
            cursor = conn.cursor()

            stats = {}

            cursor.execute("SELECT COUNT(*) FROM de_en_dictionary")
            stats["total_entries"] = cursor.fetchone()[0]

            cursor.execute(
                "SELECT COUNT(DISTINCT german_word_normalized) FROM de_en_dictionary"
            )
            stats["unique_words"] = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM legal_priority_terms")
            stats["legal_terms"] = cursor.fetchone()[0]

            # Check if cache_size table exists before querying
            try:
                cursor.execute("SELECT COUNT(*) FROM cache_size")
                stats["cache_size"] = cursor.fetchone()[0]
            except sqlite3.OperationalError:
                stats["cache_size"] = len(self._cache)

            return stats

        except Exception as e:
            return {"error": str(e)}

    def clear_cache(self):
        """Clear the lookup cache."""
        with self._cache_lock:
            self._cache.clear()
        logger.info("Dictionary cache cleared")


# Singleton instance for easy import
_legal_dict_instance: Optional[LegalDictionary] = None


def get_legal_dictionary() -> LegalDictionary:
    """Get or create singleton dictionary instance."""
    global _legal_dict_instance
    if _legal_dict_instance is None:
        _legal_dict_instance = LegalDictionary()
    return _legal_dict_instance


# Convenience functions for direct use
def translate(german_word: str, limit: int = 5) -> List[Dict]:
    """Get translations for a German word."""
    return get_legal_dictionary().get_translations(german_word, limit)


def translate_phrase(german_text: str) -> str:
    """Translate a German phrase."""
    return get_legal_dictionary().translate_phrase(german_text)


if __name__ == "__main__":
    # Test the dictionary
    import sys

    legal_dict = LegalDictionary()

    if not legal_dict._db_exists:
        print(
            "Dictionary database not found. Run: python dictionary/build_dictionary_db.py"
        )
        sys.exit(1)

    # Test words
    test_words = ["Kündigung", "Miete", "Vermieter", "Gesetz", "Vertrag"]

    print("\nDictionary Lookup Test")
    print("=" * 50)

    for word in test_words:
        translations = legal_dict.get_translations(word)
        print(f"\n{word}:")
        for t in translations[:3]:
            print(
                f"  → {t['english']} (score: {t['frequency']}, source: {t['source']})"
            )

    print("\n" + "=" * 50)
    print(f"Stats: {legal_dict.get_stats()}")
