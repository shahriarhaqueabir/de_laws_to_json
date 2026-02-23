# API Reference

**German Law Search System**  
**Version:** 1.0  
**Last Updated:** February 23, 2026  
**Base URL:** `http://127.0.0.1:5000`

---

## 📋 Table of Contents

- [Public Endpoints](#public-endpoints)
- [Search Endpoints](#search-endpoints)
- [Law Retrieval Endpoints](#law-retrieval-endpoints)
- [AI Endpoints](#ai-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

---

## 🔓 Public Endpoints

### GET /

Load the main dashboard HTML page.

**Request:**
```http
GET / HTTP/1.1
Host: 127.0.0.1:5000
```

**Response:**
```html
<!doctype html>
<html lang="en">
  <!-- Full HTML page (3,182 lines) -->
</html>
```

**Status Codes:**
- `200 OK` - Success

---

### GET /favicon.ico

Return favicon (empty response).

**Request:**
```http
GET /favicon.ico HTTP/1.1
```

**Response:**
```http
HTTP/1.1 204 No Content
```

---

### GET /api/status

Get system status and index readiness.

**Request:**
```http
GET /api/status HTTP/1.1
```

**Response:**
```json
{
  "ready": true,
  "total": 6500,
  "indexed": 6500,
  "laws": 6500,
  "total_norms": 150000,
  "categories": {
    "housing": 850,
    "labor": 720,
    "consumer": 650,
    "traffic": 580,
    "family": 490,
    "criminal": 420,
    "finance": 680,
    "social": 750,
    "public": 520,
    "tech": 480,
    "berlin": 120,
    "other": 240
  },
  "largest_law": {
    "key": "BGB",
    "title": "Bürgerliches Gesetzbuch",
    "norms": 2385
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `ready` | boolean | Index is built and ready for search |
| `total` | integer | Total JSON files found |
| `indexed` | integer | Files successfully indexed |
| `laws` | integer | Number of laws in index |
| `total_norms` | integer | Total paragraphs across all laws |
| `categories` | object | Law count by category |
| `largest_law` | object | Law with most norms |

**Status Codes:**
- `200 OK` - Success
- `500 Internal Server Error` - Index build error

**Use Case:**
```javascript
// Frontend polls this endpoint on load
setInterval(async () => {
    const status = await fetch('/api/status');
    const data = await status.json();
    
    if (data.ready) {
        enableSearchUI();
    } else {
        showLoadingStatus(data.indexed, data.total);
    }
}, 1000);
```

---

## 🔍 Search Endpoints

### POST /api/search

Search laws using natural language queries (English or German).

**Request:**
```http
POST /api/search HTTP/1.1
Host: 127.0.0.1:5000
Content-Type: application/json

{
  "query": "tenant rights eviction",
  "category": "housing"
}
```

**Request Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | No | `""` | Search query (EN or DE) |
| `category` | string | No | `""` | Filter by category |

**Categories:**
- `housing` - Wohnen & Miete
- `labor` - Arbeit & Beruf
- `consumer` - Einkaufen & Verträge
- `traffic` - Verkehr & Transport
- `family` - Familie & Leben
- `criminal` - Strafrecht
- `finance` - Steuern & Finanzen
- `social` - Gesundheit & Soziales
- `public` - Staat & Rechte
- `tech` - Innovation & Umwelt
- `berlin` - Berlin
- `other` - Other

**Response:**
```json
{
  "results": [
    {
      "key": "BGB",
      "title": "Bürgerliches Gesetzbuch",
      "alt_title": "",
      "last_changed": "1896-08-18",
      "relevance": 95,
      "total_norms": 2385,
      "category": "housing",
      "relevant_norms": [
        "§ 543: Außerordentliche fristlose Kündigung",
        "§ 573: Ordentliche Kündigung des Vermieters",
        "§ 575: Befristeter Mietvertrag"
      ]
    },
    {
      "key": "WoHG",
      "title": "Wohnungseigentumsgesetz",
      "alt_title": "",
      "last_changed": "2020-03-15",
      "relevance": 72,
      "total_norms": 54,
      "category": "housing",
      "relevant_norms": [
        "§ 14: Pflichten der Wohnungseigentümer"
      ]
    }
  ],
  "keywords": ["tenant", "rights", "eviction"],
  "german_terms": [
    "mieter",
    "mieterin",
    "rechte",
    "kündigung",
    "räumung",
    "räumungsklage"
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `results` | array | List of matching laws |
| `results[].key` | string | Law abbreviation (e.g., "BGB") |
| `results[].title` | string | Full German title |
| `results[].alt_title` | string | Alternative title (if any) |
| `results[].last_changed` | string | Last modification date |
| `results[].relevance` | integer | Relevance score (0-100) |
| `results[].total_norms` | integer | Number of paragraphs |
| `results[].category` | string | Category ID |
| `results[].relevant_norms` | array | Top matching norm titles |
| `keywords` | array | Original query tokens |
| `german_terms` | array | Expanded German search terms |

**Status Codes:**
- `200 OK` - Success
- `429 Too Many Requests` - Rate limited
- `503 Service Unavailable` - Index still building

**Rate Limit:**
- 30 requests per minute per IP

**Examples:**

```bash
# English query
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tenant eviction rights"}'

# German query
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "mieter kündigung schutz"}'

# With category filter
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "arbeitsrecht", "category": "labor"}'

# Citation search
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "BGB 303"}'
```

**Query Expansion:**

The search engine automatically expands queries:

1. **Tokenization:** Lowercase, remove stopwords, strip punctuation
2. **Translation:** English → German (using `EN_DE` dictionary)
3. **Synonym Expansion:** German synonyms (using `DE_EXPANSIONS`)

**Example Expansion:**
```
Input: "tenant rights eviction"
Tokens: ["tenant", "rights", "eviction"]
German: ["mieter", "mieterin", "rechte", "kündigung", "räumung"]
```

**Scoring:**
- Law key match: +20.0
- Title match: +10.0
- Norm ID/title match: +3.0
- Paragraph preview match: +0.4
- Citation match boost: +400.0

---

## 📚 Law Retrieval Endpoints

### GET /api/laws

List all laws with pagination and filtering.

**Request:**
```http
GET /api/laws?page=1&per_page=20&category=housing&q=BGB HTTP/1.1
Host: 127.0.0.1:5000
```

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | `1` | Page number |
| `per_page` | integer | No | `48` | Items per page |
| `category` | string | No | `""` | Filter by category |
| `q` | string | No | `""` | Search query |

**Response:**
```json
{
  "laws": [
    {
      "key": "BGB",
      "title": "Bürgerliches Gesetzbuch",
      "alt_title": "",
      "last_changed": "1896-08-18",
      "category": "housing",
      "total_norms": 2385
    },
    {
      "key": "BGB_1",
      "title": "BGB Buch 1",
      "alt_title": "Allgemeiner Teil",
      "last_changed": "1896-08-18",
      "category": "other",
      "total_norms": 240
    }
  ],
  "total": 125,
  "page": 1,
  "per_page": 48,
  "has_more": true
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `laws` | array | List of law metadata |
| `total` | integer | Total matching laws |
| `page` | integer | Current page number |
| `per_page` | integer | Items per page |
| `has_more` | boolean | More pages available |

**Status Codes:**
- `200 OK` - Success
- `429 Too Many Requests` - Rate limited
- `503 Service Unavailable` - Index still building

**Rate Limit:**
- 60 requests per minute per IP

**Examples:**

```bash
# List all laws (first page)
curl "http://localhost:5000/api/laws"

# Filter by category
curl "http://localhost:5000/api/laws?category=criminal"

# Search within laws
curl "http://localhost:5000/api/laws?q=miete"

# Citation-style search
curl "http://localhost:5000/api/laws?q=BGB%20303"

# Paginate
curl "http://localhost:5000/api/laws?page=2&per_page=20"
```

---

### GET /api/law/:key

Get full details of a specific law by key.

**Request:**
```http
GET /api/law/BGB HTTP/1.1
Host: 127.0.0.1:5000
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | string | Law abbreviation (e.g., "BGB", "StGB") |

**Response:**
```json
{
  "meta": {
    "source": "BJNR001950896.xml",
    "download_date": "2025-10-20",
    "title": "Bürgerliches Gesetzbuch",
    "last_changed": "1896-08-18",
    "alt_title": ""
  },
  "norms": [
    {
      "norm_id": "§ 7",
      "title": "Wohnsitz; Begründung und Aufhebung",
      "paragraphs": [
        {
          "id": "1",
          "text": "(1) Wer sich an einem Orte ständig niederlässt, begründet an diesem Ort seinen Wohnsitz."
        },
        {
          "id": "2",
          "text": "(2) Der Wohnsitz kann gleichzeitig an mehreren Orten bestehen."
        },
        {
          "id": "3",
          "text": "(3) Der Wohnsitz wird aufgehoben, wenn die Niederlassung mit dem Willen aufgehoben wird, sie aufzugeben."
        }
      ]
    }
  ]
}
```

**Response with Translation (if available):**
```json
{
  "meta": { ... },
  "norms": [ ... ],
  "en_translation": {
    "meta": {
      "title": "Civil Code"
    },
    "norms": [
      {
        "norm_id": "§ 7",
        "title": "Domicile; Establishment and Termination",
        "paragraphs": [
          {
            "id": "1",
            "text": "(1) A person who establishes themselves permanently at a place establishes their domicile at that place."
          }
        ]
      }
    ]
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Law not found
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - File read error

**Rate Limit:**
- 60 requests per minute per IP

**Examples:**

```bash
# Get BGB
curl http://localhost:5000/api/law/BGB

# Get StGB (Criminal Code)
curl http://localhost:5000/api/law/StGB

# Get GG (Basic Law / Constitution)
curl http://localhost:5000/api/law/GG
```

---

## 🤖 AI Endpoints

### POST /api/ai_translate

Translate German text to English using Ollama.

**Request:**
```http
POST /api/ai_translate HTTP/1.1
Host: 127.0.0.1:5000
Content-Type: application/json

{
  "text": "Kündigung",
  "is_title": true
}
```

**Request Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `text` | string | Yes | - | German text to translate |
| `is_title` | boolean | No | `false` | True if text is a law title |

**Response:**
```json
{
  "translation": "termination"
}
```

**Error Response:**
```json
{
  "error": "Ollama connection timeout",
  "translation": "[Translation Error: Kündigung]"
}
```

**Status Codes:**
- `200 OK` - Success
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Ollama error

**Rate Limit:**
- 60 requests per minute per IP

**Caching:**
- Translations are cached in `ai_translations.json`
- Cache is saved every 30 seconds
- Cached translations are returned immediately

**Examples:**

```bash
# Translate title
curl -X POST http://localhost:5000/api/ai_translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Bürgerliches Gesetzbuch", "is_title": true}'

# Translate paragraph
curl -X POST http://localhost:5000/api/ai_translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Der Mieter kann das Mietverhältnis kündigen."}'
```

**Configuration:**

```bash
# Environment variables
OLLAMA_MODEL=llama3.2          # Model to use
OLLAMA_URL=http://127.0.0.1:11434/api/generate
OLLAMA_TIMEOUT=120             # Request timeout (seconds)
OLLAMA_MAX_RETRIES=3           # Retry attempts
```

---

### POST /api/ai_chat

Get AI-powered legal explanations with context.

**Request:**
```http
POST /api/ai_chat HTTP/1.1
Host: 127.0.0.1:5000
Content-Type: application/json

{
  "query": "What are my rights as a tenant facing eviction?",
  "context": "BGB § 543: Außerordentliche fristlose Kündigung...\nBGB § 573: Ordentliche Kündigung..."
}
```

**Request Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | Yes | - | User's question |
| `context` | string | No | `""` | Relevant law snippets |

**Response (Streaming):**
```
text/plain

### Summary
As a tenant facing eviction in Germany, you have several protective rights...

### Detailed Analysis
**§ 543 BGB** allows extraordinary termination only for "important reason"...

**§ 573 BGB** requires the landlord to have a "legitimate interest"...

### Practical Guidance
1. Review the eviction notice for proper form...
2. Check if stated reason meets legal requirements...
3. Consider seeking legal counsel from Mieterverein...
```

**Error Response (in stream):**
```
[Ollama Connection Error: Timeout. Ensure Ollama is running and model 'llama3.2' is installed]
```

**Status Codes:**
- `200 OK` - Success (streaming response)
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Ollama error

**Rate Limit:**
- 5 requests per minute per IP (strict limit due to AI cost)

**Prompt Template:**

The AI uses this structured prompt:

```
### SYSTEM
You are an expert German Legal Assistant. Your role is to explain German law 
to English speakers accurately and professionally. Base your analysis strictly 
on the provided context where possible. If the context is insufficient, state 
the limitations clearly before providing general legal principles. Keep 
explanations concise, structured, and avoid speculation.

### CONTEXT
Relevant legal metadata and norm snippets:
{context}

### TASK
Analyze and answer: "{query}"

### OUTPUT STRUCTURE
1. **Summary**: Brief overview of the situation.
2. **Detailed Analysis**: Breakdown of relevant paragraphs (e.g., § 303 BGB). 
   Explain the legal logic.
3. **Practical Guidance**: Conclusion or next steps.

Expert Legal Analysis in English:
```

**Examples:**

```bash
# Basic query
curl -X POST http://localhost:5000/api/ai_chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the legal drinking age in Germany?"}'

# With context from search results
curl -X POST http://localhost:5000/api/ai_chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Can my landlord evict me without notice?",
    "context": "BGB § 543: Außerordentliche fristlose Kündigung aus wichtigem Grund..."
  }'
```

**Configuration:**

```bash
# Environment variables
OLLAMA_MODEL=llama3.2          # Model to use
OLLAMA_URL=http://127.0.0.1:11434/api/generate
OLLAMA_TIMEOUT=120             # Request timeout (seconds)
```

---

## 🔐 Admin Endpoints

Admin endpoints require an `X-Admin-Token` header.

**Getting Admin Token:**
- Token is generated at app startup
- Passed to frontend template
- Check browser console or page source for `admin_key`

**Example:**
```javascript
// In browser console
console.log(window.admin_key);  // or check page source
```

---

### GET /api/admin/info

Get system information and debug status.

**Request:**
```http
GET /api/admin/info HTTP/1.1
Host: 127.0.0.1:5000
X-Admin-Token: abc123...
```

**Response:**
```json
{
  "indexing": true,
  "total_files": 6500,
  "indexed_files": 6500,
  "laws": 6500,
  "log_level": "INFO"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `indexing` | boolean | Index is built and ready |
| `total_files` | integer | Total JSON files found |
| `indexed_files` | integer | Files successfully indexed |
| `laws` | integer | Number of laws in index |
| `log_level` | string | Current logging level |

**Status Codes:**
- `200 OK` - Success
- `403 Forbidden` - Invalid or missing admin token

---

### POST /api/admin/rebuild_index

Force rebuild of search index.

**Request:**
```http
POST /api/admin/rebuild_index HTTP/1.1
Host: 127.0.0.1:5000
X-Admin-Token: abc123...
```

**Response:**
```json
{
  "status": "reindexing_started"
}
```

**Behavior:**
- Deletes cached `search_index.json`
- Starts background thread to rebuild index
- Returns immediately (does not wait for completion)
- Frontend will show "Index building" status

**Status Codes:**
- `202 Accepted` - Rebuild started
- `403 Forbidden` - Invalid or missing admin token

**Use Case:**
```bash
# After modifying JSON files
curl -X POST http://localhost:5000/api/admin/rebuild_index \
  -H "X-Admin-Token: abc123..."
```

---

### POST /api/admin/clear_translations

Clear AI translation cache (deprecated).

**Request:**
```http
POST /api/admin/clear_translations HTTP/1.1
Host: 127.0.0.1:5000
X-Admin-Token: abc123...
```

**Response:**
```json
{
  "status": "translations_disabled",
  "message": "Translation caching is no longer used"
}
```

**Note:** This endpoint is deprecated. Translations are now always cached.

**Status Codes:**
- `200 OK` - Success
- `403 Forbidden` - Invalid or missing admin token

---

### POST /api/admin/toggle_debug

Toggle debug logging level.

**Request:**
```http
POST /api/admin/toggle_debug HTTP/1.1
Host: 127.0.0.1:5000
X-Admin-Token: abc123...
```

**Response:**
```json
{
  "debug": true,
  "level": "DEBUG"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `debug` | boolean | Debug mode enabled |
| `level` | string | Log level name |

**Behavior:**
- Toggles between `DEBUG` and `INFO`
- Affects all subsequent log messages
- Useful for troubleshooting search issues

**Status Codes:**
- `200 OK` - Success
- `403 Forbidden` - Invalid or missing admin token

**Use Case:**
```bash
# Enable debug logging
curl -X POST http://localhost:5000/api/admin/toggle_debug \
  -H "X-Admin-Token: abc123..."

# Check logs
tail -f app.log
```

---

## ❌ Error Responses

### Standard Error Format

```json
{
  "error": "Error message description"
}
```

### Common Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| `400` | Bad Request | Invalid JSON |
| `403` | Forbidden | Invalid admin token |
| `404` | Not Found | Law not found |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Ollama connection failed |
| `503` | Service Unavailable | Index still building |

### Rate Limit Response

```json
{
  "error": "rate_limited",
  "retry_after": 45
}
```

**Headers:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```

**Meaning:** Retry after 45 seconds

---

### Index Building Response

```json
{
  "error": "Index still building.",
  "results": []
}
```

**Status:** `503 Service Unavailable`

**Action:** Wait and retry (check `/api/status`)

---

## 🚦 Rate Limiting

### Current Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/search` | 30 requests | 60 seconds |
| `/api/laws` | 60 requests | 60 seconds |
| `/api/law/:key` | 60 requests | 60 seconds |
| `/api/ai_translate` | 60 requests | 60 seconds |
| `/api/ai_chat` | 5 requests | 60 seconds |
| `/api/admin/*` | No limit | - |

### Configuration

```bash
# Environment variables
RATE_LIMIT_SEARCH=30
RATE_PERIOD_SEARCH=60

RATE_LIMIT_GENERIC=60
RATE_PERIOD_GENERIC=60

RATE_LIMIT_TRANSLATE=60
RATE_PERIOD_TRANSLATE=60

RATE_LIMIT_AI_CHAT=5
RATE_PERIOD_AI_CHAT=60
```

### Implementation

Rate limiting is in-memory and per-IP:
- Resets on app restart
- Uses `X-Forwarded-For` header if present
- Falls back to `remote_addr`

**For Production:**
Use Redis-backed rate limiting (Flask-Limiter) for persistence.

---

## 🧪 Testing

### cURL Examples

```bash
# Health check
curl http://localhost:5000/api/status

# Search
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tenant rights"}'

# Get law
curl http://localhost:5000/api/law/BGB

# List laws
curl "http://localhost:5000/api/laws?page=1&per_page=20"

# Translate
curl -X POST http://localhost:5000/api/ai_translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Kündigung", "is_title": true}'

# Admin info
curl http://localhost:5000/api/admin/info \
  -H "X-Admin-Token: abc123..."
```

### JavaScript Examples

```javascript
// Search
const search = async (query) => {
    const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });
    return await response.json();
};

// Get law
const getLaw = async (key) => {
    const response = await fetch(`/api/law/${key}`);
    return await response.json();
};

// Translate
const translate = async (text, isTitle = false) => {
    const response = await fetch('/api/ai_translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, is_title: isTitle })
    });
    return await response.json();
};

// AI Chat (streaming)
const chat = async (query, context) => {
    const response = await fetch('/api/ai_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(decoder.decode(value));
    }
};
```

### Python Examples

```python
import requests

BASE_URL = "http://localhost:5000"

# Search
def search(query, category=""):
    response = requests.post(
        f"{BASE_URL}/api/search",
        json={"query": query, "category": category}
    )
    return response.json()

# Get law
def get_law(key):
    response = requests.get(f"{BASE_URL}/api/law/{key}")
    return response.json()

# Translate
def translate(text, is_title=False):
    response = requests.post(
        f"{BASE_URL}/api/ai_translate",
        json={"text": text, "is_title": is_title}
    )
    return response.json()

# Admin info
def admin_info(token):
    response = requests.get(
        f"{BASE_URL}/api/admin/info",
        headers={"X-Admin-Token": token}
    )
    return response.json()
```

---

## 📊 Response Times

Typical response times (localhost):

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `/api/status` | 5ms | 10ms | 20ms |
| `/api/search` | 30ms | 80ms | 150ms |
| `/api/laws` | 50ms | 120ms | 200ms |
| `/api/law/:key` | 10ms | 30ms | 50ms |
| `/api/ai_translate` | 500ms | 2000ms | 5000ms |
| `/api/ai_chat` | 1000ms | 5000ms | 10000ms |

**Note:** AI endpoints depend on Ollama performance and model size.

---

**End of API Reference**

*For usage examples, see [README.md](README.md). For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).*
