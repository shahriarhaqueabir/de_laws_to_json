# AI Guidelines for German Law Vault

## Table of Contents

1. [Response Quality Standards](#response-quality-standards)
2. [Error Handling Guidelines](#error-handling-guidelines)
3. [Caching & Performance](#caching--performance)
4. [User Experience Guidelines](#user-experience-guidelines)
5. [Language Guidelines](#language-guidelines)

---

## Response Quality Standards

### Q1: Quality Checklist

**Every AI response must pass this checklist:**

| Criterion | Description | Verification Method |
|-----------|-------------|---------------------|
| **Accuracy** | Information matches current law version | Check against LAST_UPDATED metadata |
| **Citation Integrity** | All cited paragraphs exist in retrieved context | Citation verification function |
| **Version Awareness** | LAST_UPDATED metadata checked and noted if stale | Version warning injection |
| **Clarity** | Understandable by layperson (Grade 10 reading level) | Readability check |
| **Completeness** | Addresses all parts of query | Query-response matching |
| **Brevity** | Concise, under 300 words for explanations | Word count check |
| **Disclaimer** | Includes legal disclaimer | String matching |
| **Language Match** | Matches user's language preference | Language detection |
| **PII Safety** | No personal data requested or stored | PII detection scan |

---

### Q2: Quality Scoring

**Automated quality scoring for each response:**

```python
@dataclass
class QualityScore:
    accuracy: float  # 0.0 - 1.0
    citation_integrity: float  # 0.0 - 1.0
    clarity: float  # 0.0 - 1.0
    completeness: float  # 0.0 - 1.0
    disclaimer_present: bool
    overall: float  # Calculated average
    
    def is_acceptable(self) -> bool:
        return (
            self.overall >= 0.7 and
            self.citation_integrity >= 0.8 and
            self.disclaimer_present
        )
```

**Thresholds:**
- **Excellent:** ≥ 0.9 - Log for training examples
- **Good:** ≥ 0.7 - Acceptable for display
- **Poor:** < 0.7 - Flag for review, show fallback

---

### Q3: Response Length Guidelines

| Response Type | Target Length | Maximum |
|---------------|---------------|---------|
| Law explanation | 150-200 words | 300 words |
| Query translation | 50-100 words | 150 words |
| Legal analysis | 200-250 words | 400 words |
| Search explanation | 50-75 words | 100 words |
| Error message | 25-50 words | 75 words |
| Clarification request | 75-100 words | 150 words |

---

### Q4: Readability Standards

**Target Reading Level:** Grade 10 (ages 15-16)

**Guidelines:**
- Use short sentences (average 15-20 words)
- Avoid complex subordinate clauses
- Define legal terms on first use
- Use active voice where possible
- Break complex topics into bullet points

**Example:**
```
❌ Complex: "Der Vermieter, welcher die Mietsache dem Mieter überlassen hat, 
   ist, sofern nicht eine andere Vereinbarung getroffen wurde, verpflichtet, 
   die bei Beendigung des Mietverhältnisses zurückgegebene Kaution zurückzuzahlen."

✅ Simple: "Der Vermieter muss Ihre Kaution zurückzahlen. Dies gilt, 
   wenn Sie die Wohnung zurückgegeben haben. Es sei denn, Sie haben 
   etwas anderes vereinbart."
```

---

## Error Handling Guidelines

### E1: Error Categories

| Category | Examples | Response Strategy |
|----------|----------|-------------------|
| **Service Errors** | AI unavailable, timeout | Graceful degradation |
| **Content Errors** | No results found, empty context | Helpful suggestions |
| **User Errors** | Ambiguous query, PII detected | Educational guidance |
| **System Errors** | Database error, index corruption | Technical fallback |

---

### E2: Error Response Templates

#### Service Unavailable
```
AI features are currently unavailable.

What you can still do:
✓ Search laws using German keywords
✓ Browse by category
✓ View search results

The AI will be back shortly.

⚖️ This information does not constitute legal advice.
```

---

#### Timeout
```
Analysis is taking longer than expected.

This may be due to:
- High server load
- Complex query
- Network issues

Try these alternatives:
1. Simplify your query
2. Use German keywords
3. Search by category
4. Try again in a few moments

⚖️ This information does not constitute legal advice.
```

---

#### No Results Found
```
No laws matched your search for: "{query}"

Suggestions:
- Try different keywords
- Use German legal terms
- Check spelling
- Browse by category

Popular searches:
- "Kaution" (deposit)
- "Kündigung" (termination)
- "Miete" (rent)

⚖️ This information does not constitute legal advice.
```

---

#### Ambiguous Query
```
Your query could relate to multiple legal areas:

1. 🏠 Housing Law (Mietrecht)
   Example: Rental agreements, deposits, eviction

2. 💼 Employment Law (Arbeitsrecht)
   Example: Employment contracts, termination, wages

3. 📋 Contract Law (Vertragsrecht)
   Example: General contracts, consumer rights

Please clarify which area applies to your situation.

⚠️ When clarifying, do NOT provide names, addresses, or case numbers.

⚖️ This information does not constitute legal advice.
```

---

### E3: Error Logging

**Log all errors with context:**

```python
def log_error(error_type: str, error_details: dict, user_context: dict):
    """Log error with full context for debugging."""
    error_logger.error(
        f"AI Error: {error_type}",
        extra={
            "error_details": error_details,
            "user_context": {
                "query_hash": hash(user_context.get("query", "")),
                "session_id": user_context.get("session_id"),
                "timestamp": datetime.now().isoformat()
            },
            "guardrails_triggered": user_context.get("guardrails", [])
        }
    )
```

---

### E4: Cascading Fallbacks

**Fallback chain when primary method fails:**

```
AI Analysis → Dictionary Lookup → Keyword Search → Category Browse
     ↓              ↓                    ↓                ↓
  (Primary)    (Fallback 1)        (Fallback 2)      (Fallback 3)
```

**Implementation:**
```python
def get_response_with_fallback(query: str) -> str:
    """Try multiple methods to get response."""
    # Try AI analysis first
    try:
        response = ai_analyze(query)
        if validate_response(response):
            return response
    except Exception as e:
        logger.warning(f"AI analysis failed: {e}")
    
    # Fallback 1: Dictionary lookup
    try:
        response = dictionary_lookup(query)
        if response:
            return response
    except Exception as e:
        logger.warning(f"Dictionary lookup failed: {e}")
    
    # Fallback 2: Keyword search
    try:
        response = keyword_search(query)
        if response:
            return response
    except Exception as e:
        logger.warning(f"Keyword search failed: {e}")
    
    # Fallback 3: Category browse suggestion
    return suggest_category_browse()
```

---

## Caching & Performance

### P1: Cache Configuration

| Cache Type | TTL | Max Size | Eviction Policy |
|------------|-----|----------|-----------------|
| Query translation | 24 hours | 1000 entries | LRU |
| Law explanation | 1 hour | 500 entries | LRU |
| Search results | 15 minutes | 200 entries | LRU |
| Dictionary lookup | 24 hours | 2000 entries | LRU |

---

### P2: Performance Targets

| Metric | Target | Maximum |
|--------|--------|---------|
| AI response time | < 3 seconds | 5 seconds |
| Translation time | < 1 second | 2 seconds |
| Search time | < 500ms | 1 second |
| Page load time | < 2 seconds | 4 seconds |

---

### P3: Cache Implementation

```python
from functools import lru_cache
from datetime import datetime, timedelta

class TranslationCache:
    def __init__(self, max_size: int = 1000, ttl_hours: int = 24):
        self.cache: OrderedDict = OrderedDict()
        self.max_size = max_size
        self.ttl = timedelta(hours=ttl_hours)
    
    def get(self, key: str) -> Optional[str]:
        if key in self.cache:
            entry = self.cache[key]
            if datetime.now() - entry["timestamp"] < self.ttl:
                # Move to end (most recently used)
                self.cache.move_to_end(key)
                return entry["value"]
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value: str):
        if key in self.cache:
            del self.cache[key]
        elif len(self.cache) >= self.max_size:
            # Remove oldest (least recently used)
            self.cache.popitem(last=False)
        self.cache[key] = {
            "value": value,
            "timestamp": datetime.now()
        }
```

---

### P4: Rate Limiting

**Per-endpoint rate limits:**

```python
RATE_LIMITS = {
    "/api/ai/explain": {
        "max_requests": 10,
        "window_seconds": 60,
        "message": "AI explanation limit reached. Please wait {retry_after} seconds."
    },
    "/api/ai/analyze": {
        "max_requests": 5,
        "window_seconds": 60,
        "message": "AI analysis limit reached. Please wait {retry_after} seconds."
    },
    "/api/ai/translate": {
        "max_requests": 20,
        "window_seconds": 60,
        "message": "Translation limit reached. Please wait {retry_after} seconds."
    }
}
```

---

## User Experience Guidelines

### U1: Response Formatting

**Consistent formatting for all responses:**

```markdown
[Emoji] **Brief Summary** (1 sentence)

Detailed explanation in 2-3 paragraphs.

**Key Points:**
- Bullet point 1
- Bullet point 2
- Bullet point 3

⚖️ Disclaimer
```

---

### U2: Progressive Disclosure

**Show information in layers:**

1. **Summary** (always shown)
2. **Details** (expandable)
3. **Full law text** (link to expand)
4. **Related laws** (collapsible section)

**Implementation:**
```html
<div class="ai-response">
    <div class="summary">
        <span class="icon">⚖️</span>
        <p>Brief summary...</p>
    </div>
    <details class="details">
        <summary>Show detailed explanation</summary>
        <p>Detailed content...</p>
    </details>
    <div class="disclaimer">
        ⚖️ This information does not constitute legal advice.
    </div>
</div>
```

---

### U3: Visual Indicators

**Use consistent visual cues:**

| Indicator | Meaning | Emoji |
|-----------|---------|-------|
| Info | General information | ℹ️ |
| Warning | Important notice | ⚠️ |
| Success | Operation completed | ✅ |
| Error | Problem occurred | ❌ |
| Legal | Legal disclaimer | ⚖️ |
| Time | Version/date notice | 📅 |
| Search | Search suggestion | 🔍 |
| Category | Category indicator | 📁 |

---

### U4: Interaction Patterns

**Best practices for AI interactions:**

1. **Acknowledge the query**
   - "I understand you're asking about..."

2. **Provide structured response**
   - Use headings, bullet points

3. **Offer next steps**
   - "You might also want to know..."
   - "Related topics: ..."

4. **Invite clarification**
   - "Would you like more details on...?"

5. **Respect user's time**
   - Keep responses concise
   - Offer to expand if needed

---

## Language Guidelines

### L1: Language Detection

**Detect and match user's language:**

```python
def detect_language(text: str) -> str:
    """Detect if query is German or English."""
    german_indicators = [
        "der", "die", "das", "und", "ist", "sind",
        "ich", "mein", "mein", "haben", "wird"
    ]
    english_indicators = [
        "the", "and", "is", "are", "i", "my", "have", "will"
    ]
    
    words = text.lower().split()
    german_count = sum(1 for w in words if w in german_indicators)
    english_count = sum(1 for w in words if w in english_indicators)
    
    return "de" if german_count >= english_count else "en"
```

---

### L2: Response Language

**Match response language to query:**

| Query Language | Response Language | Legal Terms |
|----------------|-------------------|-------------|
| German | German | German only |
| English | English | German + English in parentheses |

**Example:**
```
Query (EN): "My landlord won't return my deposit"
Response: "Your landlord (Vermieter) must return your deposit (Kaution) 
           under BGB §548..."

Query (DE): "Mein Vermieter zahlt die Kaution nicht zurück"
Response: "Ihr Vermieter muss die Kaution gemäß BGB §548 zurückzahlen..."
```

---

### L3: Legal Terminology

**Consistent use of legal terms:**

1. **Always use official German terms**
   - "Kündigung" not "Beendigung" for termination notice

2. **Provide English equivalents for English queries**
   - "Kündigung (notice of termination)"

3. **Reference False Friends table**
   - See FALSE_FRIENDS.md for accurate translations

4. **Explain abbreviations on first use**
   - "BGB (Bürgerliches Gesetzbuch - Civil Code)"

---

### L4: Tone and Style

**Appropriate tone for legal information:**

| Aspect | Guideline | Example |
|--------|-----------|---------|
| Formality | Semi-formal | "Sie" form in German, neutral in English |
| Empathy | Acknowledge concern | "We understand this is concerning..." |
| Clarity | Simple language | Avoid legalese where possible |
| Neutrality | No taking sides | Present facts, not opinions |
| Confidence | Appropriate certainty | "may", "typically" not "will" |

---

### L5: Multilingual Considerations

**Handle mixed-language queries:**

```
Query: "I need help with my Kündigung"
Response: "I understand you need help with your Kündigung (notice of termination)..."
```

**Strategy:**
1. Detect primary language
2. Respond in primary language
3. Keep German legal terms
4. Provide translations in parentheses

---

## Document Information

**Document Version:** 1.0  
**Last Updated:** 2026-02-25  
**Maintained By:** German Law Vault Development Team  
**Review Schedule:** Monthly
