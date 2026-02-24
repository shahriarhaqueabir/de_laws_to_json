# German Law Translation System - Test Suite

This folder contains all tests for the German Law translation system.

---

## Quick Start

### Run All Tests
```bash
cd tests
python run_all_tests.py
```

### Run Quick Tests Only (skip AI tests)
```bash
python run_all_tests.py --quick
```

### Run Specific Test
```bash
python run_all_tests.py --test=translation
python run_all_tests.py --test=dictionary
python run_all_tests.py --test=qa
```

### Verbose Output
```bash
python run_all_tests.py --verbose
```

---

## Available Tests

| Test | File | Description | Quick |
|------|------|-------------|-------|
| **dictionary** | `test_dict_lookup.py` | Basic dictionary lookup tests | ✅ |
| **dict_detailed** | `test_dict_detailed.py` | Detailed dictionary tests with JSON output | ✅ |
| **diagnostic** | `test_translation_diagnostic.py` | Translation diagnostic (dictionary, Ollama, endpoints) | ❌ |
| **unified** | `test_unified_translation.py` | Unified translation system end-to-end tests | ❌ |
| **qa** | `qa_translation_review.py` | Comprehensive QA review with benchmarks | ❌ |

---

## Test Files

### `run_all_tests.py` ⭐
Main test runner. Executes all tests and provides summary.

**Features:**
- Runs all tests automatically
- Shows pass/fail status
- Tracks execution time
- Supports filtering and verbose mode

### `test_dict_lookup.py`
Basic dictionary lookup tests. Tests if dictionary database is accessible.

**Requirements:**
- Dictionary database (`dictionary/dictionary.db`)

**Duration:** < 5 seconds

### `test_dict_detailed.py`
Detailed dictionary tests with structured JSON output.

**Requirements:**
- Dictionary database

**Duration:** < 5 seconds

### `test_translation_diagnostic.py`
Comprehensive diagnostic tool that tests:
1. Dictionary database
2. JSON data files
3. Ollama AI service
4. Translation endpoints
5. Log files

**Requirements:**
- Flask server running (`python app.py`)
- Ollama running (`ollama serve`)
- Dictionary database

**Duration:** ~30 seconds

### `test_unified_translation.py`
Tests the unified translation system:
- Ollama service check
- Flask server check
- Individual translations
- Batch translations
- Cache persistence

**Requirements:**
- Flask server running
- Ollama running

**Duration:** ~60 seconds

### `qa_translation_review.py`
Comprehensive QA review with 5 test suites:
1. Dictionary lookup (word-for-word)
2. Flask API endpoints
3. Edge cases & error handling
4. Performance benchmarks
5. Quality spot checks

**Requirements:**
- Flask server running
- Ollama running
- Dictionary database

**Duration:** ~90 seconds

---

## Prerequisites

### For Dictionary Tests
```bash
# Ensure dictionary database exists
python dictionary/build_dictionary_db.py
```

### For Translation Tests
```bash
# 1. Start Ollama
ollama serve

# 2. Start Flask server
python app.py

# 3. In another terminal, run tests
cd tests
python run_all_tests.py
```

---

## Test Output

### Success Example
```
================================================================================
GERMAN LAW TRANSLATION SYSTEM - TEST SUITE
================================================================================
Timestamp: 2026-02-24 15:30:45
Python: 3.11.0
Working Directory: e:\Abir\LocalCodeRepo\German Law\tests
================================================================================

────────────────────────────────────────────────────────────────────────────────
TEST: DICTIONARY
...
✅ DICTIONARY PASSED (2.34s)

================================================================================
TEST SUMMARY
================================================================================
Total duration: 45.67s
Passed: 3
Failed: 0
Skipped: 2

✅ Passed (3):
   • dictionary (2.34s)
   • diagnostic (15.23s)
   • unified (28.10s)

⏭️  Skipped (2):
   • qa
   • ...

================================================================================
🎉 ALL TESTS PASSED!
```

### Failure Example
```
❌ UNIFIED FAILED (30.45s)

Error output:
  ConnectionError: Flask server not running

================================================================================
TEST SUMMARY
================================================================================
Total duration: 45.67s
Passed: 2
Failed: 1
Skipped: 2

⚠️  1 TEST(S) FAILED
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |
| `2` | No tests were run |

---

## Troubleshooting

### "Dictionary database not found"
```bash
cd ..
python dictionary/build_dictionary_db.py
```

### "Ollama is not reachable"
```bash
# Start Ollama in another terminal
ollama serve
```

### "Flask server not running"
```bash
# Start Flask in another terminal
python app.py
```

### Tests timeout
Increase timeout in `run_all_tests.py`:
```python
timeout=300  # Change to higher value (seconds)
```

---

## Adding New Tests

1. Create test file: `test_my_feature.py`
2. Add to `TESTS` dict in `run_all_tests.py`:
```python
TESTS = {
    'my_feature': {
        'file': 'test_my_feature.py',
        'description': 'My new feature tests',
        'quick': False,
    },
    # ... other tests
}
```

3. Run: `python run_all_tests.py --test=my_feature`

---

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: |
    cd tests
    python run_all_tests.py --quick
```

---

## Performance Benchmarks

Typical test durations:

| Test Suite | Duration |
|------------|----------|
| Dictionary | < 5s |
| Diagnostic | ~30s |
| Unified | ~60s |
| QA Review | ~90s |

---

## Contact & Support

For issues or questions about tests, check:
- `../UNIFIED_TRANSLATION.md` - Translation system documentation
- `../TRANSLATION_SYSTEM_CHANGES.md` - Recent changes summary

---

*Last updated: 2026-02-24*
