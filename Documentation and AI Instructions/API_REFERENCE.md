# API Reference — German Law Search

**Updated:** 2026-02-24  
**Version:** 2.0 (Unified Translation System)

---

## 🔍 Search Endpoints

### GET `/api/search`

Search German laws using natural language queries in English or German.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (English or German) |
| `limit` | integer | No | Max results (default: 10, max: 50) |
| `category` | string | No | Filter by category (e.g., "housing", "labor") |

**Example:**
```bash
curl "http://localhost:5000/api/search?q=landlord%20refuses%20deposit&limit=10"
```

**Response:**
```json
{
  "query": "landlord refuses deposit",
  "expanded": ["mieter", "kaution", "rückzahlung"],
  "results": [
    {
      "key": "BGB",
      "title": "Bürgerliches Gesetzbuch",
      "score": 0.85,
      "norms": [
        {
          "norm_id": "§ 548",
          "title": "Ansprüche des Vermieters",
          "preview": "Der Vermieter kann..."
        }
      ]
    }
  ],
  "time_ms": 45
}
```

---

### GET `/api/law/<key>`

Get a specific law by its key (e.g., "BGB", "StGB").

**Example:**
```bash
curl "http://localhost:5000/api/law/BGB"
```

**Response:**
```json
{
  "key": "BGB",
  "title": "Bürgerliches Gesetzbuch",
  "en_title": "Civil Code",
  "category": "consumer",
  "norms": [
    {
      "norm_id": "§ 1",
      "title": "Rechtsfähigkeit",
      "text": "Die Rechtsfähigkeit..."
    }
  ]
}
```

---

### GET `/api/law-insights/<key>`

Generate AI-powered insights for a specific law.

**Example:**
```bash
curl "http://localhost:5000/api/law-insights/BGB"
```

**Response:**
```json
{
  "summary": "The Civil Code governs private law relationships...",
  "risk": "Note that specific provisions may vary by state.",
  "exclusions": "Does not cover public law matters.",
  "scenarios": "Used when drafting rental agreements."
}
```

---

## 🤖 Translation Endpoints

### POST `/api/translate`

**Unified AI-powered translation endpoint.** All translation requests flow through here.

**Request:**
```bash
curl -X POST "http://localhost:5000/api/translate" \
  -H "Content-Type: application/json" \
  -d '{"text": "Kündigung", "is_title": false}'
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | German text to translate |
| `is_title` | boolean | No | True if text is a law title |

**Response:**
```json
{
  "translation": "termination",
  "from_cache": true
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `translation` | string | English translation |
| `from_cache` | boolean | True if served from cache |

**Translation Flow:**
1. Check cache (instant if hit)
2. Extract dictionary hints
3. Call Ollama AI with context
4. Cache and return result

**Status Codes:**
- `200 OK` - Translation successful
- `429 Too Many Requests` - Rate limited (60/min)
- `500 Internal Server Error` - AI service unavailable

---

### POST `/api/translate/batch`

Translate multiple texts in one request.

**Request:**
```bash
curl -X POST "http://localhost:5000/api/translate/batch" \
  -H "Content-Type: application/json" \
  -d '{"texts": ["Kündigung", "Miete", "BGB"], "is_title": false}'
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
    {
      "original": "Miete",
      "translation": "rent",
      "from_cache": false
    }
  ]
}
```

**Limits:**
- Maximum 50 texts per batch
- Rate limited: 10 requests/minute

---

### GET `/api/translate/cache/stats`

Get translation cache statistics.

**Response:**
```json
{
  "cache_size": 1247,
  "file": "./ai_translations.json",
  "dirty": false
}
```

---

### POST `/api/translate/cache/clear`

Clear the translation cache (admin only).

**Headers:**
| Header | Value | Description |
|--------|-------|-------------|
| `X-Admin-Token` | string | Admin authentication token |

**Response:**
```json
{
  "status": "ok",
  "message": "Translation cache cleared"
}
```

---

## 💬 AI Chat Endpoints

### POST `/api/ai_chat`

Stream AI responses for legal questions.

**Request:**
```bash
curl -X POST "http://localhost:5000/api/ai_chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "Can my landlord increase rent?", "context": "BGB § 558"}'
```

**Response:** (streamed)
```
1. **Summary**: Rent increases are regulated under...
2. **Detailed Analysis**: According to BGB § 558...
3. **Practical Guidance**: You should...
```

**Rate Limit:** 5 requests/minute

---

## 📊 Dictionary Endpoints

### POST `/api/dictionary_lookup`

Fast dictionary lookup for a German word.

**Request:**
```bash
curl -X POST "http://localhost:5000/api/dictionary_lookup" \
  -H "Content-Type: application/json" \
  -d '{"text": "Kündigung"}'
```

**Response:**
```json
{
  "results": [
    {
      "english": "termination",
      "frequency": 90,
      "pos": "n",
      "source": "legal_priority"
    }
  ]
}
```

---

## 🔧 Admin Endpoints

### GET `/api/admin/info`

Get server status and index information.

**Headers:**
| Header | Value | Description |
|--------|-------|-------------|
| `X-Admin-Token` | string | Admin authentication token |

**Response:**
```json
{
  "indexing": true,
  "total_files": 6000,
  "indexed_files": 5842,
  "laws": 5842,
  "log_level": "INFO"
}
```

---

### POST `/api/admin/rebuild_index`

Rebuild the search index (admin only).

**Response:**
```json
{
  "status": "rebuild_started"
}
```

---

## 📈 Status Endpoints

### GET `/api/status`

Get server health status.

**Response:**
```json
{
  "ready": true,
  "laws": 5842,
  "total_norms": 125000,
  "uptime_seconds": 3600
}
```

---

### GET `/api/dev/health`

Get detailed development health information.

**Response:**
```json
{
  "ollama": "running",
  "dictionary": "loaded",
  "uptime_seconds": 3600,
  "memory_mb": 256
}
```

---

## Rate Limits

| Endpoint | Limit | Period |
|----------|-------|--------|
| `/api/translate` | 60 | 60 seconds |
| `/api/translate/batch` | 10 | 60 seconds |
| `/api/ai_chat` | 5 | 60 seconds |
| `/api/search` | 100 | 60 seconds |

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "error_code",
  "message": "Human-readable message"
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `rate_limited` | 429 | Too many requests |
| `unauthorized` | 403 | Admin token required |
| `not_found` | 404 | Resource not found |
| `translation_failed` | 500 | AI translation error |

---

*Last updated: 2026-02-24*
