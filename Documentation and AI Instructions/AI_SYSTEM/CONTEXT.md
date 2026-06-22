# Context Management for German Law Vault AI

## Table of Contents

1. [Session Context](#session-context)
2. [Law Version Tracking](#law-version-tracking)
3. [User Context](#user-context)
4. [Retrieval Context](#retrieval-context)
5. [Context Injection](#context-injection)

---

## Session Context

### SC1: Session Data Structure

**Maintain per-session context:**

```python
@dataclass
class SessionContext:
    session_id: str
    created_at: datetime
    last_activity: datetime
    
    # Query history (last 5)
    query_history: List[Dict]  # [{query, timestamp, language, results_count}]
    
    # Viewed laws (last 3)
    viewed_laws: List[Dict]  # [{law_id, paragraph, timestamp}]
    
    # User preferences
    language_preference: str  # 'en' or 'de'
    category_filter: Optional[str]  # Current category selection
    
    # Active focus
    active_law_codes: List[str]  # Currently focused law codes (e.g., ['BGB', 'StGB'])
    
    # AI interaction state
    ai_enabled: bool
    clarification_pending: bool
    
    def is_expired(self, timeout: timedelta = timedelta(minutes=30)) -> bool:
        return datetime.now() - self.last_activity > timeout
```

---

### SC2: Context Lifecycle

**Session lifecycle management:**

```python
SESSION_TIMEOUT = timedelta(minutes=30)
QUERY_HISTORY_LIMIT = 5
VIEWED_LAWS_LIMIT = 3

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, SessionContext] = {}
        self.cleanup_interval = timedelta(minutes=5)
        self.last_cleanup = datetime.now()
    
    def get_or_create(self, session_id: str) -> SessionContext:
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionContext(
                session_id=session_id,
                created_at=datetime.now(),
                last_activity=datetime.now(),
                query_history=[],
                viewed_laws=[],
                language_preference='de',  # Default to German
                category_filter=None,
                active_law_codes=[],
                ai_enabled=True,
                clarification_pending=False
            )
        else:
            session = self.sessions[session_id]
            session.last_activity = datetime.now()
        return self.sessions[session_id]
    
    def add_query(self, session_id: str, query: str, results_count: int):
        session = self.get_or_create(session_id)
        session.query_history.append({
            "query": query,
            "timestamp": datetime.now(),
            "language": detect_language(query),
            "results_count": results_count
        })
        # Keep only last N queries
        session.query_history = session.query_history[-QUERY_HISTORY_LIMIT:]
    
    def add_viewed_law(self, session_id: str, law_id: str, paragraph: str):
        session = self.get_or_create(session_id)
        session.viewed_laws.append({
            "law_id": law_id,
            "paragraph": paragraph,
            "timestamp": datetime.now()
        })
        # Keep only last N viewed laws
        session.viewed_laws = session.viewed_laws[-VIEWED_LAWS_LIMIT:]
    
    def cleanup_expired(self):
        now = datetime.now()
        expired = [
            sid for sid, ctx in self.sessions.items()
            if now - ctx.last_activity > SESSION_TIMEOUT
        ]
        for sid in expired:
            del self.sessions[sid]
```

---

### SC3: Context Expiration

**Automatic cleanup policy:**

| Data Type | Expiration | Trigger |
|-----------|------------|---------|
| Session | 30 minutes | Inactivity |
| Query history | 5 queries | Rolling window |
| Viewed laws | 3 laws | Rolling window |
| Search results cache | 15 minutes | TTL |
| AI response cache | 1 hour | TTL |

---

## Law Version Tracking

### VT1: Metadata Structure

**Every law retrieval must include version metadata:**

```python
@dataclass
class LawMetadata:
    law_id: str  # e.g., 'bgb'
    paragraph: str  # e.g., '§548'
    content: str  # Paragraph text
    
    # Version information
    last_changed: str  # ISO date: '2024-03-15'
    status: str  # 'in_force' | 'amended' | 'repealed'
    repealed_date: Optional[str]  # ISO date if repealed
    
    # Source information
    source_url: str  # Original law URL
    xml_version: str  # XML version from source
    
    def is_stale(self, threshold_years: int = 2) -> bool:
        """Check if law version is potentially outdated."""
        if not self.last_changed:
            return True
        change_date = datetime.fromisoformat(self.last_changed)
        age = datetime.now() - change_date
        return age > timedelta(days=threshold_years * 365)
    
    def get_staleness_warning(self) -> Optional[str]:
        """Generate warning if law is potentially outdated."""
        if self.status == 'repealed':
            return f"⚠️ This law is no longer in force. It was repealed on {self.repealed_date}."
        elif self.is_stale(2):
            return f"⚠️ This law version is from {self.last_changed}. Amendments may have occurred. Verify current version."
        elif self.is_stale(1):
            return f"ℹ️ This law version is from {self.last_changed}."
        return None
```

---

### VT2: Version Injection in Prompts

**Always inject metadata into AI prompts:**

```python
def prepare_law_context(law_result: dict) -> dict:
    """Prepare law context with version metadata for AI."""
    meta = law_result.get('meta', {})
    return {
        "law_name": law_result.get("law_id", "Unknown").upper(),
        "paragraph": law_result.get("paragraph", ""),
        "paragraph_text": law_result.get("content", ""),
        "last_updated": meta.get("last_changed", "unknown"),
        "status": meta.get("status", "in_force"),
        "repealed_date": meta.get("repealed_date"),
        "source_url": law_result.get("source_url", ""),
    }

def build_law_explanation_prompt(law_result: dict, user_query: str) -> str:
    """Build complete prompt with version awareness."""
    context = prepare_law_context(law_result)
    
    prompt = LAW_EXPLANATION_TEMPLATE.format(**context, user_query=user_query)
    
    # Add version warning if applicable
    meta = LawMetadata(
        law_id=law_result.get('law_id', ''),
        paragraph=law_result.get('paragraph', ''),
        content=law_result.get('content', ''),
        last_changed=context['last_updated'],
        status=context['status'],
        repealed_date=context['repealed_date']
    )
    
    warning = meta.get_staleness_warning()
    if warning:
        prompt = f"{prompt}\n\n{warning}"
    
    return prompt
```

---

### VT3: Version Display in UI

**Show version information to users:**

```html
<div class="law-version-info">
    <span class="version-badge {status_class}">
        {status_icon} {status_text}
    </span>
    <span class="version-date" title="Last changed">
        📅 Last updated: {last_changed_formatted}
    </span>
    {staleness_warning_html}
</div>
```

**CSS Styling:**
```css
.version-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 600;
}

.version-badge.in-force {
    background: #d4edda;
    color: #155724;
}

.version-badge.amended {
    background: #fff3cd;
    color: #856404;
}

.version-badge.repealed {
    background: #f8d7da;
    color: #721c24;
}

.staleness-warning {
    background: #fff3cd;
    border-left: 4px solid #ffc107;
    padding: 8px 12px;
    margin-top: 8px;
    font-size: 0.9em;
}
```

---

## User Context

### UC1: Language Preference

**Detect and respect user's language choice:**

```python
class LanguagePreference:
    def __init__(self, session: SessionContext):
        self.session = session
    
    def detect_from_query(self, query: str) -> str:
        """Detect language from query text."""
        return detect_language(query)
    
    def get_response_language(self, query: str) -> str:
        """Determine response language."""
        # Use explicit preference if set
        if self.session.language_preference:
            return self.session.language_preference
        # Otherwise match query language
        return self.detect_from_query(query)
    
    def set_preference(self, language: str):
        """Set explicit language preference."""
        self.session.language_preference = language
```

---

### UC2: Category Context

**Track user's category browsing:**

```python
CATEGORY_CONTEXT = {
    "housing": {
        "title": "Wohnen & Miete",
        "icon": "🏠",
        "typical_law_codes": ["BGB"],
        "keywords": ["miet", "wohnung", "kaution"]
    },
    "employment": {
        "title": "Arbeit & Beruf",
        "icon": "💼",
        "typical_law_codes": ["BGB"],
        "keywords": ["arbeit", "kündigung", "lohn"]
    },
    # ... more categories
}

def get_category_context(category: str) -> dict:
    """Get context for a category."""
    return CATEGORY_CONTEXT.get(category, {})

def suggest_law_codes_for_category(category: str) -> List[str]:
    """Suggest relevant law codes for category."""
    ctx = get_category_context(category)
    return ctx.get("typical_law_codes", [])
```

---

### UC3: Query Context

**Maintain query context for follow-ups:**

```python
@dataclass
class QueryContext:
    original_query: str
    translated_query: Optional[str]
    detected_language: str
    detected_category: str
    search_results: List[dict]
    timestamp: datetime
    
    def is_related_to(self, new_query: str) -> bool:
        """Check if new query is related to this context."""
        # Simple keyword overlap check
        original_words = set(self.original_query.lower().split())
        new_words = set(new_query.lower().split())
        overlap = original_words & new_words
        return len(overlap) >= 2  # At least 2 common words
```

---

## Retrieval Context

### RC1: Context Assembly

**Assemble retrieval context for AI:**

```python
def assemble_retrieval_context(
    search_results: List[dict],
    max_paragraphs: int = 5
) -> List[dict]:
    """
    Assemble retrieval context for AI citation.
    Returns list of paragraphs that AI may cite.
    """
    context = []
    for result in search_results[:max_paragraphs]:
        context.append({
            "law_id": result.get("law_id"),
            "paragraph": result.get("paragraph"),
            "content": result.get("content"),
            "relevance_score": result.get("score", 0.0),
            "meta": {
                "last_changed": result.get("meta", {}).get("last_changed"),
                "status": result.get("meta", {}).get("status", "in_force")
            }
        })
    return context
```

---

### RC2: Context Size Limits

**Limit context to prevent token overflow:**

```python
MAX_CONTEXT_PARAGRAPHS = 5
MAX_CONTEXT_TOKENS = 2000

def estimate_tokens(text: str) -> int:
    """Estimate token count (rough approximation)."""
    # German words average ~5 characters
    # Tokens average ~4 characters
    return len(text) // 4

def trim_context_to_limits(context: List[dict]) -> List[dict]:
    """Trim context to stay within limits."""
    if len(context) > MAX_CONTEXT_PARAGRAPHS:
        context = context[:MAX_CONTEXT_PARAGRAPHS]
    
    # Check token limit
    total_tokens = sum(
        estimate_tokens(item.get("content", ""))
        for item in context
    )
    
    if total_tokens > MAX_CONTEXT_TOKENS:
        # Remove least relevant items
        context.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        trimmed = []
        current_tokens = 0
        for item in context:
            item_tokens = estimate_tokens(item.get("content", ""))
            if current_tokens + item_tokens <= MAX_CONTEXT_TOKENS:
                trimmed.append(item)
                current_tokens += item_tokens
        context = trimmed
    
    return context
```

---

### RC3: Context Relevance Scoring

**Score context items by relevance:**

```python
def score_context_relevance(
    context: List[dict],
    query: str,
    query_keywords: List[str]
) -> List[dict]:
    """Score and sort context by relevance to query."""
    for item in context:
        content = item.get("content", "").lower()
        law_id = item.get("law_id", "").lower()
        paragraph = item.get("paragraph", "").lower()
        
        score = 0.0
        
        # Keyword matches in content
        for kw in query_keywords:
            if kw.lower() in content:
                score += 1.0
        
        # Law code match
        if law_id in query.lower():
            score += 2.0
        
        # Paragraph number match
        if paragraph in query.lower():
            score += 3.0
        
        item["relevance_score"] = score
    
    context.sort(key=lambda x: x["relevance_score"], reverse=True)
    return context
```

---

## Context Injection

### CI1: Prompt Context Injection

**Inject context into AI prompts:**

```python
SYSTEM_PROMPT_TEMPLATE = """
You are the German Law Vault AI Assistant.

RETRIEVED CONTEXT (Your ONLY source for citations):
{retrieved_context_json}

USER QUERY: {user_query}
QUERY LANGUAGE: {query_language}
DETECTED CATEGORY: {category}

RULES:
1. You may ONLY cite paragraphs that appear in the RETRIEVED CONTEXT above
2. If a paragraph is not in context, say "Not found in database"
3. Verify every paragraph number before citing
4. If context is empty, say "No relevant laws found. Try different keywords."
5. Check LAST_UPDATED dates and warn if law is older than 2 years
6. Include legal disclaimer at the end

Respond in {response_language}.
"""

def inject_context_into_prompt(
    user_query: str,
    search_results: List[dict],
    session: SessionContext
) -> str:
    """Build complete prompt with all context."""
    # Assemble retrieval context
    context = assemble_retrieval_context(search_results)
    context = trim_context_to_limits(context)
    
    # Detect language
    query_lang = detect_language(user_query)
    response_lang = session.language_preference or query_lang
    
    # Detect category
    category = detect_category(user_query)
    
    # Format context as JSON
    context_json = json.dumps(context, ensure_ascii=False, indent=2)
    
    # Build prompt
    prompt = SYSTEM_PROMPT_TEMPLATE.format(
        retrieved_context_json=context_json,
        user_query=user_query,
        query_language=query_lang,
        category=category,
        response_lang=response_lang
    )
    
    return prompt
```

---

### CI2: Context Validation

**Validate context before injection:**

```python
def validate_context(context: List[dict]) -> Tuple[bool, List[str]]:
    """
    Validate context for completeness and safety.
    Returns: (is_valid, warnings)
    """
    warnings = []
    
    if not context:
        warnings.append("Empty context - AI will have no citations available")
        return True, warnings  # Not an error, but worth noting
    
    for i, item in enumerate(context):
        # Check required fields
        if not item.get("paragraph"):
            warnings.append(f"Item {i}: Missing paragraph number")
        if not item.get("content"):
            warnings.append(f"Item {i}: Missing content")
        
        # Check metadata
        meta = item.get("meta", {})
        if not meta.get("last_changed"):
            warnings.append(f"Item {i}: Missing last_changed date")
        
        # Check for PII in content (shouldn't happen, but verify)
        if detect_pii(item.get("content", "")):
            warnings.append(f"Item {i}: Potential PII detected in content")
    
    return len(warnings) == 0, warnings
```

---

### CI3: Context Logging

**Log context for debugging:**

```python
def log_context_injection(
    session_id: str,
    query: str,
    context: List[dict],
    prompt_tokens: int
):
    """Log context injection for debugging and monitoring."""
    ai_logger.info(
        f"Context injection for session {session_id}",
        extra={
            "query_hash": hash(query),
            "context_size": len(context),
            "prompt_tokens": prompt_tokens,
            "paragraphs": [
                {"law": c.get("law_id"), "para": c.get("paragraph")}
                for c in context
            ],
            "timestamp": datetime.now().isoformat()
        }
    )
```

---

## Document Information

**Document Version:** 1.0  
**Last Updated:** 2026-02-25  
**Maintained By:** German Law Vault Development Team  
**Review Schedule:** Monthly
