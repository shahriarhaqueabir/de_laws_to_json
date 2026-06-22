# Fast Translate Feature - Technical Analysis

**Endpoint:** `POST /api/fast_translate`  
**Purpose:** Instant dictionary-based German→English translation (no AI)  
**Use Case:** DE/EN toggle buttons in the UI  
**Response Time:** < 50ms (when working correctly)

---

## Request/Response

### Request
```json
POST /api/fast_translate
Content-Type: application/json

{
  "text": "Kündigung",
  "is_title": false
}
```

### Response
```json
{
  "translation": "termination",
  "is_final": true
}
```

**Response Fields:**
- `translation`: The English translation (or original German if no match)
- `is_final`: 
  - `true` = Dictionary found a confident translation
  - `false` = No match found, UI should keep German text

---

## Translation Pipeline (5 Steps)

The function uses a **cascading fallback strategy** - tries fastest methods first, falls back to more comprehensive (slower) methods.

```
┌─────────────────────────────────────────────────────────────┐
│  FAST TRANSLATE PIPELINE                                    │
├─────────────────────────────────────────────────────────────┤
│  Step 1: AI Cache Check          → Instant (if hit)         │
│  Step 2: FRAGMENT_MAP Lookup     → ~1ms                     │
│  Step 3: Full Phrase Dictionary  → ~10-20ms                 │
│  Step 4: Word-by-Word Substitution → ~50-100ms              │
│  Step 5: No Match (return German) → Instant                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: AI Cache Check

**Purpose:** Check if this text was previously translated by AI

```python
with _translation_lock:
    if text in _translation_cache:
        return jsonify({"translation": _translation_cache[text], "is_final": True})
```

**Cache Source:** Populated by:
- Previous `/api/ai_translate` calls
- Background pre-warming of popular law titles
- User interactions

**Example:**
```
Cache contains: "Kündigung" → "termination"
Request: "Kündigung"
Result: Instant return "termination"
```

---

## Step 2: FRAGMENT_MAP Lookup

**Purpose:** Handle legal abbreviations and jargon

**Location:** `app.py` lines 225-265

**What it contains:**
```python
FRAGMENT_MAP = {
    # Core Laws
    "bgb": "Civil Code",
    "stgb": "Criminal Code",
    "gg": "Basic Law (Constitution)",
    
    # Structure
    "abs.": "Para.",
    "s.": "Sent.",
    "nr.": "No.",
    
    # Validity
    "in kraft": "in force",
    "außer kraft": "no longer in force",
    
    # Modal verbs
    "muss": "must",
    "darf": "may",
    
    # Procedural
    "urt.": "Judgment",
    "beschl.": "Court order",
}
```

**Pattern Matching:**
```python
# Handles "BGB", "Abs. 1", "§ 123" etc.
fragment_pattern = re.match(r"^([A-Za-z\.]+)\s*(\d*[a-z]?)$", text_lower)
```

**Examples:**
| Input | Match | Output |
|-------|-------|--------|
| `bgb` | Direct | `Civil Code` |
| `abs.` | Direct | `Para.` |
| `abs. 1` | Pattern | `Para. 1` |
| `BGB` | Pattern (case-insensitive) | `Civil Code` |

---

## Step 3: Full Phrase Dictionary Lookup

**Purpose:** Handle complete German legal terms

**Implementation:**
```python
if legal_dict:
    results = legal_dict.get_translations(text, limit=1)
    if results and (results[0]["source"] == "legal_priority" or is_title):
        trans = results[0]["english"]
        if trans.lower() != text.lower():
            return jsonify({"translation": trans})
```

**Dictionary Source:** `dictionary/legal_dict.py`

**Query Types:**
1. **Legal Priority Terms** (highest priority)
   - From `legal_priority_terms` table
   - Curated legal terminology
   - Example: "Kündigung" → "termination"

2. **Main Dictionary** 
   - From `de_en_dictionary` table
   - 100,000+ entries
   - Example: "Miete" → "rent"

3. **Prefix Match** (if exact not found)
   - Finds words starting with input
   - Example: "mieter" → "tenant" (from "Mieter")

4. **Compound Decomposition** (for long words)
   - Breaks compound German words
   - Example: "Kündigungsschutz" → "termination" + "protection"

**Example Flow:**
```
Input: "Kündigung"
1. Check cache → Miss
2. Check FRAGMENT_MAP → No match
3. Query dictionary → Found!
   Source: legal_priority
   Result: "termination" (frequency: 90)
Return: {"translation": "termination", "is_final": true}
```

---

## Step 4: Word-by-Word Substitution

**Purpose:** Translate full sentences/paragraphs

**Algorithm:**
```python
# 1. Split text preserving whitespace
tokens = re.split(r"(\s+)", text)
# "Der Vermieter" → ["Der", " ", "Vermieter"]

# 2. For each token:
for token in tokens:
    # Extract word core (remove punctuation)
    m = re.fullmatch(r"([^\w]*)([\w\-äöüÄÖÜß]+)([^\w]*)", token)
    lead, core, trail = m.groups()
    
    # Try FRAGMENT_MAP
    if core.lower() in FRAGMENT_MAP:
        frag = _match_case(core, FRAGMENT_MAP[core.lower()])
        out_tokens.append(lead + frag + trail)
        continue
    
    # Try dictionary
    hits = legal_dict.get_translations(core, limit=1)
    if hits:
        out_tokens.append(lead + _match_case(core, hits[0]["english"]) + trail)
        continue
    
    # No match - keep original
    out_tokens.append(token)

# 3. Join tokens back
return "".join(out_tokens)
```

**Case Matching:**
```python
def _match_case(original: str, replacement: str) -> str:
    if original.isupper():
        return replacement.upper()
    if original.istitle() or original[0].isupper():
        return replacement.capitalize()
    return replacement.lower()
```

**Example:**
```
Input: "Der Vermieter muss zahlen"

Token processing:
"Der"   → No match → "Der"
" "     → Whitespace → " "
"Vermieter" → Dictionary → "landlord" (case preserved)
" "     → Whitespace → " "
"muss"  → FRAGMENT_MAP → "must"
" "     → Whitespace → " "
"zahlen" → No match → "zahlen"

Output: "Der landlord must zahlen"
```

---

## Step 5: No Match Fallback

**Purpose:** Signal to frontend that translation failed

```python
return jsonify({"translation": text, "is_final": False})
```

**Frontend Behavior:**
- `is_final: false` → Keep German text displayed
- DE/EN toggle buttons revert to German
- User sees original text (not broken translation)

---

## Performance Characteristics

| Step | Avg Time | Cache Hit | Memory |
|------|----------|-----------|--------|
| 1. AI Cache | <1ms | ~30% | In-memory dict |
| 2. FRAGMENT_MAP | ~1ms | N/A | Static dict |
| 3. Dictionary | 10-50ms | ~60% | SQLite + LRU cache |
| 4. Word-by-word | 50-200ms | N/A | Multiple DB queries |
| 5. No match | <1ms | N/A | None |

**Typical Performance:**
- Single word: 10-20ms
- Short phrase: 20-50ms
- Full sentence: 50-200ms

---

## Current Issues

### SQLite Locking Problem

**Symptom:** Translation requests hang indefinitely

**Root Cause:** Thread-local SQLite connections not properly isolated in Flask's threaded mode

**Code Path:**
```
Flask Thread 1 → legal_dict.get_translations() → _get_connection() → SQLite query
Flask Thread 2 → legal_dict.get_translations() → _get_connection() → SQLite query
                                                            ↓
                                           DATABASE LOCKED! (both wait forever)
```

**Attempted Fixes:**
1. ✅ Thread-local storage (`threading.local()`)
2. ✅ WAL mode (`PRAGMA journal_mode=WAL`)
3. ✅ Increased timeout (`PRAGMA busy_timeout=30000`)
4. ✅ Removed global locks

**Workaround:** Restart server to clear stuck connections

---

## Integration with Frontend

### JavaScript Call (translation.js)
```javascript
async function callFastTranslate(text, is_title) {
  const resp = await fetch("/api/fast_translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, is_title })
  });
  
  const data = await resp.json();
  
  if (data.is_final) {
    // Show translation
    element.textContent = data.translation;
  } else {
    // Keep German, maybe try AI
    element.textContent = text;
  }
}
```

### UI Flow
```
User clicks "EN" toggle
        ↓
Call /api/fast_translate
        ↓
┌───────┴────────┐
│ is_final=true? │
└───────┬────────┘
        │
   ┌────┴────┐
   │         │
  Yes       No
   │         │
   ↓         ↓
Show EN   Keep DE
```

---

## Testing

### Direct API Test
```bash
curl -X POST http://127.0.0.1:5000/api/fast_translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Kündigung", "is_title": false}'
```

### Expected Results
| Input | Expected Output |
|-------|-----------------|
| `Kündigung` | `termination` |
| `BGB` | `Civil Code` |
| `Miete` | `rent` |
| `Vermieter` | `landlord` |
| `Abs. 1` | `Para. 1` |
| `xyz123` | `xyz123` (no match) |

---

## Related Files

| File | Purpose |
|------|---------|
| `app.py` | Main endpoint (lines 2003-2100) |
| `dictionary/legal_dict.py` | Dictionary lookup engine |
| `static/js/translation.js` | Frontend integration |
| `ai_translations.json` | Translation cache |

---

## Optimization Recommendations

### Short-term
1. **Add request timeout:** Prevent hanging
   ```python
   @app.route("/api/fast_translate", methods=["POST"])
   def api_fast_translate():
       # Add timeout wrapper
       with Timeout(5):
           return _do_translation(...)
   ```

2. **Connection pooling:** Use `sqlite3.Pool` or SQLAlchemy

3. **Read-only connections:** For lookup operations
   ```python
   conn.execute("PRAGMA query_only=ON")
   ```

### Long-term
1. **Redis cache:** Shared across processes
2. **Elasticsearch:** Full-text search instead of SQLite
3. **Pre-computed translations:** For common terms

---

*Document generated: 2026-02-24*
