"""
In-Memory Legal Dictionary Module

Provides fast dictionary lookups using in-memory JSON data instead of SQLite.
This eliminates database locking issues and provides instant lookups.

Usage:
    from dictionary.memory_dict import MemoryLegalDictionary
    
    legal_dict = MemoryLegalDictionary()
    results = legal_dict.get_translations("Kündigung")
"""

import csv
import json
import logging
import os
import re
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Configuration
LEGAL_PRIORITY_CSV = "./dictionary/legal_priority_terms.csv"
DE_EN_REVERSED_JSON = "./dictionary/de_en_reversed.json"  # German→English (reversed)


class MemoryLegalDictionary:
    """
    In-memory German→English legal dictionary.
    
    Loads all data into memory at startup for fast lookups.
    No database connections, no locking issues.
    """
    
    def __init__(self):
        self.legal_priority: Dict[str, List[Dict]] = {}
        self.main_dict: Dict[str, List[Dict]] = {}
        self.prefix_index: Dict[str, List[str]] = {}
        
        self._load_legal_priority()
        self._load_main_dictionary()
        
        logger.info(f"In-memory dictionary loaded: {len(self.legal_priority)} legal terms, {len(self.main_dict)} main entries")
    
    def _load_legal_priority(self):
        """Load legal priority terms from CSV into memory."""
        if not os.path.exists(LEGAL_PRIORITY_CSV):
            logger.warning(f"Legal priority CSV not found: {LEGAL_PRIORITY_CSV}")
            return
        
        try:
            with open(LEGAL_PRIORITY_CSV, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    german = row.get('german_term', '').strip().lower()
                    if not german:
                        continue
                    
                    # Parse alternative translations - handle CSV escaping
                    alts_str = row.get('alternative_translations', '[]')
                    try:
                        # Handle double-quoted JSON in CSV
                        alts_str = alts_str.replace('""', '"')
                        alts = json.loads(alts_str)
                    except:
                        alts = []
                    
                    try:
                        priority = int(row.get('priority_level', 5))
                    except:
                        priority = 5
                    
                    entry = {
                        'english': row.get('english_translation', ''),
                        'alternatives': alts,
                        'frequency': 100 - priority * 10,
                        'pos': None,
                        'category': row.get('context_category', ''),
                        'source': 'legal_priority'
                    }
                    
                    if german not in self.legal_priority:
                        self.legal_priority[german] = []
                    self.legal_priority[german].append(entry)
        
        except Exception as e:
            logger.error(f"Failed to load legal priority CSV: {e}")
            import traceback
            traceback.print_exc()
    
    def _load_main_dictionary(self):
        """Load main dictionary from JSON file."""
        if not os.path.exists(DE_EN_REVERSED_JSON):
            logger.warning(f"Main dictionary JSON not found: {DE_EN_REVERSED_JSON}")
            logger.warning("Run the dictionary build pipeline first:")
            logger.warning("  1. python dictionary/parse_tei_dictionary.py")
            logger.warning("  2. python dictionary/reverse_dictionary.py")
            logger.warning("  3. python dictionary/build_dictionary_db.py")
            return

        try:
            # Load with UTF-8 encoding
            with open(DE_EN_REVERSED_JSON, 'r', encoding='utf-8') as f:
                # de_en_reversed.json is already German→English format
                raw_data = json.load(f)

            # Load German→English mappings directly
            for german, entries in raw_data.items():
                german_normalized = german.lower().strip()
                if not german_normalized:
                    continue

                if german_normalized not in self.main_dict:
                    self.main_dict[german_normalized] = []

                # entries is a list of translation dicts
                for entry in entries:
                    self.main_dict[german_normalized].append({
                        'english': entry.get('english', german),
                        'frequency': entry.get('frequency', 50),
                        'pos': entry.get('pos', ''),
                        'source': 'main_dict'
                    })

            # Build prefix index for faster prefix lookups
            self._build_prefix_index()

        except Exception as e:
            logger.error(f"Failed to load main dictionary JSON: {e}")
    
    def _build_prefix_index(self):
        """Build prefix index for faster prefix lookups."""
        for word in self.main_dict.keys():
            # Index first 3-6 characters as prefixes
            for prefix_len in range(3, min(7, len(word) + 1)):
                prefix = word[:prefix_len]
                if prefix not in self.prefix_index:
                    self.prefix_index[prefix] = []
                if word not in self.prefix_index[prefix]:
                    self.prefix_index[prefix].append(word)
    
    def get_translations(self, german_word: str, limit: int = 5) -> List[Dict]:
        """
        Get English translations for a German word.
        
        Args:
            german_word: German word to translate
            limit: Maximum number of translations to return
        
        Returns:
            List of translation dicts
        """
        normalized = self._normalize_word(german_word)
        if not normalized:
            return []
        
        # 1. Try legal priority terms (highest priority)
        if normalized in self.legal_priority:
            return self.legal_priority[normalized][:limit]
        
        # 2. Try main dictionary
        if normalized in self.main_dict:
            return self.main_dict[normalized][:limit]
        
        # 3. Try prefix match
        if len(normalized) >= 3:
            prefix = normalized[:4]
            if prefix in self.prefix_index:
                matches = []
                for word in self.prefix_index[prefix]:
                    if word.startswith(normalized):
                        matches.extend(self.main_dict.get(word, []))
                if matches:
                    return matches[:limit]
        
        # 4. Try legal priority with prefix
        for key, entries in self.legal_priority.items():
            if key.startswith(normalized):
                return entries[:limit]
        
        return []
    
    def _normalize_word(self, word: str) -> str:
        """Normalize German word for lookup."""
        if not word:
            return ""
        
        word = word.lower().strip()
        
        # Remove articles
        word = re.sub(r"^(der|die|das|den|dem|des|ein|eine)\s+", "", word)
        
        # Strip punctuation
        word = re.sub(r"^[^\w]+|[^\w]+$", "", word)
        
        return word
    
    def translate_phrase(self, german_text: str) -> str:
        """
        Translate a German phrase word-by-word.
        
        Args:
            german_text: German text to translate
        
        Returns:
            Best-effort English translation
        """
        tokens = re.findall(r"\b\w+\b|[^\w\s]", german_text, flags=re.UNICODE)
        translated = []
        
        for token in tokens:
            if re.match(r"^[^\w]$", token):
                translated.append(token)
                continue
            
            results = self.get_translations(token, limit=1)
            if results:
                translated.append(results[0]['english'])
            else:
                translated.append(token)
        
        return " ".join(translated)
    
    def get_stats(self) -> Dict:
        """Get dictionary statistics."""
        return {
            'legal_priority_terms': len(self.legal_priority),
            'main_dict_entries': len(self.main_dict),
            'prefix_index_entries': len(self.prefix_index),
            'type': 'in_memory'
        }


# Singleton instance
_memory_dict_instance: Optional[MemoryLegalDictionary] = None


def get_memory_legal_dictionary() -> MemoryLegalDictionary:
    """Get or create singleton in-memory dictionary instance."""
    global _memory_dict_instance
    if _memory_dict_instance is None:
        _memory_dict_instance = MemoryLegalDictionary()
    return _memory_dict_instance


# Convenience functions
def translate(german_word: str, limit: int = 5) -> List[Dict]:
    """Get translations for a German word."""
    return get_memory_legal_dictionary().get_translations(german_word, limit)


def translate_phrase(german_text: str) -> str:
    """Translate a German phrase."""
    return get_memory_legal_dictionary().translate_phrase(german_text)


if __name__ == "__main__":
    # Test the in-memory dictionary
    import io
    import sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    
    print("Testing In-Memory Legal Dictionary")
    print("=" * 50)
    
    legal_dict = get_memory_legal_dictionary()
    
    test_words = ["Kündigung", "Miete", "Vermieter", "BGB", "Gesetz"]
    
    for word in test_words:
        results = legal_dict.get_translations(word)
        if results:
            print(f"{word} -> {results[0]['english']} (source: {results[0]['source']})")
        else:
            print(f"{word} -> No translation found")
    
    print("\nStats:", legal_dict.get_stats())
