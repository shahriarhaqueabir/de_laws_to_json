import json
import os
import sys

# Add project root and archive backend path
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _project_root)
sys.path.insert(0, os.path.join(_project_root, "_archive", "backend"))

from dictionary.legal_dict import get_legal_dictionary

d = get_legal_dictionary()
test_terms = ["Bürgerliches Gesetzbuch", "Strafgesetzbuch", "Grundgesetz"]

results = {}
for term in test_terms:
    res = d.get_translations(term, limit=1)
    results[term] = res

print(json.dumps(results, indent=2))
