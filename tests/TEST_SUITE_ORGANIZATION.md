# Test Suite Organization

**Date:** 2026-06-19  
**Status:** ✅ Complete (19 Python test suites, 114+ Next.js tests)

---

## Overview

The test suite covers the full German Law Vault stack: Python data pipeline, FastAPI broker, AI guardrails, Qdrant vector search, Supabase migrations, and the Next.js frontend.

---

## Directory Structure

```
german-law-vault/
├── tests/                          ← Python test suite (pytest)
│   ├── run_all_tests.py           ← Main test runner
│   ├── run_tests.bat              ← Windows batch file
│   ├── README.md                  ← Test documentation
│   ├── test_dict_lookup.py        ← Dictionary lookup tests
│   ├── test_dict_detailed.py      ← Detailed dictionary tests
│   ├── test_translation_diagnostic.py ← Diagnostic tests (slow)
│   ├── test_unified_translation.py    ← Unified system tests (slow)
│   ├── qa_translation_review.py   ← QA review tests (slow)
│   ├── test_broker.py             ← FastAPI broker API tests
│   ├── test_create_qdrant_collection.py ← Qdrant collection tests
│   ├── test_extract_laws_metadata.py    ← CSV extraction tests
│   ├── test_seed_norms_to_qdrant.py     ← Qdrant seeding tests
│   ├── test_download_de_laws.py   ← Download pipeline tests
│   ├── test_process_de_laws.py    ← XML processing tests
│   ├── test_dedupe_processed_data.py    ← Deduplication tests
│   ├── test_payload_formats.py    ← JSON payload validation
│   ├── test_download_verification.py    ← Source verification (slow)
│   ├── test_data_pipeline.py      ← Pipeline E2E validation
│   ├── test_log_stream.py         ← Log stream validation
│   ├── test_supabase_migrations.py     ← Migration SQL validation
│   ├── test_ai_guardrails.py      ← AI safety guardrails
│   └── test_system_settings.py    ← System settings verification
│
├── nextjs/
│   ├── vitest.config.ts           ← Vitest config
│   ├── vitest.setup.ts            ← jest-dom setup
│   ├── src/lib/__tests__/         ← 8 lib test files
│   ├── src/app/api/__tests__/     ← 6 API test files
│   ├── src/components/__tests__/  ← 9 component test files
│   ├── src/app/__tests__/         ← 4 page test files
│   ├── src/hooks/__tests__/       ← 1 hook test
│   └── src/workers/__tests__/     ← 2 worker tests
│
├── _archive/backend/              ← Legacy backend (used by some tests)
├── scripts/                       ← Python scripts (tested)
├── supabase/migrations/           ← SQL migrations (tested)
└── broker/                        ← FastAPI broker (tested)
```

---

## Test Results (Quick — 19.8s total)

```
✅ Passed (14):
   • dictionary (0.11s)
   • dict_detailed (0.10s)
   • create_qdrant (1.59s)
   • extract_metadata (0.52s)
   • seed_qdrant (1.61s)
   • download (0.86s)
   • process (0.81s)
   • dedupe (0.61s)
   • payload_formats (0.50s)
   • data_pipeline (0.61s)
   • log_stream (0.75s)
   • migrations (0.61s)
   • ai_guardrails (0.15s)
   • system_settings (2.16s)
⏭️  Skipped (5): diagnostic, unified, qa, broker, download_verify
🎉 ALL TESTS PASSED!
```

---

## How to Run Tests

### Method 1: Python (all quick tests)
```bash
cd tests
python run_all_tests.py --quick
```

### Method 2: Python (all tests)
```bash
cd tests
python run_all_tests.py
```

### Method 3: Specific test
```bash
cd tests
python run_all_tests.py --test=process
python run_all_tests.py --test=migrations
```

### Method 4: Batch (Windows)
```bash
cd tests
run_tests.bat
```

### Method 5: Next.js
```bash
cd nextjs
npm test
npm run test:coverage
```

---

## Coverage by Component

| Component | Python Tests | Next.js Tests | Total |
|-----------|-------------|---------------|-------|
| Download pipeline | 12 | — | 12 |
| XML processing | 46 | — | 46 |
| Data deduplication | 6 | — | 6 |
| Data pipeline E2E | 11 | — | 11 |
| Source verification | 4 | — | 4 |
| Payload formats | 12 | — | 12 |
| Qdrant collection | 6 | — | 6 |
| Qdrant seeding | 9 | — | 9 |
| CSV metadata | 7 | — | 7 |
| Broker API | 9 | — | 9 |
| Log stream | 10 | — | 10 |
| Supabase migrations | 29 | — | 29 |
| AI guardrails | 28 | — | 28 |
| System settings | 6 | — | 6 |
| Dictionary | 10 | — | 10 |
| Translation diagnostic | 8 | — | 8 |
| Translation unified | 8 | — | 8 |
| QA review | 12 | — | 12 |
| **Lib + API tests** | — | 8+6 | 14 |
| **Component tests** | — | 9 | 9 |
| **Page tests** | — | 4 | 4 |
| **Hook + Worker tests** | — | 3 | 3 |
| **Total** | **233+** | **114+** | **347+** |

---

## Slow Tests (require network or running services)

| Test | Requirement | How to run |
|------|-------------|-----------|
| `diagnostic` | Flask + Ollama running | `python run_all_tests.py --test=diagnostic` |
| `unified` | Flask + Ollama running | `python run_all_tests.py --test=unified` |
| `qa` | Flask + Ollama running | `python run_all_tests.py --test=qa` |
| `broker` | FastAPI broker running | `python run_all_tests.py --test=broker` |
| `download_verify` | Network access | `python run_all_tests.py --test=download_verify` |

---

## Adding New Tests

1. **Create test file** in `tests/` directory
2. **Register** in `TESTS` dict in `run_all_tests.py`
3. For Next.js: add to `nextjs/src/__tests__/` directory (Vitest auto-discovers)
4. Run: `python run_all_tests.py --test=my_test` or `npm test`

---

*Last updated: 2026-06-19*
