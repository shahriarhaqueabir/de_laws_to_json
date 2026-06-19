# German Law Vault — Test Suite

Comprehensive test suite covering Python backend (pytest), data pipeline, AI guardrails, download verification, payload formats, log streams, and the Next.js frontend (Vitest + RTL).

---

## Quick Start

### Python Tests (pytest)
```bash
cd tests
python run_all_tests.py          # All tests
python run_all_tests.py --quick  # Skip slow network/AI tests
python run_all_tests.py --test=broker  # Single test
```

### Next.js Tests (Vitest)
```bash
cd nextjs
npm test             # All tests
npm run test:watch   # Watch mode
npm run test:coverage
```

---

## Python Test Inventory (19 test suites)

### Data Pipeline & Processing
| Test | File | Description | Quick |
|------|------|-------------|-------|
| **download** | `test_download_de_laws.py` | HTTP retry config, `_safe_dir_name`, ZIP extraction, error handling | ✅ |
| **process** | `test_process_de_laws.py` | Categorization, authority/status/jurisdiction inference, XML parsing, norm dedup, key resolution | ✅ |
| **dedupe** | `test_dedupe_processed_data.py` | Title-based dedup, shortest-filename keep, corrupted JSON, missing dir | ✅ |
| **data_pipeline** | `test_data_pipeline.py` | JSON schema, SQLite table existence, pagination offsets, token count, pipeline stages | ✅ |
| **download_verify** | `test_download_verification.py` | TOC URL reachability, XML parsing, ZIP URL patterns, known law keys, local JSON validation | ❌ (network) |

### APIs & Broker
| Test | File | Description | Quick |
|------|------|-------------|-------|
| **broker** | `test_broker.py` | FastAPI health, `/api/chat`, `/api/tags`, CORS, validation, Ollama error handling | ✅ |
| **payload_formats** | `test_payload_formats.py` | Search/Chat/Explain/Diagnostics API shapes, bookmark/error/broker shapes | ✅ |
| **system_settings** | `test_system_settings.py` | Server status, AI status, admin info, rebuild index, frontend UI elements | ✅ |

### AI & Translation
| Test | File | Description | Quick |
|------|------|-------------|-------|
| **ai_guardrails** | `test_ai_guardrails.py` | Anti-hallucination, PII safety, version awareness, false friends, disclaimers | ✅ |
| **dictionary** | `test_dict_lookup.py` | Basic dictionary lookup | ✅ |
| **dict_detailed** | `test_dict_detailed.py` | Detailed dictionary tests | ✅ |
| **diagnostic** | `test_translation_diagnostic.py` | Translation diagnostic (dictionary, Ollama, endpoints) | ❌ |
| **unified** | `test_unified_translation.py` | Unified translation system end-to-end | ❌ |
| **qa** | `qa_translation_review.py` | Comprehensive QA review with benchmarks | ❌ |

### Vector Search (Qdrant)
| Test | File | Description | Quick |
|------|------|-------------|-------|
| **create_qdrant** | `test_create_qdrant_collection.py` | Collection name, vector size=384, COSINE, payload indexes, scalar quantization | ✅ |
| **seed_qdrant** | `test_seed_norms_to_qdrant.py` | UUID v5 generation, PointStruct payload, content truncation, batch upsert | ✅ |
| **extract_metadata** | `test_extract_laws_metadata.py` | CSV column headers, date formatting, category fallback, missing DB | ✅ |

### Infrastructure
| Test | File | Description | Quick |
|------|------|-------------|-------|
| **log_stream** | `test_log_stream.py` | Log format patterns, module logger names, tqdm usage, no sensitive data, multiline | ✅ |
| **migrations** | `test_supabase_migrations.py` | Table creation, RLS enabling, policy creation, indexes, naming conventions | ✅ |

### Additional Scripts
| File | Description |
|------|-------------|
| `run_all_tests.py` | Main test runner with CLI (`--quick`, `--verbose`, `--test=NAME`) |
| `run_tests.bat` | Windows batch launcher |

---

## Next.js Test Inventory (114+ tests)

### Lib & API Tests (14 files)
- `src/lib/__tests__/api-utils.test.ts`
- `src/lib/__tests__/bookmarks.test.ts`
- `src/lib/__tests__/chat.test.ts`
- `src/lib/__tests__/diagnosis.test.ts`
- `src/lib/__tests__/fees.test.ts`
- `src/lib/__tests__/qdrant.test.ts`
- `src/lib/__tests__/translate.test.ts`
- `src/lib/__tests__/types.test.ts`
- `src/app/api/__tests__/search.test.ts`
- `src/app/api/__tests__/laws.test.ts`
- `src/app/api/__tests__/laws-key.test.ts`
- `src/app/api/__tests__/chat.test.ts`
- `src/app/api/__tests__/explain.test.ts`
- `src/app/api/__tests__/diagnostics.test.ts`

### Component Tests (9 files)
- `src/components/__tests__/search-bar.test.tsx`
- `src/components/__tests__/category-grid.test.tsx`
- `src/components/__tests__/law-card.test.tsx`
- `src/components/__tests__/norm-viewer.test.tsx`
- `src/components/__tests__/nav-bar.test.tsx`
- `src/components/__tests__/cost-risk-calculator.test.tsx`
- `src/components/__tests__/remediation-roadmap.test.tsx`
- `src/components/__tests__/toast.test.tsx`
- `src/components/__tests__/auth-context.test.tsx`

### Page Tests (4 files)
- `src/app/__tests__/search-page.test.tsx`
- `src/app/__tests__/bookmarks-page.test.tsx`
- `src/app/__tests__/auth-page.test.tsx`
- `src/app/__tests__/settings-page.test.tsx`

### Hook & Worker Tests (3 files)
- `src/hooks/__tests__/useTranslation.test.ts`
- `src/workers/__tests__/translate.worker.test.ts`
- `src/workers/__tests__/chat.worker.test.ts`

---

## Test Coverage Map

```
User Request / System Component          → Python tests              → Next.js tests
──────────────────────────────────────────────────────────────────────────────────────
Search laws                              → test_payload_formats.py   → search.test.ts
Chat with AI                             → test_broker.py            → chat.test.ts, chat.worker.test.ts
Explain a norm                           → test_payload_formats.py   → explain.test.ts
Bookmark results                         → test_payload_formats.py   → bookmarks.test.ts
Diagnostics                              → test_payload_formats.py   → diagnostics.test.ts
Download laws from gesetze-im-internet   → test_download_de_laws.py  → —
                                           test_download_verification.py
Process XML to DB                        → test_process_de_laws.py   → —
                                           test_dedupe_processed_data.py
                                           test_data_pipeline.py
Qdrant vector search                     → test_create_qdrant_collection.py → qdrant.test.ts
                                           test_seed_norms_to_qdrant.py
                                           test_extract_laws_metadata.py
Supabase schema                          → test_supabase_migrations.py → —
Logging & observability                  → test_log_stream.py         → —
AI guardrails                            → test_ai_guardrails.py      → —
Translation system                       → test_dict_lookup.py,        → translate.test.ts
                                           test_unified_translation.py,   useTranslation.test.ts
                                           test_translation_diagnostic.py, translate.worker.test.ts
                                           qa_translation_review.py
UI components                            → —                          → search-bar, category-grid,
                                                                        law-card, norm-viewer,
                                                                        nav-bar, toast, etc.
Pages                                    → —                          → search-page, bookmarks-page,
                                                                        auth-page, settings-page
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |
| `2` | No tests were run |

---

## Adding New Tests

1. Create test file in `tests/` (Python) or `nextjs/src/__tests__/` (Next.js)
2. For Python: register in `TESTS` dict in `run_all_tests.py`
3. For Next.js: Vitest auto-discovers `__tests__/` directories
4. Run with `python run_all_tests.py --test=my_test` or `npm test`
