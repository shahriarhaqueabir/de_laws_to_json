# Test Suite Organization

**Date:** 2026-02-24  
**Status:** ✅ Complete

---

## Overview

All test files have been consolidated into a single `tests/` directory with a unified test runner.

---

## Directory Structure

```
German Law/
├── tests/                          ← New tests directory
│   ├── run_all_tests.py           ← Main test runner
│   ├── run_tests.bat              ← Windows batch file
│   ├── README.md                  ← Test documentation
│   ├── test_dict_lookup.py        ← Dictionary lookup tests
│   ├── test_dict_detailed.py      ← Detailed dictionary tests
│   ├── test_translation_diagnostic.py  ← Diagnostic tests
│   ├── test_unified_translation.py     ← Unified system tests
│   └── qa_translation_review.py   ← QA review tests
│
├── app.py                          ← Main application
├── unified_translator.py           ← Translation engine
└── ...
```

---

## How to Run Tests

### Method 1: Python Direct

```bash
cd tests
python run_all_tests.py
```

### Method 2: Batch File (Windows)

```bash
cd tests
run_tests.bat
```

### Method 3: Specific Tests

```bash
# Run only dictionary tests
python run_all_tests.py --test=dictionary

# Run only translation tests
python run_all_tests.py --test=unified

# Run only QA review
python run_all_tests.py --test=qa
```

### Method 4: Quick Tests (Skip AI)

```bash
python run_all_tests.py --quick
```

---

## Test Files

### Core Test Runner

| File | Purpose | Lines |
|------|---------|-------|
| `run_all_tests.py` | Main test runner with CLI options | ~250 |
| `run_tests.bat` | Windows batch launcher | ~35 |
| `README.md` | Test documentation | ~200 |

### Test Suites

| File | Tests | Duration | Requires |
|------|-------|----------|----------|
| `test_dict_lookup.py` | Dictionary lookups | <5s | Dictionary DB |
| `test_dict_detailed.py` | Detailed dictionary | <5s | Dictionary DB |
| `test_translation_diagnostic.py` | Full diagnostics | ~30s | Flask + Ollama |
| `test_unified_translation.py` | Unified system | ~60s | Flask + Ollama |
| `qa_translation_review.py` | QA review | ~90s | Flask + Ollama |

---

## Features

### Test Runner (`run_all_tests.py`)

**CLI Options:**
- `--quick` - Run only fast tests (skip AI)
- `--verbose` - Show detailed output
- `--test=NAME` - Run specific test only

**Automatic:**
- Discovers test files
- Tracks execution time
- Shows pass/fail status
- Provides summary report
- Returns exit codes (0=pass, 1=fail)

### Example Output

```
================================================================================
GERMAN LAW TRANSLATION SYSTEM - TEST SUITE
================================================================================
Timestamp: 2026-02-24 15:30:45
Python: 3.11.0

────────────────────────────────────────────────────────────────────────────────
TEST: DICTIONARY
────────────────────────────────────────────────────────────────────────────────
✓ Dictionary database exists
✓ 'Kündigung' -> termination (source: legal_priority)

✅ DICTIONARY PASSED (2.34s)

================================================================================
TEST SUMMARY
================================================================================
Total duration: 45.67s
Passed: 4
Failed: 0
Skipped: 1

✅ Passed (4):
   • dictionary (2.34s)
   • dict_detailed (1.89s)
   • diagnostic (15.23s)
   • unified (26.21s)

⏭️  Skipped (1):
   • qa

================================================================================
🎉 ALL TESTS PASSED!
```

---

## Migration

### Files Moved

| From | To |
|------|-----|
| `test_dict_lookup.py` | `tests/test_dict_lookup.py` |
| `test_dict_detailed.py` | `tests/test_dict_detailed.py` |
| `test_translation_diagnostic.py` | `tests/test_translation_diagnostic.py` |
| `test_unified_translation.py` | `tests/test_unified_translation.py` |
| `qa_translation_review.py` | `tests/qa_translation_review.py` |

### Files Deleted

| File | Reason |
|------|--------|
| `prewarm_ai_cache.py` | Corrupted, functionality in `app.py` |

### Updated Files

| File | Changes |
|------|---------|
| `test_dict_lookup.py` | Fixed path imports |
| `test_dict_detailed.py` | Fixed path imports |
| `test_translation_diagnostic.py` | Updated to use `/api/translate` |
| `test_unified_translation.py` | No changes needed |
| `qa_translation_review.py` | Updated to use `/api/translate` |

---

## Usage Examples

### Developer Workflow

```bash
# Quick check after code changes
cd tests
python run_all_tests.py --quick

# Full test before commit
python run_all_tests.py

# Debug specific feature
python run_all_tests.py --test=translation --verbose
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Tests
  run: |
    cd tests
    python run_all_tests.py --quick
```

### Manual Testing

```bash
# Start services
python app.py  # Terminal 1
ollama serve   # Terminal 2

# Run tests
cd tests
python run_all_tests.py  # Terminal 3
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |
| `2` | No tests were run |

Use in scripts:
```bash
python run_all_tests.py
if %ERRORLEVEL% EQU 0 (
    echo Tests passed!
) else (
    echo Tests failed!
)
```

---

## Adding New Tests

1. **Create test file** in `tests/` directory:
   ```python
   # tests/test_my_feature.py
   import sys
   import os
   sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
   
   def test_my_feature():
       # Your test code
       pass
   ```

2. **Register** in `run_all_tests.py`:
   ```python
   TESTS = {
       'my_feature': {
           'file': 'test_my_feature.py',
           'description': 'My feature tests',
           'quick': False,
       },
   }
   ```

3. **Run**:
   ```bash
   python run_all_tests.py --test=my_feature
   ```

---

## Troubleshooting

### Import Errors
```
ModuleNotFoundError: No module named 'dictionary'
```
**Fix:** Ensure path is set correctly:
```python
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

### Connection Errors
```
ConnectionRefusedError: Flask server not running
```
**Fix:** Start Flask server:
```bash
python app.py
```

### Timeout Errors
```
subprocess.TimeoutExpired: Command timed out after 300s
```
**Fix:** Increase timeout in `run_all_tests.py`:
```python
timeout=600  # 10 minutes
```

---

## Documentation

| Document | Location |
|----------|----------|
| Test README | `tests/README.md` |
| Translation System Docs | `UNIFIED_TRANSLATION.md` |
| Changes Summary | `TRANSLATION_SYSTEM_CHANGES.md` |
| This Document | `tests/TEST_SUITE_ORGANIZATION.md` |

---

## Summary

✅ **All tests organized in single directory**  
✅ **Unified test runner with CLI**  
✅ **Documentation complete**  
✅ **Batch file for Windows**  
✅ **Ready for CI/CD integration**

---

*Document generated: 2026-02-24*
