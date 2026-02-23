# Translation Behavior Clarification

**Date:** February 23, 2026  
**Status:** ✅ Clarified and Implemented

---

## Key Principle: On-Demand Translation Only

### ✅ Translations Happen ONLY When:

1. **User clicks "Translate" button** on a law paragraph
2. **User toggles DE/EN switch** in the law detail view
3. **User explicitly calls** `/api/ai_translate` endpoint

### ❌ Translations NEVER Happen:

1. **Automatically on page load** - Laws display in German by default
2. **During search** - Query expansion uses dictionary internally but doesn't show translations
3. **For UI elements** - Interface remains in English
4. **In the background** - No automatic translation without user action

---

## Translation Flow

### User-Initiated Translation

```
User Action (Click "Translate" button)
    │
    ▼
Frontend calls: POST /api/ai_translate
    │
    ▼
Backend checks cache
    │
    ├─ Cached? → Return cached translation (instant)
    │
    └─ Not cached?
        │
        ├─ Single word? → Dictionary lookup (<5ms)
        │
        ├─ Short phrase? → Dictionary + AI refinement (~1-2s)
        │
        └─ Full paragraph? → AI translation (~2-5s)
            │
            ▼
        Save to cache + Return
            │
            ▼
        Frontend displays translation
```

### Search Query Expansion (Internal Only)

```
User types: "tenant eviction"
    │
    ▼
Backend: expand_query()
    │
    ├─ Uses dictionary internally
    ├─ Maps "tenant" → ["mieter", "mieterin"]
    ├─ Maps "eviction" → ["kündigung", "räumung"]
    │
    ▼
Searches with German terms
    │
    ▼
Returns German law results
    │
    ▼
User sees: German text (NOT translated)
    │
    ▼
User can: Click "Translate" button if needed
```

**Key Point:** Search uses dictionary for better results, but doesn't show translations automatically.

---

## API Endpoints

### `/api/ai_translate` (On-Demand Translation)

**Purpose:** Manual translation when user requests it

**Request:**
```javascript
POST /api/ai_translate
{
  "text": "Der Mieter kann das Mietverhältnis kündigen",
  "is_title": false
}
```

**Response:**
```json
{
  "translation": "The tenant can terminate the lease agreement",
  "source": "ai_refined",
  "dictionary_used": true,
  "cached": false
}
```

**Usage:** Called by frontend when user clicks "Translate" button

---

### `/api/ai_chat` (Legal Explanation)

**Purpose:** Explain German law, answer legal questions

**Request:**
```javascript
POST /api/ai_chat
{
  "query": "What are my rights as a tenant facing eviction?",
  "context": "BGB § 573, § 573c..."
}
```

**Response:** (streaming)
```
1. **Summary**: As a tenant in Germany, you have strong protection...

2. **Legal Basis**: § 573 BGB requires legitimate interest...

3. **Explanation**: The landlord must prove...

4. **Practical Guidance**: Check if the notice meets formal requirements...
```

**Usage:** AI assistant for legal questions, NOT for translation

---

## Dictionary Usage

### Internal (Not Visible to User)

**Search Query Expansion:**
```python
# In expand_query() - used for search only
translations = legal_dict.get_translations("tenant")
# Returns: ["mieter", "mieterin"]
# Used internally to find German laws
# User sees: German law results (not translations)
```

### User-Visible (On-Demand)

**Translation Button:**
```python
# In api_ai_translate() - called by user action
translations = legal_dict.get_translations("Mieter")
# Returns: ["tenant"]
# User sees: "tenant" (translated text)
```

---

## Examples

### Example 1: Search (No Translation Shown)

**User Action:** Types "tenant rights" in search box

**What Happens:**
1. Backend expands query: "tenant" → ["mieter", "mieterin"]
2. Searches German laws with these terms
3. Returns German law results

**User Sees:**
```
Search Results:
1. BGB - Bürgerliches Gesetzbuch
   Relevant norms: § 535, § 543, § 573...
   
2. BGB - Mietrecht
   Relevant norms: § 535-580a...
```

**NOT Translated:** Law text remains in German

**User Option:** Click on a law → Click "Translate" button if needed

---

### Example 2: Law Detail (Translation On-Demand)

**User Action:** Opens BGB law detail page

**Initial View (German):**
```
§ 535 BGB - Wesen des Mietvertrags

(1) Durch den Mietvertrag wird der Vermieter verpflichtet...
```

**User Clicks "Translate" Button:**

**Translated View (English):**
```
§ 535 BGB - Nature of the Lease Agreement

(1) By the lease agreement, the landlord is obligated...
```

**Translation Trigger:** User action (button click)

---

### Example 3: AI Chat (Explanation, Not Translation)

**User Action:** Asks "Can my landlord evict me without notice?"

**AI Response:**
```
1. **Summary**: In Germany, landlords cannot evict tenants without 
   proper notice except in rare circumstances.

2. **Legal Basis**: 
   - § 573 BGB: Termination requires legitimate interest
   - § 543 BGB: Extraordinary termination for good cause
   - § 573c BGB: Statutory notice periods

3. **Explanation**: The landlord must have a valid reason such as...

4. **Practical Guidance**: 
   - Check if the eviction notice cites a valid legal ground
   - Verify the notice period matches § 573c BGB
   - Consider seeking advice from a tenant association...
```

**Purpose:** Legal explanation, NOT translation

---

## Implementation Details

### Frontend (index.html)

**Translation Button Handler:**
```javascript
// Only translate when user clicks button
async function translateParagraph(paragraphId) {
    const germanText = document.getElementById(`para-${paragraphId}`).textContent;
    
    // Call translation API
    const response = await fetch('/api/ai_translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: germanText })
    });
    
    const data = await response.json();
    
    // Display translation
    document.getElementById(`para-${paragraphId}`).textContent = data.translation;
}
```

**Search Handler (No Translation):**
```javascript
// Search uses dictionary internally, but doesn't show translations
async function search(query) {
    const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    
    const results = await response.json();
    
    // Display German law results (no translation)
    displayResults(results.results);
}
```

---

### Backend (app.py)

**Translation Endpoint (On-Demand):**
```python
@app.route("/api/ai_translate", methods=["POST"])
def api_ai_translate():
    """Translates text using dictionary + Ollama refinement.
    
    ON-DEMAND TRANSLATION ONLY:
    - Called manually by user via translate button
    - Not used for automatic query expansion
    """
    # ... translation logic ...
```

**Query Expansion (Internal Only):**
```python
def expand_query(raw: str):
    """Translate English keywords to German for search.
    
    NOTE: This is for search query expansion only, NOT for UI translation.
    UI translations happen on-demand via /api/ai_translate endpoint.
    """
    # ... uses dictionary internally ...
```

---

## Configuration

### Environment Variables

```bash
# Translation rate limiting
RATE_LIMIT_TRANSLATE=60      # 60 translations per minute
RATE_PERIOD_TRANSLATE=60

# AI chat rate limiting (stricter)
RATE_LIMIT_AI_CHAT=5         # 5 chat requests per minute
RATE_PERIOD_AI_CHAT=60

# Ollama configuration
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT=120
```

---

## Caching

### Translation Cache

**Location:** `ai_translations.json`

**Behavior:**
- Cached on user request (when user clicks "Translate")
- Saved every 30 seconds (background thread)
- Saved on application exit
- Loaded on startup

**Example:**
```
First translation request:
  "Kündigung" → AI call → "termination" → Cache

Second request (same text):
  "Kündigung" → Cache hit → "termination" (instant)
```

**Cache Size:** Grows organically based on user requests

---

## Summary

| Feature | Behavior |
|---------|----------|
| **Search** | Uses dictionary internally, shows German results |
| **Law Display** | German by default |
| **Translation Button** | On-demand translation (dictionary + AI) |
| **AI Chat** | Legal explanation, NOT translation |
| **UI Language** | English (not translated) |
| **Caching** | Only for user-requested translations |

**Key Principle:** User controls when translations happen. No automatic translations.
