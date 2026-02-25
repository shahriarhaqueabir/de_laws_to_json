# AI System Code Integration Plan

## Document Information

**Version:** 1.0  
**Created:** 2026-02-25  
**Status:** Ready for Review  
**Estimated Changes:** ~350 lines across 3 files

---

## Executive Summary

This plan details the code changes required to integrate the AI guardrail system into the German Law Vault application. The integration will ensure that all AI responses follow the established guidelines, guardrails, and prompt templates.

### Files to Modify

| File | Changes | Risk Level |
|------|---------|------------|
| `unified_translator.py` | ~150 lines | Medium |
| `app.py` | ~180 lines | Low |
| `ai_guardrails.py` | ~20 lines | Low |

### Files Already Complete (No Changes)

| File | Purpose |
|------|---------|
| `Documentation and AI Instructions/AI_SYSTEM/*` | Documentation |
| `Documentation and AI Instructions/AI_CONFIG/*` | Configuration |
| `Documentation and AI Instructions/AI_METADATA/version_tracking.py` | Utility |
| `tests/test_ai_guardrails.py` | Test suite |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. PII Detection (app.py)                                      │
│     - Check query for personal information                      │
│     - Warn user if PII detected                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Search & Context Retrieval (app.py)                         │
│     - Get search results                                        │
│     - Extract law metadata                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Prompt Building (unified_translator.py)                     │
│     - Inject system prompt                                      │
│     - Add retrieved context                                     │
│     - Include version metadata                                  │
│     - Apply false friends mapping                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. AI Generation (Ollama via unified_translator.py)            │
│     - Call Ollama API                                           │
│     - Get raw response                                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Response Validation (ai_guardrails.py)                      │
│     - Verify citations                                          │
│     - Check for PII in response                                 │
│     - Inject disclaimer                                         │
│     - Remove hallucinated content                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. Version Warning Injection (version_tracking.py)             │
│     - Check law version dates                                   │
│     - Add staleness warnings                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        User Response                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: unified_translator.py Integration

### 1.1: Import New Modules

**Location:** Top of file, after existing imports

```python
# Add these imports after line 21 (after existing imports)
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

import yaml  # For loading config files
```

**Risk:** Low - Standard imports, no existing code affected

---

### 1.2: Add System Prompt Loader

**Location:** After `UnifiedTranslator.__init__` method

```python
def _load_system_prompt(self) -> str:
    """
    Load system prompt from configuration file.
    
    Returns:
        System prompt string
    """
    config_path = os.path.join(
        os.path.dirname(__file__),
        "Documentation and AI Instructions",
        "AI_CONFIG",
        "system_prompt.yaml"
    )
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Build system prompt from config
        system = config.get('system', {})
        principles = config.get('principles', {})
        prohibited = config.get('prohibited_actions', [])
        
        prompt_parts = [
            system.get('identity', ''),
            "\n\nRESPONSE PRINCIPLES:",
        ]
        
        for name, settings in principles.items():
            if settings.get('enabled'):
                prompt_parts.append(f"- {settings.get('description', name)}")
        
        prompt_parts.append("\n\nPROHIBITED ACTIONS:")
        for action in prohibited:
            prompt_parts.append(f"- {action.get('description', action.get('action'))}")
        
        prompt_parts.append("\n\n⚠️ CRITICAL RULES:")
        prompt_parts.append("1. ONLY cite paragraphs from the provided context")
        prompt_parts.append("2. Verify every paragraph number before citing")
        prompt_parts.append("3. If context is empty, say 'No relevant laws found'")
        prompt_parts.append("4. Check LAST_UPDATED dates and warn if law is older than 2 years")
        prompt_parts.append("5. Include legal disclaimer at the end")
        prompt_parts.append("6. Do NOT request names, addresses, or case numbers")
        
        return "\n".join(prompt_parts)
    
    except Exception as e:
        ai_logger.warning(f"Could not load system prompt config: {e}")
        return self._get_default_system_prompt()

def _get_default_system_prompt(self) -> str:
    """Fallback system prompt if config file unavailable."""
    return """You are the German Law Vault AI Assistant.

⚠️ CRITICAL RULES:
1. ONLY cite paragraphs from the provided context
2. Verify every paragraph number before citing
3. If context is empty, say 'No relevant laws found'
4. Check LAST_UPDATED dates and warn if law is older than 2 years
5. Include legal disclaimer at the end
6. Do NOT request names, addresses, or case numbers

⚖️ This information does not constitute legal advice."""
```

**Risk:** Low - New methods, no existing code modified

---

### 1.3: Update translate_query Method

**Current Signature:**
```python
def translate_query(self, query: str, target_lang: str = "de") -> str:
```

**Changes:** Add context parameter for citation verification

```python
def translate_query(
    self,
    query: str,
    target_lang: str = "de",
    context: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Translate query with guardrail enforcement.
    
    Args:
        query: Query to translate
        target_lang: Target language ('de' or 'en')
        context: Optional search context for citation verification
    
    Returns:
        Translated text with guardrails applied
    """
    # ... existing cache check code ...
    
    # Build prompt with system instructions
    system_prompt = self._load_system_prompt()
    
    # ... existing translation logic ...
    
    # After getting AI response, apply guardrails
    if context:
        result = validate_ai_response(ai_response, context, query)
        ai_response = result.sanitized_response
    
    # Always inject disclaimer
    ai_response = inject_disclaimer(ai_response, "translation")
    
    return ai_response
```

**Risk:** Medium - Modifies existing method signature, backward compatible with default

---

### 1.4: Add New Method: explain_law_with_context

**Location:** After `translate_query` method

```python
def explain_law_with_context(
    self,
    law_result: Dict[str, Any],
    user_query: str,
    language: str = "en"
) -> str:
    """
    Explain a law paragraph with full guardrail enforcement.
    
    This is the primary method for AI law explanations. It:
    1. Builds prompt with version metadata
    2. Calls Ollama with system prompt
    3. Validates response for hallucinations
    4. Injects version warnings
    5. Adds legal disclaimer
    
    Args:
        law_result: Law result dictionary with metadata
        user_query: User's question about the law
        language: Response language ('en' or 'de')
    
    Returns:
        Explained text with all guardrails applied
    """
    # Get version tracker
    tracker = get_version_tracker()
    
    # Prepare context with metadata
    context = prepare_law_context(law_result)
    
    # Build prompt with all required elements
    prompt = self._build_law_explanation_prompt(
        context=context,
        user_query=user_query,
        language=language
    )
    
    # Get system prompt
    system_prompt = self._load_system_prompt()
    
    # Call Ollama
    ai_response = self._call_ollama(
        prompt=prompt,
        system_prompt=system_prompt,
        timeout=OLLAMA_TIMEOUT
    )
    
    # Validate response
    law_context = [law_result]  # Context for citation verification
    result = validate_ai_response(ai_response, law_context, user_query)
    ai_response = result.sanitized_response
    
    # Log validation results
    if result.warnings:
        ai_logger.warning(f"Guardrail warnings: {result.warnings}")
    if result.errors:
        ai_logger.error(f"Guardrail errors: {result.errors}")
    
    # Inject version warning
    ai_response = tracker.inject_version_warning(ai_response, law_result)
    
    # Ensure disclaimer is present
    ai_response = inject_disclaimer(ai_response, "explanation")
    
    return ai_response

def _build_law_explanation_prompt(
    self,
    context: Dict[str, Any],
    user_query: str,
    language: str
) -> str:
    """
    Build prompt for law explanation with all required elements.
    
    Args:
        context: Prepared law context with metadata
        user_query: User's question
        language: Response language
    
    Returns:
        Formatted prompt string
    """
    prompt_template = """You are explaining a German law paragraph.

LAW: {law_name}
PARAGRAPH: {paragraph}
CONTENT: {paragraph_text}
LAST_UPDATED: {last_updated}
STATUS: {status}

USER QUESTION: {user_query}

Respond in {language}.

⚠️ CRITICAL RULES:
1. ONLY explain the paragraph provided above - do NOT invent other paragraphs
2. If the paragraph number in your response doesn't match the input, STOP
3. Use simple, non-technical language
4. Explain legal terms when they appear
5. Do NOT provide legal advice - only information
6. Keep response under 300 words"""
    
    # Add version awareness instructions
    if context.get('last_updated') != 'unknown':
        try:
            change_date = datetime.fromisoformat(context['last_updated'])
            age_years = (datetime.now() - change_date).days / 365.25
            if age_years > 2:
                prompt_template += "\n\n⚠️ This law is older than 2 years. Mention this in your response."
            elif age_years > 1:
                prompt_template += "\n\nℹ️ This law version is from {date}. You may note this."
        except (ValueError, TypeError):
            pass
    
    return prompt_template.format(
        law_name=context['law_name'],
        paragraph=context['paragraph'],
        paragraph_text=context['paragraph_text'],
        last_updated=context['last_updated'],
        status=context['status'],
        user_query=user_query,
        language="English" if language == "en" else "German"
    )
```

**Risk:** Medium - New method, but uses existing Ollama call infrastructure

---

### 1.5: Update _call_ollama Method

**Add:** Guardrail logging

```python
def _call_ollama(
    self,
    prompt: str,
    system_prompt: Optional[str] = None,
    timeout: int = None
) -> str:
    # ... existing Ollama call code ...
    
    # Log the call for auditing
    ai_logger.info(
        f"Ollama call: model={OLLAMA_MODEL}, "
        f"prompt_length={len(prompt)}, "
        f"system_prompt={system_prompt is not None}"
    )
    
    # ... rest of existing code ...
```

**Risk:** Low - Logging addition only

---

## Phase 2: app.py Integration

### 2.1: Import New Modules

**Location:** Top of file, after existing imports (around line 50)

```python
# Add these imports after the unified_translator imports
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

**Risk:** Low - Standard imports

---

### 2.2: Update /api/search Endpoint

**Location:** Find the `/api/search` endpoint (around line 1200)

**Add:** PII checking at the start of the endpoint

```python
@app.route("/api/search")
def api_search():
    """Search API endpoint with PII protection."""
    query = request.args.get("q", "").strip()
    
    # NEW: Check for PII in query
    has_pii, pii_types, warning = check_query_for_pii(query)
    if has_pii:
        indexing_logger.warning(
            f"PII detected in search query: {pii_types}"
        )
        return jsonify({
            "warning": warning,
            "results": [],
            "query": query,
            "pii_detected": True
        })
    
    # ... rest of existing search code ...
```

**Risk:** Low - Early return with warning, doesn't break existing functionality

---

### 2.3: Add /api/ai/explain Endpoint

**Location:** After existing AI endpoints (around line 1500)

```python
@app.route("/api/ai/explain", methods=["POST"])
@rate_limit(10, 60)  # 10 requests per minute
def api_ai_explain():
    """
    Explain a law paragraph with AI.
    
    Expects JSON body:
    {
        "law_id": "bgb",
        "paragraph": "§548",
        "query": "What does this mean?"
    }
    
    Returns:
    {
        "explanation": "...",
        "warnings": [...],
        "version_info": {...}
    }
    """
    if not _is_admin(request):
        return jsonify({"error": "unauthorized"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "invalid_json"}), 400
    
    law_id = data.get("law_id", "")
    paragraph = data.get("paragraph", "")
    user_query = data.get("query", "")
    
    # Find the law in search index
    law_result = _find_law_by_id(law_id, paragraph)
    if not law_result:
        return jsonify({"error": "law_not_found"}), 404
    
    # Get AI explanation with guardrails
    try:
        translator = get_unified_translator(None)
        explanation = translator.explain_law_with_context(
            law_result=law_result,
            user_query=user_query,
            language="en"  # Could be made configurable
        )
        
        # Get version info
        tracker = get_version_tracker()
        metadata = tracker.get_metadata(law_result)
        
        return jsonify({
            "explanation": explanation,
            "law_id": law_id,
            "paragraph": paragraph,
            "version_info": {
                "last_changed": metadata.last_changed,
                "status": metadata.status,
                "age_years": metadata.get_age_years(),
                "warning": metadata.get_staleness_warning()
            }
        })
    
    except Exception as e:
        ai_logger.error(f"AI explanation failed: {e}")
        return jsonify({
            "error": "ai_unavailable",
            "message": "AI explanation is currently unavailable"
        }), 503

def _find_law_by_id(law_id: str, paragraph: str) -> Optional[Dict]:
    """
    Find a law in the search index by ID and paragraph.
    
    Args:
        law_id: Law identifier (e.g., 'bgb')
        paragraph: Paragraph number (e.g., '§548')
    
    Returns:
        Law result dictionary or None
    """
    # Search in the index
    with _index_lock:
        if _search_index is None:
            return None
        
        # Look for exact match
        for result in _search_index.get("laws", []):
            if (result.get("law_id") == law_id and 
                result.get("paragraph") == paragraph):
                return result
        
        # Try partial match
        for result in _search_index.get("laws", []):
            if (law_id in result.get("law_id", "") and 
                paragraph in result.get("paragraph", "")):
                return result
    
    return None
```

**Risk:** Medium - New endpoint, depends on search index structure

---

### 2.4: Update /api/ai/analyze Endpoint

**Location:** Find existing AI analyze endpoint

**Add:** Response validation

```python
@app.route("/api/ai/analyze", methods=["POST"])
@rate_limit(5, 60)
def api_ai_analyze():
    """Analyze user's legal situation with guardrails."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "invalid_json"}), 400
    
    query = data.get("query", "")
    
    # Check for PII
    has_pii, pii_types, warning = check_query_for_pii(query)
    if has_pii:
        return jsonify({
            "warning": warning,
            "analysis": None,
            "pii_detected": True
        })
    
    # ... existing analysis code ...
    
    # After getting AI response, validate it
    if ai_response:
        result = validate_ai_response(
            ai_response,
            context=[],  # No specific context for analysis
            query=query
        )
        ai_response = result.sanitized_response
        
        # Log any issues
        if result.warnings:
            ai_logger.warning(f"Analysis guardrail warnings: {result.warnings}")
    
    # ... rest of existing code ...
```

**Risk:** Low - Adds validation to existing flow

---

### 2.5: Add Ambiguous Query Detection

**Location:** In search or analysis logic

```python
def _detect_ambiguous_query(query: str) -> Tuple[bool, List[str]]:
    """
    Detect if query is ambiguous and suggest interpretations.
    
    Args:
        query: User query
    
    Returns:
        Tuple of (is_ambiguous, interpretations)
    """
    # Keywords that indicate ambiguity
    ambiguous_terms = {
        "terminated": [
            "Employment termination (Arbeitsrecht)",
            "Rental agreement termination (Mietrecht)",
            "Contract termination (Vertragsrecht)"
        ],
        "kündigung": [
            "Employment termination (Arbeitsrecht)",
            "Rental agreement termination (Mietrecht)",
            "Contract termination (Vertragsrecht)"
        ],
        "fine": [
            "Administrative fine (Bußgeld - OWiG)",
            "Criminal penalty (Strafe - StGB)"
        ],
        "bußgeld": [
            "Traffic violation",
            "Administrative offense",
            "Public order violation"
        ]
    }
    
    query_lower = query.lower()
    
    for term, interpretations in ambiguous_terms.items():
        if term in query_lower:
            return True, interpretations
    
    return False, []

# Usage in endpoint:
is_ambiguous, interpretations = _detect_ambiguous_query(query)
if is_ambiguous:
    return jsonify({
        "ambiguous": True,
        "interpretations": interpretations,
        "warning": get_ambiguous_query_response(interpretations)
    })
```

**Risk:** Low - Helper function, optional enhancement

---

## Phase 3: ai_guardrails.py Enhancements

### 3.1: Add Configuration Loader

**Location:** After imports

```python
def load_guardrail_config() -> Dict[str, Any]:
    """
    Load guardrail configuration from YAML file.
    
    Returns:
        Configuration dictionary
    """
    config_path = os.path.join(
        os.path.dirname(__file__),
        "Documentation and AI Instructions",
        "AI_CONFIG",
        "guardrails.yaml"
    )
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.warning(f"Could not load guardrail config: {e}")
        return {}

# Load config at module initialization
_guardrail_config = load_guardrail_config()
```

**Risk:** Low - Configuration loading only

---

### 3.2: Update PII Patterns from Config

**Location:** Replace hardcoded PII_PATTERNS

```python
# Load patterns from config if available
if _guardrail_config:
    pii_config = _guardrail_config.get('data_privacy', {}).get('pii_detection', {})
    patterns_config = pii_config.get('patterns', {})
    
    if patterns_config:
        PII_PATTERNS = {
            name: {
                "pattern": config.get('regex', ''),
                "description": config.get('description', name),
                "redact_to": config.get('redact_to', f'[{name.upper()}]')
            }
            for name, config in patterns_config.items()
        }
```

**Risk:** Low - Backward compatible with hardcoded defaults

---

## Testing Plan

### Unit Tests (Already Complete)

```bash
python tests/test_ai_guardrails.py
```

Expected: All 29 tests pass

### Integration Tests

**Test 1: PII Detection in Search**
```bash
curl "http://localhost:5000/api/search?q=My%20landlord%20Hans%20M%C3%BCller%20won't%20return%20deposit"
```
Expected: Warning response with PII notice

**Test 2: AI Explanation with Guardrails**
```bash
curl -X POST http://localhost:5000/api/ai/explain \
  -H "Content-Type: application/json" \
  -d '{"law_id": "bgb", "paragraph": "§548", "query": "What does this mean?"}'
```
Expected: Explanation with disclaimer and version warning (if applicable)

**Test 3: Citation Verification**
```python
# In Python console after starting app:
from ai_guardrails import verify_citation

context = [{"law_id": "bgb", "paragraph": "§548", "content": "..."}]
verify_citation("§548", context)  # Should return True
verify_citation("§999", context)  # Should return False
```

### Manual Testing Checklist

- [ ] Search with PII returns warning
- [ ] AI explanation includes disclaimer
- [ ] Old laws show version warning
- [ ] Hallucinated citations are removed
- [ ] Ambiguous queries get clarification options
- [ ] Rate limiting works on AI endpoints
- [ ] Logs show guardrail actions

---

## Rollback Plan

If issues occur:

1. **Comment out new imports** in both files
2. **Revert endpoint changes** - keep existing search/analyze endpoints unchanged
3. **Keep ai_guardrails.py** - it's standalone and doesn't affect existing code

**Rollback Commands:**
```bash
# Backup current versions first
cp app.py app.py.ai-integration
cp unified_translator.py unified_translator.py.ai-integration

# If rollback needed, restore backups
# (Assuming git is being used)
git checkout app.py
git checkout unified_translator.py
```

---

## Success Criteria

Integration is successful when:

1. ✅ All existing tests pass
2. ✅ New guardrail tests pass (29 tests)
3. ✅ PII detection works in search
4. ✅ AI explanations include disclaimers
5. ✅ Citation verification removes hallucinations
6. ✅ Version warnings appear for old laws
7. ✅ No performance degradation (>10% slowdown)
8. ✅ No new errors in logs

---

## Implementation Order

1. **Phase 3** (ai_guardrails.py enhancements) - Lowest risk
2. **Phase 1** (unified_translator.py) - Medium risk, core AI logic
3. **Phase 2** (app.py) - Medium risk, user-facing changes
4. **Testing** - Verify all changes work correctly

---

## Review Checklist

Before implementation:

- [ ] Review complete with stakeholder
- [ ] Confirm no breaking changes to existing API
- [ ] Verify backup/rollback procedure
- [ ] Schedule implementation during low-traffic period
- [ ] Prepare monitoring for post-deployment

After implementation:

- [ ] Run all tests
- [ ] Check application logs
- [ ] Verify AI responses include guardrails
- [ ] Monitor performance metrics
- [ ] Collect user feedback

---

**Document Status:** Ready for Review  
**Next Step:** Stakeholder approval before code implementation
