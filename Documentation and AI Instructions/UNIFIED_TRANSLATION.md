# Unified AI Translation System

**Date:** 2026-02-24  
**Status:** ✅ Implemented

---

## Overview

The translation system has been consolidated into a **single, unified AI-powered approach**. All translation requests now flow through one endpoint that intelligently combines:

1. **Translation Cache** (instant responses)
2. **Legal Dictionary** (terminology hints)
3. **Ollama LLM** (accurate translation)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED TRANSLATION                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Request (DE/EN Toggle)                                │
│         ↓                                                    │
│  /api/translate endpoint                                     │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │  1. Check Cache (instant)                    │           │
│  │     • ai_translations.json                   │           │
│  │     • In-memory dict                         │           │
│  │     ↓ Hit: Return immediately                │           │
│  └──────────────────────────────────────────────┘           │
│         ↓ Miss                                               │
│  ┌──────────────────────────────────────────────┐           │
│  │  2. Extract Dictionary Hints                 │           │
│  │     • Legal priority terms                   │           │
│  │     • Key word translations                  │           │
│  │     • Abbreviation expansions                │           │
│  └──────────────────────────────────────────────┘           │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │  3. Build AI Prompt with Context             │           │
│  │     • System role (legal translator)         │           │
│  │     • Dictionary hints                       │           │
│  │     • German text                            │           │
│  └──────────────────────────────────────────────┘           │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │  4. Call Ollama LLM                          │           │
│  │     • llama3.2 model                         │           │
│  │     • Retry with backoff                     │           │
│  │     • Temperature: 0.3 (consistent)          │           │
│  └──────────────────────────────────────────────┘           │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────┐           │
│  │  5. Cache & Return                           │           │
│  │     • Save to ai_translations.json           │           │
│  │     • Background persistence                 │           │
│  │     • Return to user                         │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Primary Translation Endpoint

```http
POST /api/translate
Content-Type: application/json

{
  "text": "Kündigung des Mietverhältnisses",
  "is_title": false
}
```

**Response:**
```json
{
  "translation": "Termination of the tenancy",
  "from_cache": false
}
```

**Fields:**
- `text` (required): German text to translate
- `is_title` (optional): Whether this is a law title (affects prompt)
- `translation`: English translation
- `from_cache`: `true` if served from cache, `false` if AI-generated

---

### Batch Translation Endpoint

```http
POST /api/translate/batch
Content-Type: application/json

{
  "texts": ["Kündigung", "Miete", "BGB"],
  "is_title": false
}
```

**Response:**
```json
{
  "translations": [
    {
      "original": "Kündigung",
      "translation": "termination",
      "from_cache": true
    },
    ...
  ]
}
```

---

### Cache Management Endpoints

#### Get Cache Stats
```http
GET /api/translate/cache/stats
```

**Response:**
```json
{
  "cache_size": 1247,
  "file": "./ai_translations.json",
  "dirty": false
}
```

#### Clear Cache (Admin Only)
```http
POST /api/translate/cache/clear
X-Admin-Token: <admin-token>
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://127.0.0.1:11434/api/generate` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Model to use for translation |
| `OLLAMA_TIMEOUT` | `120` | Request timeout in seconds |
| `OLLAMA_MAX_RETRIES` | `3` | Number of retry attempts |
| `OLLAMA_RETRY_BACKOFF` | `1.0` | Base backoff multiplier |
| `RATE_LIMIT_TRANSLATE` | `60` | Max requests per period |
| `RATE_PERIOD_TRANSLATE` | `60` | Rate limit period in seconds |
| `TRANSLATION_SAVE_INTERVAL` | `30` | Cache save interval in seconds |

---

## Translation Prompt Structure

The AI receives a structured prompt with dictionary context:

```
You are an expert German-to-English legal translator.
Translate German legal text into accurate, professional English.
Maintain formal legal register and precise terminology.
Preserve paragraph structure and formatting.
Use the provided dictionary hints for verified terms.
Return ONLY the translation, no explanations.

Verified German-English terms from legal dictionary:
  • Kündigung → termination
  • Mietvertrag → rental agreement
  • Vermieter → landlord

These are established legal terms - use standard translations:
  Kündigung, Mietvertrag

Translate this German legal text:
German: Der Vermieter kann das Mietverhältnis kündigen.

English Legal Translation:
```

---

## Cache System

### Structure
```json
{
  "Kündigung": "termination",
  "Bürgerliches Gesetzbuch": "Civil Code",
  "Der Vermieter kann kündigen": "The landlord may terminate"
}
```

### Persistence
- **In-memory:** Instant access during request lifetime
- **Disk:** `ai_translations.json` (saved every 30s)
- **Atomic writes:** Prevents corruption on crash
- **Background saver:** Dedicated thread

### Pre-warming
On startup, the system pre-translates the top 50 most-viewed law titles:
```python
threading.Thread(target=_prewarm_translations, daemon=True).start()
```

---

## Dictionary Integration

The system extracts hints from the legal dictionary to assist AI translation:

### Hint Types

1. **Key Terms:** Word-by-word translations
   ```
   Kündigung → termination
   ```

2. **Legal Priority Terms:** Established legal terminology
   ```
   These are established legal terms: Kündigung, Mietvertrag
   ```

3. **Abbreviation Expansions:**
   ```
   BGB = Bürgerliches Gesetzbuch (Civil Code)
   GG = Grundgesetz (Basic Law/Constitution)
   ```

### Dictionary Sources
- `dictionary/memory_dict.py` (in-memory, fast)
- `dictionary/legal_dict.py` (SQLite fallback)
- `dictionary/legal_priority_terms.csv` (curated terms)

---

## Error Handling

### Retry Logic
```python
for attempt in range(1, OLLAMA_MAX_RETRIES + 1):
    try:
        # Call Ollama
        return translation
    except (URLError, socket.timeout, ConnectionError) as e:
        if attempt < OLLAMA_MAX_RETRIES:
            sleep = BACKOFF * (2 ** (attempt - 1))
            time.sleep(sleep)
```

### Fallback Behavior
- **Cache miss + AI failure:** Return original German text
- **Translator unavailable:** Return error message
- **Empty input:** Return empty string

### Logging
All translation activity is logged to `Logs/ai.log`:
```
2026-02-24 10:15:23 [INFO] ai: TRANSLATE REQUEST: text='Kündigung...' is_title=False
2026-02-24 10:15:23 [INFO] ai: Cache hit: 'Kündigung'
2026-02-24 10:15:23 [INFO] ai: TRANSLATION (cache): 'Kündigung' -> 'termination'...
```

---

## Performance

### Response Times

| Scenario | Avg Time | Source |
|----------|----------|--------|
| Cache hit | <5ms | Memory |
| Dictionary hints | 10-30ms | SQLite/Memory |
| AI translation (short) | 200-500ms | Ollama |
| AI translation (long) | 500-2000ms | Ollama |

### Cache Hit Rate
Expected: 60-80% for common legal terms after warm-up

### Rate Limiting
- **Translation:** 60 requests/minute
- **Batch:** 10 requests/minute
- **Cache clear:** Admin only

---

## Testing

### Run Tests
```bash
# Start server first
python app.py

# In another terminal
python test_unified_translation.py
```

### Test Coverage
- ✓ Single word translations
- ✓ Law abbreviations (BGB, GG, StGB)
- ✓ Law titles
- ✓ Short phrases
- ✓ Edge cases (empty, whitespace)
- ✓ Batch translation
- ✓ Cache persistence

---

## Files

| File | Purpose |
|------|---------|
| `unified_translator.py` | Core translation engine |
| `app.py` | Flask endpoints |
| `ai_translations.json` | Translation cache |
| `test_unified_translation.py` | Test suite |
| `dictionary/` | Legal dictionary files |

---

## Migration Notes

### Removed Endpoints
- `/api/fast_translate` → Replaced by `/api/translate`
- `/api/ai_translate` → Replaced by `/api/translate`

### Updated Frontend Calls
```javascript
// Old (multiple endpoints)
fetch('/api/fast_translate', {...})
fetch('/api/ai_translate', {...})

// New (single endpoint)
fetch('/api/translate', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({text, is_title})
})
```

### Backward Compatibility
The old endpoints are removed. Update frontend code to use `/api/translate`.

---

## Future Enhancements

1. **Multi-model fallback:** Try llama3.2, then gemma3:1b
2. **Translation memory:** Store user-approved translations
3. **Confidence scores:** Return AI confidence level
4. **Context-aware:** Use surrounding paragraphs for context
5. **Batch optimization:** Parallel AI requests for batch endpoint

---

*Document generated: 2026-02-24*
