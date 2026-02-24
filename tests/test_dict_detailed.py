import sys
import os
import json

# Add parent directory to path (go up one level from tests/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dictionary.legal_dict import get_legal_dictionary

d = get_legal_dictionary()
test_terms = ["Bürgerliches Gesetzbuch", "Strafgesetzbuch", "Grundgesetz"]

results = {}
for term in test_terms:
    res = d.get_translations(term, limit=1)
    results[term] = res

print(json.dumps(results, indent=2))
