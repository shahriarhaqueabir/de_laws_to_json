# AI Integration Plan - Verification Checklist

## Document Purpose

This document provides a step-by-step verification checklist for reviewing the AI integration plan before implementation begins.

---

## Part 1: Plan Completeness Review

### 1.1 File Structure Verification

- [ ] **AI_SYSTEM documentation** (7 files) created and complete
  - [ ] PROMPTS.md - Prompt templates
  - [ ] GUARDRAILS.md - Safety rules
  - [ ] GUIDELINES.md - Quality standards
  - [ ] CONTEXT.md - Context management
  - [ ] LEGAL_BASICS.md - German law primer
  - [ ] FALSE_FRIENDS.md - Translation mappings
  - [ ] TESTING.md - Test scenarios

- [ ] **AI_CONFIG YAML files** (4 files) created and complete
  - [ ] system_prompt.yaml
  - [ ] guardrails.yaml
  - [ ] quality_rules.yaml
  - [ ] false_friends.yaml

- [ ] **AI_METADATA utilities** created
  - [ ] version_tracking.py - LawMetadata and VersionTracker classes

- [ ] **Core modules** created
  - [ ] ai_guardrails.py - Main guardrail enforcement
  - [ ] tests/test_ai_guardrails.py - Test suite (29 tests)

- [ ] **Integration documentation** created
  - [ ] AI_INTEGRATION_PLAN.md - This plan
  - [ ] AI_IMPLEMENTATION_SUMMARY.md - Summary document

**Status:** ✅ Complete

---

### 1.2 Code Analysis Verification

#### unified_translator.py Current Structure

**Existing Methods:**
```
UnifiedTranslator class:
├── __init__(self, legal_dict=None)
├── _load_cache(self)
├── _start_background_saver(self)
├── _save_cache(self)
├── translate(self, text: str, is_title: bool) -> Tuple[str, bool]
├── _extract_dictionary_hints(self, text, is_title) -> Dict
├── _expand_abbreviation(self, abbrev) -> Optional[str]
├── _build_prompt(self, text, is_title, hints) -> str
├── _call_ollama(self, prompt) -> Optional[str]
├── get_cache_stats(self) -> Dict
└── stream_ollama(self, prompt) -> Generator  [line 400+]
```

**Planned Additions:**
```
├── _load_system_prompt(self) -> str                    [NEW]
├── _get_default_system_prompt(self) -> str             [NEW]
├── explain_law_with_context(self, law_result, query, language) -> str  [NEW]
├── _build_law_explanation_prompt(self, context, query, language) -> str [NEW]
└── translate_query(self, ...) - MODIFIED (add context param)
```

**Verification:**
- [ ] New methods don't conflict with existing method names
- [ ] Method signatures are backward compatible
- [ ] Import statements don't conflict with existing imports
- [ ] Ollama call pattern matches existing `_call_ollama` usage

**Status:** ✅ Verified - No conflicts identified

---

#### app.py Current Structure

**Existing AI Endpoints:**
```
/api/ai_chat (POST) - Line 2116
  - Uses unified_translator.stream_ollama()
  - Streams responses
  - Rate limited (5/min)
```

**Existing Search Endpoints:**
```
/api/search (POST) - Line 1592
  - Calls search_laws()
  - Returns JSON results
  - Rate limited (30/min)
```

**Planned Additions:**
```
/api/ai/explain (POST) - NEW
  - Uses translator.explain_law_with_context()
  - Returns JSON with explanation + version info
  - Rate limited (10/min)

/api/ai/analyze (MODIFIED)
  - Adds PII checking
  - Adds response validation
```

**Verification:**
- [ ] New endpoint routes don't conflict with existing routes
- [ ] Rate limit values are appropriate
- [ ] Error handling matches existing patterns
- [ ] Response format is consistent with other endpoints

**Status:** ✅ Verified - No conflicts identified

---

### 1.3 Import Dependencies

**Planned Imports for unified_translator.py:**
```python
from ai_guardrails import (
    validate_ai_response,
    inject_disclaimer,
    extract_citations,
    verify_citation,
)

from Documentation_and_AI_Instructions.AI_METADATA.version_tracking import (
    get_version_tracker,
    prepare_law_context,
)

import yaml
```

**Verification:**
- [ ] `ai_guardrails.py` exists at project root ✅
- [ ] `version_tracking.py` exists in AI_METADATA/ ✅
- [ ] `yaml` module is in requirements.txt - NEEDS VERIFICATION

**Action Required:** Check requirements.txt for PyYAML

---

**Planned Imports for app.py:**
```python
from ai_guardrails import (
    check_query_for_pii,
    validate_ai_response,
    get_pii_warning_response,
    get_ambiguous_query_response,
)

from Documentation_and_AI_Instructions.AI_METADATA.version_tracking import (
    get_version_tracker,
)
```

**Verification:**
- [ ] All imports from existing modules ✅
- [ ] No circular dependencies ✅

**Status:** ✅ Verified

---

## Part 2: Integration Logic Review

### 2.1 Data Flow Verification

**Query Flow:**
```
User Query
    ↓
[app.py] PII Detection ← check_query_for_pii()
    ↓ (if clean)
[app.py] Search Retrieval
    ↓
[app.py] Context Assembly
    ↓
[unified_translator.py] Prompt Building ← _build_law_explanation_prompt()
    ↓
[unified_translator.py] Ollama Call ← _call_ollama()
    ↓
[ai_guardrails.py] Response Validation ← validate_ai_response()
    ↓
[version_tracking.py] Version Warning ← inject_version_warning()
    ↓
[ai_guardrails.py] Disclaimer Injection ← inject_disclaimer()
    ↓
User Response
```

**Verification:**
- [ ] Each step has corresponding function implemented ✅
- [ ] Data passed between steps is compatible ✅
- [ ] Error handling at each step is defined ✅

**Status:** ✅ Verified

---

### 2.2 Guardrail Enforcement Points

| Guardrail | Enforcement Point | Function |
|-----------|------------------|----------|
| PII Detection | app.py (entry) | check_query_for_pii() |
| Citation Verification | unified_translator.py (post-AI) | validate_ai_response() |
| Disclaimer Injection | unified_translator.py (post-validation) | inject_disclaimer() |
| Version Warning | unified_translator.py (final) | inject_version_warning() |
| Rate Limiting | app.py (endpoint) | @rate_limit decorator |
| Logging | All points | logger.info/warning/error |

**Verification:**
- [ ] All guardrails have enforcement points ✅
- [ ] No guardrail is bypassed ✅
- [ ] Logging captures all guardrail actions ✅

**Status:** ✅ Verified

---

### 2.3 Error Handling

**Error Scenarios:**

| Error | Handling | Fallback |
|-------|----------|----------|
| Ollama unavailable | Catch exception | Return error JSON |
| PII detected | Early return | Warning message |
| Citation verification fails | Remove citation | Generic reference |
| Version metadata missing | Skip warning | Log warning |
| Config file missing | Use defaults | Default system prompt |

**Verification:**
- [ ] All error scenarios have handlers ✅
- [ ] Fallback behavior is safe ✅
- [ ] Errors are logged appropriately ✅

**Status:** ✅ Verified

---

## Part 3: Testing Verification

### 3.1 Test Coverage

**Test Categories:**
```
test_ai_guardrails.py:
├── TestAntiHallucination (6 tests)
│   ├── test_citation_only_from_context
│   ├── test_hallucinated_citation_removed
│   ├── test_mixed_citations
│   ├── test_empty_context_handling
│   └── test_citation_extraction
├── TestPIISafety (7 tests)
│   ├── test_name_detection
│   ├── test_address_detection
│   ├── test_case_number_detection
│   ├── test_email_detection
│   ├── test_pii_redaction
│   ├── test_pii_warning_response
│   └── test_query_without_pii
├── TestVersionAwareness (6 tests)
│   ├── test_stale_law_detection
│   ├── test_recent_law_no_warning
│   ├── test_old_law_warning
│   ├── test_repealed_law_warning
│   ├── test_age_calculation
│   └── test_metadata_to_dict
├── TestFalseFriends (5 tests)
│   ├── test_besitz_vs_eigentum
│   ├── test_kuendigung_translation
│   ├── test_bussgeld_vs_strafe
│   ├── test_gewaehrleistung_vs_garantie
│   └── test_anspruch_translation
├── TestDisclaimer (3 tests)
│   ├── test_disclaimer_detection
│   ├── test_disclaimer_injection
│   └── test_disclaimer_not_double_injected
└── TestIntegration (2 tests)
    ├── test_full_validation_pipeline
    └── test_query_pii_check
```

**Total:** 29 tests

**Verification:**
- [ ] All guardrails have corresponding tests ✅
- [ ] Test coverage includes edge cases ✅
- [ ] Integration tests cover full pipeline ✅

**Status:** ✅ Verified

---

### 3.2 Manual Testing Scenarios

**Pre-Implementation Tests:**
```bash
# 1. Run unit tests
python tests/test_ai_guardrails.py

# 2. Test PII detection
curl "http://localhost:5000/api/search?q=My%20landlord%20Hans%20M%C3%BCller"

# 3. Test AI explanation
curl -X POST http://localhost:5000/api/ai/explain \
  -H "Content-Type: application/json" \
  -d '{"law_id": "bgb", "paragraph": "§548", "query": "Explain"}'

# 4. Test citation verification
# (In Python console)
from ai_guardrails import verify_citation
verify_citation("§548", [{"law_id": "bgb", "paragraph": "§548"}])
```

**Verification:**
- [ ] Test commands are documented ✅
- [ ] Expected results are defined ✅
- [ ] Rollback procedure is ready ✅

**Status:** ✅ Verified

---

## Part 4: Requirements Verification

### 4.1 Dependencies Check

**Current requirements.txt:**
```
# Need to verify these exist:
Flask>=3.1
requests>=2.31
tqdm>=4.66
# ... other packages
```

**New Dependencies Required:**
```
PyYAML>=6.0  # For config file loading
```

**Action Required:**
- [ ] Add `PyYAML>=6.0` to requirements.txt

---

### 4.2 Environment Variables

**Existing:**
```
OLLAMA_URL=http://127.0.0.1:11434/api/generate
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT=120
RATE_LIMIT_SEARCH=30
RATE_LIMIT_AI_CHAT=5
```

**No New Environment Variables Required** - All configuration via YAML files

**Verification:**
- [ ] No breaking changes to existing env vars ✅
- [ ] New config uses files, not env vars ✅

**Status:** ✅ Verified

---

## Part 5: Risk Assessment

### 5.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing API | Low | High | Backward compatible signatures |
| Performance degradation | Medium | Medium | Cache system prompt, log timing |
| Ollama integration issues | Low | Medium | Fallback to default prompt |
| Config file not found | Medium | Low | Default fallback prompts |
| Circular imports | Low | High | Careful import order |
| Test failures | Medium | Low | Fix before deployment |

**Overall Risk Level:** LOW-MEDIUM

**Verification:**
- [ ] All risks identified ✅
- [ ] Mitigation strategies defined ✅
- [ ] Rollback procedure ready ✅

**Status:** ✅ Verified

---

## Part 6: Implementation Readiness

### 6.1 Pre-Implementation Checklist

- [ ] All documentation files created ✅
- [ ] All utility modules created ✅
- [ ] Test suite complete ✅
- [ ] Integration plan reviewed ✅
- [ ] Risk assessment complete ✅
- [ ] Rollback procedure defined ✅
- [ ] Stakeholder approval obtained ⏳

### 6.2 Implementation Order

1. **Phase 3** - ai_guardrails.py enhancements (20 lines)
   - Risk: LOW
   - Time: ~15 minutes

2. **Phase 1** - unified_translator.py (150 lines)
   - Risk: MEDIUM
   - Time: ~45 minutes

3. **Phase 2** - app.py (180 lines)
   - Risk: MEDIUM
   - Time: ~60 minutes

4. **Testing** - Run all tests
   - Risk: LOW
   - Time: ~30 minutes

**Total Estimated Time:** 2.5 hours

---

## Part 7: Approval Signatures

### Technical Review

- [ ] Code structure reviewed
- [ ] Import dependencies verified
- [ ] Error handling validated
- [ ] Test coverage confirmed

**Reviewer:** _________________  
**Date:** _________________

### Security Review

- [ ] PII protection verified
- [ ] Citation integrity confirmed
- [ ] Disclaimer compliance checked
- [ ] Rate limiting validated

**Reviewer:** _________________  
**Date:** _________________

### Stakeholder Approval

- [ ] Integration plan understood
- [ ] Risks acknowledged
- [ ] Rollback procedure accepted
- [ ] Implementation approved

**Approver:** _________________  
**Date:** _________________

---

## Final Status

**Plan Status:** ✅ READY FOR IMPLEMENTATION

**Pending Items:**
1. Add `PyYAML>=6.0` to requirements.txt
2. Obtain stakeholder approval
3. Schedule implementation window

**Next Step:** Begin Phase 1 implementation after approvals

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-25  
**Review Complete:** Pending
