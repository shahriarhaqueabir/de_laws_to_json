"""
German Compound Word Decomposer

German is famous for compound words. This module provides tools to
decompose compound German words into their component parts for better
translation.

Examples:
    "Kündigungsschutzfrist" → ["Kündigung", "Schutz", "Frist"]
    "Bundesfernstraßenmautgesetz" → ["Bundes", "fern", "straßen", "maut", "gesetz"]

Usage:
    from dictionary.compound_words import CompoundDecomposer
    
    decomposer = CompoundDecomposer()
    components = decomposer.decompose("Kündigungsschutzfrist")
"""

import json
import logging
import os
import re
import sqlite3
from typing import Dict, List, Optional, Tuple

# Configuration
DB_PATH = "./dictionary/dictionary.db"
COMPONENTS_FILE = "./dictionary/common_components.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


# Common German word components for legal/administrative text
COMMON_PREFIXES = [
    'bundes', 'landes', 'stadt', 'gemeinde', 'haupt', 'ober', 'unter',
    'vor', 'nach', 'über', 'durch', 'gegen', 'mit', 'bei', 'aus', 'ein',
    'ab', 'an', 'auf', 'zur', 'zum', 'vom', 'den', 'der', 'das', 'die'
]

COMMON_SUFFIXES = [
    'ung', 'keit', 'heit', 'schaft', 'lich', 'tion', 'ierung', 'ismus',
    'logie', 'gramm', 'meter', 'skop', 'phon', 'graph', 'kratie', 'sophie'
]

LEGAL_SUFFIXES = [
    'recht', 'gesetz', 'ordnung', 'vorschrift', 'bestimmung', 'regelung',
    'anspruch', 'pflicht', 'verbot', 'gebot', 'erlaubnis', 'genehmigung',
    'antrag', 'bescheid', 'beschluss', 'urteil', 'entscheidung', 'verfahren',
    'klage', 'einspruch', 'beschwerde', 'revision', 'berufung', 'instanz',
    'gericht', 'kammer', 'senat', 'ausschuss', 'behörde', 'amt', 'stelle'
]

COMMON_COMPOUND_LINKERS = [
    's', 'es', 'en', 'er', 'n', 'e', 'ens', 'ions'
]


class CompoundDecomposer:
    """
    Decompose German compound words into components.
    
    Uses a combination of:
    1. Known component dictionary
    2. Suffix/prefix patterns
    3. Recursive decomposition
    """
    
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._components: set = set()
        self._legal_terms: set = set()
        
        self._load_components()
        self._load_legal_terms()
    
    def _load_components(self):
        """Load common word components from file or database."""
        # Try to load from file first
        if os.path.exists(COMPONENTS_FILE):
            try:
                with open(COMPONENTS_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self._components = set(data.get('components', []))
                    logger.info(f"Loaded {len(self._components)} components from file")
                    return
            except Exception as e:
                logger.debug(f"Could not load components file: {e}")
        
        # Load from database
        if os.path.exists(self.db_path):
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Get common short words that are likely components
                cursor.execute('''
                    SELECT DISTINCT german_word_normalized
                    FROM de_en_dictionary
                    WHERE LENGTH(german_word_normalized) BETWEEN 3 AND 12
                    AND frequency >= 5
                    LIMIT 10000
                ''')
                
                self._components = {row[0] for row in cursor.fetchall()}
                conn.close()
                
                logger.info(f"Loaded {len(self._components)} components from database")
                
                # Save to file for faster loading
                self._save_components()
            
            except Exception as e:
                logger.debug(f"Could not load components from database: {e}")
        
        # Add hardcoded components
        self._components.update(COMMON_PREFIXES)
        self._components.update(LEGAL_SUFFIXES)
        self._components.update(COMMON_SUFFIXES)
    
    def _load_legal_terms(self):
        """Load legal terms for priority matching."""
        if os.path.exists(self.db_path):
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('SELECT german_term_normalized FROM legal_priority_terms')
                self._legal_terms = {row[0] for row in cursor.fetchall()}
                conn.close()
                
                logger.info(f"Loaded {len(self._legal_terms)} legal terms")
            
            except Exception as e:
                logger.debug(f"Could not load legal terms: {e}")
    
    def _save_components(self):
        """Save components to file for faster loading."""
        try:
            with open(COMPONENTS_FILE, 'w', encoding='utf-8') as f:
                json.dump({'components': list(self._components)}, f, ensure_ascii=False)
        except Exception as e:
            logger.debug(f"Could not save components: {e}")
    
    def decompose(self, word: str, max_depth: int = 5) -> List[str]:
        """
        Decompose a compound word into components.
        
        Args:
            word: German compound word
            max_depth: Maximum recursion depth
        
        Returns:
            List of component words
        """
        if not word or len(word) < 4:
            return [word] if word else []
        
        normalized = word.lower().strip()
        
        # Check if it's a known legal term (don't decompose)
        if normalized in self._legal_terms:
            return [normalized]
        
        # Check if it's a known component (don't decompose further)
        if normalized in self._components:
            return [normalized]
        
        # Try to decompose
        components = self._decompose_recursive(normalized, max_depth)
        
        # If decomposition failed, return original
        if not components or len(components) == 1:
            return [normalized]
        
        return components
    
    def _decompose_recursive(self, word: str, max_depth: int) -> List[str]:
        """Recursive decomposition with depth limit."""
        if max_depth <= 0 or len(word) < 4:
            return [word]
        
        # Try splitting at common compound linkers
        for linker in sorted(COMMON_COMPOUND_LINKERS, key=len, reverse=True):
            # Try split: word = stem + linker + rest
            pattern = f'(.+){linker}(.+)'
            match = re.match(pattern, word)
            
            if match:
                stem = match.group(1)
                rest = match.group(2)
                
                # Validate split (both parts should be meaningful)
                if len(stem) >= 2 and len(rest) >= 2:
                    # Check if rest is a known component
                    if rest in self._components or rest in self._legal_terms:
                        stem_parts = self._decompose_recursive(stem, max_depth - 1)
                        return stem_parts + [linker, rest] if linker else stem_parts + [rest]
                    
                    # Check if stem is a known component
                    if stem in self._components or stem in self._legal_terms:
                        rest_parts = self._decompose_recursive(rest, max_depth - 1)
                        return [stem] + rest_parts
        
        # Try splitting at common suffix boundaries
        for suffix in sorted(LEGAL_SUFFIXES + COMMON_SUFFIXES, key=len, reverse=True):
            if word.endswith(suffix) and len(word) > len(suffix) + 2:
                stem = word[:-len(suffix)]
                
                if len(stem) >= 3:
                    stem_parts = self._decompose_recursive(stem, max_depth - 1)
                    return stem_parts + [suffix]
        
        # Try splitting at vowel-consonant boundaries (common in compounds)
        for i in range(len(word) - 2, 2, -1):
            # Look for consonant-vowel or vowel-consonant transitions
            if word[i-1].isalpha() and word[i].isalpha():
                part1 = word[:i]
                part2 = word[i:]
                
                # Check if both parts are in our dictionary
                if part1 in self._components and part2 in self._components:
                    return [part1, part2]
                
                # Try recursive decomposition
                if part2 in self._components or len(part2) <= 6:
                    part1_decomposed = self._decompose_recursive(part1, max_depth - 1)
                    if len(part1_decomposed) > 1 or part1_decomposed[0] in self._components:
                        return part1_decomposed + [part2]
        
        # No decomposition found
        return [word]
    
    def translate_compound(self, word: str, legal_dict=None) -> Dict:
        """
        Decompose and translate a compound word.
        
        Args:
            word: German compound word
            legal_dict: LegalDictionary instance for component translation
        
        Returns:
            Dict with decomposition and translation info
        """
        components = self.decompose(word)
        
        result = {
            'original': word,
            'components': components,
            'component_count': len(components),
            'translations': [],
            'combined_translation': ''
        }
        
        if legal_dict:
            for component in components:
                translations = legal_dict.get_translations(component, limit=1)
                if translations:
                    result['translations'].append({
                        'german': component,
                        'english': translations[0]['english']
                    })
                else:
                    result['translations'].append({
                        'german': component,
                        'english': f'[{component}]'  # Unknown
                    })
            
            # Combine translations
            english_parts = [t['english'] for t in result['translations']]
            result['combined_translation'] = ' '.join(english_parts)
        
        return result
    
    def is_likely_compound(self, word: str) -> bool:
        """
        Check if a word is likely a compound word.
        
        Heuristics:
        - Length > 12 characters
        - Contains multiple capital letters (in the middle)
        - Contains common compound patterns
        """
        if len(word) < 10:
            return False
        
        # Count capital letters (German compounds often preserve capitalization)
        capitals = sum(1 for c in word[1:-1] if c.isupper())
        if capitals >= 2:
            return True
        
        # Check for common compound patterns
        patterns = [
            r'.+[aeiou]s[a-z]+',  # -s- linker
            r'.+en[a-z]+',  # -en- linker
            r'.+er[a-z]+',  # -er- linker
        ]
        
        for pattern in patterns:
            if re.match(pattern, word.lower()):
                return True
        
        return False
    
    def get_compound_statistics(self) -> Dict:
        """Get statistics about loaded components."""
        return {
            'total_components': len(self._components),
            'legal_terms': len(self._legal_terms),
            'prefixes': len(COMMON_PREFIXES),
            'suffixes': len(COMMON_SUFFIXES),
            'legal_suffixes': len(LEGAL_SUFFIXES),
            'linkers': len(COMMON_COMPOUND_LINKERS)
        }


# Convenience functions
_decomposer_instance: Optional[CompoundDecomposer] = None


def get_decomposer() -> CompoundDecomposer:
    """Get or create singleton decomposer instance."""
    global _decomposer_instance
    if _decomposer_instance is None:
        _decomposer_instance = CompoundDecomposer()
    return _decomposer_instance


def decompose(word: str) -> List[str]:
    """Decompose a German compound word."""
    return get_decomposer().decompose(word)


def translate_compound(word: str, legal_dict=None) -> Dict:
    """Decompose and translate a compound word."""
    return get_decomposer().translate_compound(word, legal_dict)


if __name__ == "__main__":
    # Test the decomposer
    decomposer = CompoundDecomposer()
    
    test_words = [
        "Kündigungsschutzfrist",
        "Bundesfernstraßenmautgesetz",
        "Grundstücksverkehrsgenehmigung",
        "Arbeitsunfähigkeitsbescheinigung",
        "Haftpflichtversicherung",
        "Mietvertrag",
    ]
    
    print("\nCompound Word Decomposition Test")
    print("=" * 60)
    
    for word in test_words:
        components = decomposer.decompose(word)
        is_compound = decomposer.is_likely_compound(word)
        
        print(f"\n{word}:")
        print(f"  Is compound: {is_compound}")
        print(f"  Components ({len(components)}): {' + '.join(components)}")
    
    print("\n" + "=" * 60)
    print(f"Statistics: {decomposer.get_compound_statistics()}")
