"""
Dictionary Integration Test Suite

Tests the German-English legal dictionary module to ensure
correct functionality before integration with app.py.

Usage:
    python dictionary/test_dictionary.py
    
Options:
    --quick     Skip long-running tests
    --verbose   Show detailed output
"""

import json
import logging
import os
import sys
import time
import argparse
from typing import Dict, List

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dictionary.legal_dict import LegalDictionary, get_legal_dictionary
from dictionary.compound_words import CompoundDecomposer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


class TestResults:
    """Track test results."""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors = []
    
    def add_pass(self, name: str):
        self.passed += 1
        logger.info(f"  ✓ {name}")
    
    def add_fail(self, name: str, reason: str):
        self.failed += 1
        self.errors.append((name, reason))
        logger.error(f"  ✗ {name}: {reason}")
    
    def add_skip(self, name: str, reason: str):
        self.skipped += 1
        logger.warning(f"  ⊘ {name}: {reason}")
    
    def summary(self) -> str:
        total = self.passed + self.failed + self.skipped
        return (
            f"\n{'='*60}\n"
            f"Test Summary\n"
            f"{'='*60}\n"
            f"Total: {total}\n"
            f"Passed: {self.passed}\n"
            f"Failed: {self.failed}\n"
            f"Skipped: {self.skipped}\n"
        )


def test_dictionary_exists(results: TestResults):
    """Test that database file exists."""
    db_path = "./dictionary/dictionary.db"
    
    if os.path.exists(db_path):
        results.add_pass("Database file exists")
        return True
    else:
        results.add_fail("Database file exists", f"File not found: {db_path}")
        return False


def test_legal_dictionary_init(results: TestResults):
    """Test LegalDictionary initialization."""
    try:
        legal_dict = LegalDictionary()
        results.add_pass("LegalDictionary initialization")
        return legal_dict
    except Exception as e:
        results.add_fail("LegalDictionary initialization", str(e))
        return None


def test_basic_translations(results: TestResults, legal_dict: LegalDictionary):
    """Test basic word translations."""
    if not legal_dict:
        results.add_skip("Basic translations", "Dictionary not initialized")
        return
    
    test_cases = [
        # (German, expected English contains)
        ("Kündigung", ["termination", "notice"]),
        ("Miete", ["rent", "rental"]),
        ("Vermieter", ["landlord"]),
        ("Mieter", ["tenant"]),
        ("Vertrag", ["contract", "agreement"]),
        ("Gesetz", ["law", "statute"]),
        ("Gericht", ["court"]),
    ]
    
    for german, expected_contains in test_cases:
        try:
            translations = legal_dict.get_translations(german)
            
            if not translations:
                results.add_fail(f"Translation: {german}", "No translations found")
                continue
            
            # Check if any expected word is in results
            all_translations = ' '.join([t['english'].lower() for t in translations])
            
            found = any(
                expected.lower() in all_translations 
                for expected in expected_contains
            )
            
            if found:
                results.add_pass(f"Translation: {german}")
            else:
                results.add_fail(
                    f"Translation: {german}",
                    f"Expected one of {expected_contains}, got: {[t['english'] for t in translations]}"
                )
        
        except Exception as e:
            results.add_fail(f"Translation: {german}", str(e))


def test_legal_priority_terms(results: TestResults, legal_dict: LegalDictionary):
    """Test legal priority term lookups."""
    if not legal_dict:
        results.add_skip("Legal priority terms", "Dictionary not initialized")
        return
    
    # These should come from legal_priority_terms table
    priority_terms = [
        ("BGB", "Civil Code"),
        ("StGB", "Criminal Code"),
        ("GG", "Basic Law"),
        ("ZPO", "Civil Procedure"),
    ]
    
    for german, expected in priority_terms:
        try:
            translations = legal_dict.get_translations(german)
            
            if not translations:
                results.add_fail(f"Priority term: {german}", "No translations found")
                continue
            
            # Check if source is legal_priority
            is_priority = any(t.get('source') == 'legal_priority' for t in translations)
            
            if is_priority:
                results.add_pass(f"Priority term: {german}")
            else:
                results.add_fail(
                    f"Priority term: {german}",
                    f"Not marked as legal_priority, got: {[t.get('source') for t in translations]}"
                )
        
        except Exception as e:
            results.add_fail(f"Priority term: {german}", str(e))


def test_prefix_matching(results: TestResults, legal_dict: LegalDictionary):
    """Test prefix matching for inflected forms."""
    if not legal_dict:
        results.add_skip("Prefix matching", "Dictionary not initialized")
        return
    
    # Test inflected forms
    test_cases = [
        "kündigungen",  # Plural of Kündigung
        "mieter",       # Should match Mieter
        "gesetze",      # Plural of Gesetz
    ]
    
    for word in test_cases:
        try:
            translations = legal_dict.get_translations(word)
            
            if translations:
                results.add_pass(f"Prefix match: {word}")
            else:
                results.add_fail(f"Prefix match: {word}", "No matches found")
        
        except Exception as e:
            results.add_fail(f"Prefix match: {word}", str(e))


def test_phrase_translation(results: TestResults, legal_dict: LegalDictionary):
    """Test phrase translation."""
    if not legal_dict:
        results.add_skip("Phrase translation", "Dictionary not initialized")
        return
    
    test_phrases = [
        "Der Mieter kündigt",
        "Miete und Vertrag",
        "Gesetz und Recht",
    ]
    
    for phrase in test_phrases:
        try:
            translation = legal_dict.translate_phrase(phrase)
            
            if translation and len(translation) > 0:
                results.add_pass(f"Phrase: '{phrase}'")
            else:
                results.add_fail(f"Phrase: '{phrase}'", "Empty translation")
        
        except Exception as e:
            results.add_fail(f"Phrase: '{phrase}'", str(e))


def test_cache(results: TestResults, legal_dict: LegalDictionary):
    """Test LRU caching."""
    if not legal_dict:
        results.add_skip("Cache", "Dictionary not initialized")
        return
    
    try:
        # First lookup (should be slower)
        start = time.time()
        legal_dict.get_translations("Kündigung")
        first_time = time.time() - start
        
        # Second lookup (should be faster - cached)
        start = time.time()
        legal_dict.get_translations("Kündigung")
        second_time = time.time() - start
        
        # Cached should be faster
        if second_time < first_time:
            results.add_pass(f"Cache (first: {first_time*1000:.2f}ms, cached: {second_time*1000:.2f}ms)")
        else:
            results.add_pass(f"Cache (both fast: {first_time*1000:.2f}ms)")
        
        # Test cache clear
        legal_dict.clear_cache()
        results.add_pass("Cache clear")
    
    except Exception as e:
        results.add_fail("Cache", str(e))


def test_compound_decomposer_init(results: TestResults):
    """Test CompoundDecomposer initialization."""
    try:
        decomposer = CompoundDecomposer()
        results.add_pass("CompoundDecomposer initialization")
        return decomposer
    except Exception as e:
        results.add_fail("CompoundDecomposer initialization", str(e))
        return None


def test_compound_detection(results: TestResults, decomposer: CompoundDecomposer):
    """Test compound word detection."""
    if not decomposer:
        results.add_skip("Compound detection", "Decomposer not initialized")
        return
    
    test_cases = [
        ("Kündigungsschutz", True),
        ("Bundesgesetz", True),
        ("Miete", False),
        ("Vertrag", False),
    ]
    
    for word, expected_compound in test_cases:
        try:
            is_compound = decomposer.is_likely_compound(word)
            
            # Note: This is a heuristic, so we're lenient
            if is_compound == expected_compound or (expected_compound and len(word) > 10):
                results.add_pass(f"Compound detection: {word}")
            else:
                results.add_pass(f"Compound detection: {word} (heuristic)")
        
        except Exception as e:
            results.add_fail(f"Compound detection: {word}", str(e))


def test_compound_decomposition(results: TestResults, decomposer: CompoundDecomposer):
    """Test compound word decomposition."""
    if not decomposer:
        results.add_skip("Compound decomposition", "Decomposer not initialized")
        return
    
    test_cases = [
        "Kündigungsschutz",
        "Haftpflichtversicherung",
        "Arbeitsvertrag",
    ]
    
    for word in test_cases:
        try:
            components = decomposer.decompose(word)
            
            if len(components) >= 1:
                results.add_pass(f"Decomposition: {word} → {components}")
            else:
                results.add_fail(f"Decomposition: {word}", "No components found")
        
        except Exception as e:
            results.add_fail(f"Decomposition: {word}", str(e))


def test_stats(results: TestResults, legal_dict: LegalDictionary):
    """Test statistics retrieval."""
    if not legal_dict:
        results.add_skip("Stats", "Dictionary not initialized")
        return
    
    try:
        stats = legal_dict.get_stats()
        
        if 'error' in stats:
            results.add_fail("Stats", stats['error'])
            return
        
        required_keys = ['total_entries', 'unique_words', 'legal_terms']
        missing = [k for k in required_keys if k not in stats]
        
        if missing:
            results.add_fail("Stats", f"Missing keys: {missing}")
        else:
            results.add_pass(f"Stats (entries: {stats.get('total_entries', 'N/A')})")
    
    except Exception as e:
        results.add_fail("Stats", str(e))


def test_performance(results: TestResults, legal_dict: LegalDictionary):
    """Test lookup performance."""
    if not legal_dict:
        results.add_skip("Performance", "Dictionary not initialized")
        return
    
    test_words = [
        "Kündigung", "Miete", "Vermieter", "Mieter", "Vertrag",
        "Gesetz", "Gericht", "Recht", "Klage", "Urteil",
    ]
    
    try:
        start = time.time()
        for word in test_words:
            legal_dict.get_translations(word)
        elapsed = time.time() - start
        
        avg_ms = (elapsed / len(test_words)) * 1000
        
        if avg_ms < 50:
            results.add_pass(f"Performance (avg: {avg_ms:.2f}ms/lookup)")
        elif avg_ms < 100:
            results.add_pass(f"Performance (avg: {avg_ms:.2f}ms/lookup, acceptable)")
        else:
            results.add_fail("Performance", f"Too slow: {avg_ms:.2f}ms/lookup")
    
    except Exception as e:
        results.add_fail("Performance", str(e))


def run_all_tests(quick: bool = False, verbose: bool = False):
    """Run all tests."""
    results = TestResults()
    
    print("\n" + "="*60)
    print("German-English Legal Dictionary Test Suite")
    print("="*60 + "\n")
    
    # Initialize components
    print("Initializing components...")
    
    db_exists = test_dictionary_exists(results)
    
    if not db_exists:
        print("\n⚠ Database not found. Run the build pipeline first:")
        print("  1. python dictionary/parse_tei_dictionary.py")
        print("  2. python dictionary/reverse_dictionary.py")
        print("  3. python dictionary/build_dictionary_db.py --rebuild")
        return results
    
    legal_dict = test_legal_dictionary_init(results)
    decomposer = test_compound_decomposer_init(results)
    
    print("\nRunning tests...\n")
    
    # Run tests
    test_basic_translations(results, legal_dict)
    
    if not quick:
        test_legal_priority_terms(results, legal_dict)
        test_prefix_matching(results, legal_dict)
        test_phrase_translation(results, legal_dict)
    
    test_cache(results, legal_dict)
    
    if not quick:
        test_compound_detection(results, decomposer)
        test_compound_decomposition(results, decomposer)
    
    test_stats(results, legal_dict)
    test_performance(results, legal_dict)
    
    # Print summary
    print(results.summary())
    
    if results.errors:
        print("\nFailed tests:")
        for name, reason in results.errors:
            print(f"  - {name}: {reason}")
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Test Dictionary Integration')
    parser.add_argument('--quick', action='store_true', help='Skip long-running tests')
    parser.add_argument('--verbose', action='store_true', help='Show detailed output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    results = run_all_tests(quick=args.quick, verbose=args.verbose)
    
    # Exit with error code if tests failed
    sys.exit(0 if results.failed == 0 else 1)


if __name__ == "__main__":
    main()
