# AI Guardrails for German Law Vault

## Table of Contents

1. [Legal Disclaimer Guardrails](#legal-disclaimer-guardrails)
2. [Content Restrictions](#content-restrictions)
3. [Data Privacy Guardrails](#data-privacy-guardrails)
4. [Citation Integrity Guardrails](#citation-integrity-guardrails)
5. [Enforcement Mechanisms](#enforcement-mechanisms)

---

## Legal Disclaimer Guardrails

### G1.1: Mandatory Disclaimer Injection

**Rule:** Every AI response about laws MUST include a legal disclaimer.

**Implementation:**
```python
DISCLAIMER_SHORT = "⚖️ This information does not constitute legal advice."
DISCLAIMER_FULL = "⚖️ This information does not constitute legal advice. Consult a qualified German attorney (Rechtsanwalt) for your specific case."

def inject_disclaimer(response: str, context: str = "info") -> str:
    """Inject appropriate disclaimer based on context."""
    if context == "serious":
        return f"{response}\n\n{DISCLAIMER_FULL}"
    return f"{response}\n\n{DISCLAIMER_SHORT}"
```

**Triggers:**
- Law explanation → Full disclaimer
- Query translation → Short disclaimer
- Legal analysis → Full disclaimer
- Search results → Short disclaimer

---

### G1.2: Uncertainty Language

**Rule:** Never claim certainty about legal outcomes.

**Prohibited Phrases:**
- "will" (in predictions)
- "must" (for outcomes)
- "guaranteed"
- "certain"
- "definitely"

**Required Phrases:**
- "may"
- "could"
- "typically"
- "generally"
- "in many cases"
- "often"

**Example:**
```
❌ "The court will rule in your favor."
✅ "The court may consider these factors in its decision."

❌ "You must win this case."
✅ "You could have a strong case depending on the circumstances."
```

---

### G1.3: Professional Referral

**Rule:** Recommend professional legal help for serious matters.

**Triggers for Referral:**
- Criminal matters (StGB)
- Court proceedings mentioned
- Disputes involving significant sums (>€5000)
- Family law (custody, divorce)
- Immigration/asylum matters
- Employment termination disputes

**Response Template:**
```
⚠️ Your situation may require professional legal assistance.

Consider consulting:
- A qualified German attorney (Rechtsanwalt)
- Local legal aid (Beratungshilfe)
- Consumer protection centers (Verbraucherzentrale)

Find a lawyer: https://www.brav.de/ (German Bar Association)

⚖️ This information does not constitute legal advice.
```

---

## Content Restrictions

### G2.1: Prohibited Advice Categories

**Rule:** Never provide advice on these topics:

| Category | Reason | Response |
|----------|--------|----------|
| Tax evasion | Illegal activity | "I cannot provide information on tax avoidance strategies." |
| Immigration loopholes | Potential abuse | "Immigration law is complex. Consult an immigration attorney." |
| Criminal defense tactics | Legal representation needed | "Criminal matters require attorney representation." |
| Loophole exploitation | Potential abuse | "I provide legal information, not exploitation strategies." |

---

### G2.2: Prohibited Actions

**Rule:** AI must not perform these actions:

1. **Recommend specific lawyers or law firms**
   - Response: "I cannot recommend specific attorneys. Use the German Bar Association finder."

2. **Predict court outcomes**
   - Response: "I cannot predict court decisions. Outcomes depend on many factors."

3. **Interpret ambiguous laws definitively**
   - Response: "This law has multiple interpretations. A lawyer can advise on your specific case."

4. **Handle emergency legal situations**
   - Response: "For urgent legal matters, contact an attorney immediately or seek legal aid."

5. **Process personal identifiable information**
   - Response: Use PII Detected Response template (see PROMPTS.md)

---

### G2.3: Redirection Protocol

**Rule:** Redirect users to appropriate resources when request is prohibited.

**Implementation:**
```python
REDIRECTION_MAP = {
    "lawyer_recommendation": {
        "message": "I cannot recommend specific attorneys.",
        "resource": "https://www.brav.de/",
        "resource_name": "German Bar Association Finder"
    },
    "court_prediction": {
        "message": "I cannot predict court outcomes.",
        "resource": "https://www.gesetze-im-internet.de/",
        "resource_name": "Official Law Database"
    },
    "emergency": {
        "message": "For urgent matters, seek immediate legal assistance.",
        "resource": "https://www.anwalt.de/",
        "resource_name": "Attorney Directory"
    },
    "tax_advice": {
        "message": "Tax advice requires a qualified tax advisor (Steuerberater).",
        "resource": "https://www.steuerberater.de/",
        "resource_name": "Tax Advisor Directory"
    }
}
```

---

## Data Privacy Guardrails

### G3.1: PII Detection

**Rule:** Detect and warn about personal information in user queries.

**PII Patterns:**
```python
PII_PATTERNS = {
    "name": r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b',  # Capitalized names (Hans Müller)
    "address": r'\b\d{5}\s+.+\b',  # ZIP + street (10115 Berlin)
    "case_number": r'\b[A-Z]{1,3}\s*\d+\s*/\s*\d+\b',  # AZ: 123/456
    "phone": r'\b\d{3,4}[/\s]?\d{3,}[/\s]?\d{2,4}\b',  # Phone numbers
    "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
    "date_of_birth": r'\b\d{1,2}\.\d{1,2}\.\d{4}\b',  # DD.MM.YYYY
}
```

**Detection Function:**
```python
import re

def detect_pii(text: str) -> List[Dict[str, str]]:
    """Detect potential PII in user input."""
    found = []
    for pii_type, pattern in PII_PATTERNS.items():
        matches = re.findall(pattern, text)
        for match in matches:
            found.append({
                "type": pii_type,
                "value": match,
                "position": text.find(match)
            })
    return found
```

---

### G3.2: PII Response Protocol

**Rule:** When PII is detected, warn user and offer to continue safely.

**Response Template:**
```
⚠️ PRIVACY NOTICE

We detected personal information in your message:
- {detected_types}

For your protection, please avoid sharing:
- Names (your name, other parties)
- Addresses or locations  
- Case numbers or file references
- Dates of birth or personal identifiers

You can describe your situation generally without these details.
Example:
✅ "My rental agreement was terminated"
❌ "My landlord Hans Müller at Berliner Str. 123 terminated my lease"

Would you like to rephrase your question?

⚖️ This information does not constitute legal advice.
```

---

### G3.3: PII Redaction in Logs

**Rule:** Automatically redact PII from all logs and storage.

**Implementation:**
```python
def redact_pii(text: str) -> str:
    """Redact detected PII from text for logging."""
    redacted = text
    for pii_type, pattern in PII_PATTERNS.items():
        if pii_type == "name":
            redacted = re.sub(pattern, "[NAME]", redacted)
        elif pii_type == "address":
            redacted = re.sub(pattern, "[ADDRESS]", redacted)
        elif pii_type == "case_number":
            redacted = re.sub(pattern, "[CASE_NUMBER]", redacted)
        elif pii_type == "phone":
            redacted = re.sub(pattern, "[PHONE]", redacted)
        elif pii_type == "email":
            redacted = re.sub(pattern, "[EMAIL]", redacted)
        elif pii_type == "date_of_birth":
            redacted = re.sub(pattern, "[DATE_OF_BIRTH]", redacted)
    return redacted
```

---

### G3.4: Data Retention Limits

**Rule:** Limit storage of user queries and session data.

**Policy:**
| Data Type | Retention Period | Action After |
|-----------|------------------|--------------|
| User queries | Session only | Delete on session end |
| Search history | 30 minutes | Auto-clear |
| AI responses | Session only | Delete on session end |
| Logs (redacted) | 7 days | Auto-delete |
| Analytics (aggregated) | 90 days | Auto-delete |

**Implementation:**
```python
from datetime import datetime, timedelta

SESSION_EXPIRY = timedelta(minutes=30)

def cleanup_expired_sessions():
    """Remove expired session data."""
    now = datetime.now()
    for session_id, data in sessions.items():
        if now - data["last_activity"] > SESSION_EXPIRY:
            del sessions[session_id]
```

---

## Citation Integrity Guardrails

### G4.1: Source-Bound Citations

**Rule:** Only cite paragraphs explicitly provided in retrieval context.

**Verification Protocol:**
```python
def verify_citation(cited_paragraph: str, context: List[dict]) -> bool:
    """Verify that a cited paragraph exists in the retrieved context."""
    for item in context:
        context_paragraph = item.get("paragraph", "")
        # Normalize paragraph format
        context_normalized = context_paragraph.replace("§", "").replace(" ", "")
        cited_normalized = cited_paragraph.replace("§", "").replace(" ", "")
        if context_normalized == cited_normalized:
            return True
    return False

def extract_citations(text: str) -> List[str]:
    """Extract all paragraph citations from text."""
    # Match patterns like §548, BGB §548, § 548, etc.
    pattern = r'(?:BGB|StGB|GG|StPO|ZPO|VwVfG)?\s*§\s*(\d+[a-z]*)'
    matches = re.findall(pattern, text, re.IGNORECASE)
    return [f"§{m}" for m in matches]
```

---

### G4.2: Hallucination Prevention

**Rule:** Prevent AI from inventing paragraph numbers.

**Pre-Response Verification:**
```python
def sanitize_ai_response(ai_output: str, context: List[dict]) -> Tuple[str, List[str]]:
    """
    Verify and sanitize AI response to remove hallucinated citations.
    Returns: (sanitized_text, warnings)
    """
    warnings = []
    citations = extract_citations(ai_output)
    sanitized = ai_output
    
    for citation in citations:
        if not verify_citation(citation, context):
            warnings.append(f"Removed unverified citation: {citation}")
            # Replace with generic reference
            sanitized = sanitized.replace(citation, "[paragraph not found in database]")
    
    return sanitized, warnings
```

**Post-Response Logging:**
```python
def log_citation_verification(citations: List[str], context: List[dict], warnings: List[str]):
    """Log citation verification results for monitoring."""
    verified_count = sum(1 for c in citations if verify_citation(c, context))
    total_count = len(citations)
    
    indexing_logger.info(
        f"Citation verification: {verified_count}/{total_count} verified. "
        f"Warnings: {len(warnings)}"
    )
    
    if warnings:
        for warning in warnings:
            indexing_logger.warning(f"Citation warning: {warning}")
```

---

### G4.3: Fallback Responses

**Rule:** Provide appropriate responses when context is missing.

**Scenarios:**

| Scenario | Response |
|----------|----------|
| No context retrieved | "No specific laws were found in the database for this query. Try searching for: {keywords}" |
| User asks about law not in context | "The database doesn't contain that specific provision. Related topics found: {list}" |
| Citation not verified | "I found information about this topic, but the specific paragraph wasn't in the retrieved results." |
| Empty search results | "No laws matched your search. Try using German legal terms or browse by category." |

---

### G4.4: Confidence Markers

**Rule:** Indicate confidence level based on context availability.

**Implementation:**
```python
def determine_confidence(citations: List[str], context: List[dict]) -> str:
    """Determine confidence level based on citation verification."""
    if not citations:
        return "general"  # No specific citations
    
    verified = sum(1 for c in citations if verify_citation(c, context))
    total = len(citations)
    
    if verified == total:
        return "high"
    elif verified > 0:
        return "medium"
    else:
        return "low"

CONFIDENCE_MESSAGES = {
    "high": "",  # No additional message needed
    "medium": "⚠️ Some cited provisions were not found in the retrieved results.",
    "low": "⚠️ Specific provisions could not be verified in the database.",
    "general": "ℹ️ This is general legal information, not tied to specific paragraphs."
}
```

---

## Enforcement Mechanisms

### G5.1: Pre-Response Validation

**Rule:** Validate all AI responses before displaying to user.

**Validation Pipeline:**
```python
def validate_ai_response(response: str, context: List[dict], user_query: str) -> Dict:
    """Complete validation pipeline for AI responses."""
    result = {
        "valid": True,
        "sanitized_response": response,
        "warnings": [],
        "errors": [],
        "disclaimer_injected": False
    }
    
    # 1. Check for PII in response
    if detect_pii(response):
        result["warnings"].append("PII detected in response")
    
    # 2. Verify citations
    sanitized, citation_warnings = sanitize_ai_response(response, context)
    result["sanitized_response"] = sanitized
    result["warnings"].extend(citation_warnings)
    
    # 3. Check for disclaimer
    if "⚖️" not in response and "legal advice" not in response.lower():
        result["sanitized_response"] = inject_disclaimer(sanitized)
        result["disclaimer_injected"] = True
    
    # 4. Check for prohibited content
    prohibited = check_prohibited_content(response)
    if prohibited:
        result["errors"].append(f"Prohibited content: {prohibited}")
        result["valid"] = False
    
    return result
```

---

### G5.2: Rate Limiting for AI Features

**Rule:** Limit AI requests to prevent abuse.

**Configuration:**
```python
AI_RATE_LIMITS = {
    "law_explanation": {"max_calls": 10, "per_seconds": 60},
    "legal_analysis": {"max_calls": 5, "per_seconds": 60},
    "translation": {"max_calls": 20, "per_seconds": 60},
}
```

**Response on Limit:**
```
⚠️ AI Feature Rate Limited

You've reached the limit for AI features ({limit} requests per minute).

Please wait {retry_after} seconds before trying again.

You can still:
- Browse search results manually
- Use keyword search
- Browse by category

⚖️ This information does not constitute legal advice.
```

---

### G5.3: Error Handling

**Rule:** Graceful degradation when guardrails fail.

**Error Scenarios:**

| Error | Fallback Action |
|-------|-----------------|
| AI service unavailable | Show search results only |
| Citation verification fails | Remove citations, add warning |
| PII detection error | Show generic privacy warning |
| Disclaimer injection fails | Prepend warning to response |
| Timeout | Show timeout message with suggestions |

---

### G5.4: Audit Logging

**Rule:** Log all guardrail triggers for monitoring.

**Log Format:**
```json
{
    "timestamp": "2026-02-25T10:30:00Z",
    "session_id": "abc123",
    "guardrail_triggered": "citation_verification",
    "action_taken": "removed_unverified_citation",
    "original_citation": "§999",
    "context_paragraphs": ["§548", "§549"],
    "user_query_hash": "sha256_hash"
}
```

---

## Guardrail Compliance Checklist

Before deploying any AI feature, verify:

- [ ] Disclaimer injection implemented
- [ ] PII detection active
- [ ] Citation verification enabled
- [ ] Rate limiting configured
- [ ] Error handling in place
- [ ] Audit logging active
- [ ] Fallback responses defined
- [ ] Prohibited content filtering enabled

---

## Document Information

**Document Version:** 1.0  
**Last Updated:** 2026-02-25  
**Maintained By:** German Law Vault Development Team  
**Review Schedule:** Monthly
