# Architecture Documentation

**German Law Search System**  
**Last Updated:** February 23, 2026

---

## 📐 System Overview

The German Law Search System is a **full-stack legal search platform** that processes 6,500+ German federal laws into a searchable format with AI-powered assistance.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         End Users                              │
│                    (Web Browser, CLI)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Presentation Layer                            │
│                                                                  │
││  ┌──────────────────────────────────────────────────────────┐  │
│  │  templates/index.html (3,230+ lines)                     │  │
│  │  - Vanilla JavaScript (no framework)                     │  │
│  │  - CSS Variables + Flexbox/Grid                          │  │
│  │  - DOMPurify for XSS protection                          │  │
│  │  - LocalStorage for bookmarks                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST API (JSON)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer (Flask)                     │
│                                                                  │
││  ┌──────────────────────────────────────────────────────────┐  │
│  │  app.py (1,870+ lines)                                   │  │
││  │  - Search Engine (Hybrid BM25)                           │  │
│  │  - API Endpoints (15+ routes)                            │  │
│  │  - AI Integration (Ollama + Insights)                    │  │
│  │  - Rate Limiting (In-memory)                             │  │
│  │  - Dev Dashboard health monitoring                       │  │
│  │  - AI Kill Switch persisted state                        │  │
│  │  - Thread-safe Index Management                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ File I/O
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  de_federal  │  │   search_    │  │    ai_       │         │
│  │  _json/      │  │   index.json │  │translations  │         │
│  │  (6,500+     │  │   (Inverted  │  │  .json       │         │
│  │   files)     │  │    Index)    │  │  (Cache)     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │  de_federal  │  │   External   │                             │
│  │  _raw/       │  │   AI (Ollama)│                             │
│  │  (XML)       │  │  localhost:  │                             │
│  │              │  │   11434      │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architectural Patterns

### 1. Layered Architecture

```
┌─────────────────┐
│  Presentation   │  ← HTML/CSS/JS (index.html)
├─────────────────┤
│  Application    │  ← Flask Backend (app.py)
├─────────────────┤
│  Data           │  ← JSON Files + Search Index
└─────────────────┘
```

**Benefits:**
- Clear separation of concerns
- Easy to test each layer independently
- Scalable (can swap layers)

---

### 2. Event-Driven Indexing

```python
# Background thread builds index on startup
threading.Thread(target=build_index, daemon=True).start()

# Frontend polls for readiness
setInterval(async () => {
    const status = await fetch('/api/status');
    if (status.ready) { enableSearch(); }
}, 1000);
```

**Flow:**
1. App starts → Index build triggered in background
2. Frontend loads → Polls `/api/status` every second
3. Index ready → `/api/status` returns `ready: true`
4. Search enabled → User can query

---

### 3. CQRS (Command Query Responsibility Segregation)

**Commands (Write Operations):**
- `POST /api/admin/rebuild_index` - Rebuild search index
- `POST /api/admin/toggle_debug` - Toggle debug logging
- `POST /api/dev/toggle` - Manage AI Kill Switch or other features
- `POST /api/ai_translate` - Cache translation

**Queries (Read Operations):**
- `GET /api/laws` - List laws
- `GET /api/law/<key>` - Get law details
- `POST /api/search` - Search laws
- `GET /api/status` - Get initialization status
- `GET /api/dev/health` - Get real-time system health (Tier S Dashboard)

**Benefits:**
- Read operations optimized for speed (inverted index)
- Write operations rare and isolated
- Clear API semantics

---

### 4. Repository Pattern (Implicit)

```python
# Data access encapsulated in functions
def _extract_summary(fpath: str) -> Optional[Dict]:
    """Extract metadata from JSON file."""
    
def _populate_inverted_pure(summaries: List[Dict]) -> Dict:
    """Build inverted index from summaries."""
    
def search_laws(query: str, top_k: int = 20) -> Dict:
    """Search laws using inverted index."""
```

**Benefits:**
- Data access logic isolated
- Easy to swap storage backend (e.g., JSON → Database)
- Testable with mock repositories

---

## 📊 Data Flow Diagrams

### Search Query Flow

```
User Types Query
       │
       ▼
┌──────────────────┐
│  index.html      │  (Frontend)
│  - Debounce 200ms│
│  - POST /api/search│
└────────┬─────────┘
         │ JSON: {"query": "tenant rights"}
         ▼
┌──────────────────┐
│  app.py          │  (Backend)
│  - rate_limit()  │
│  - expand_query()│
│    EN/DE translation│
│    + synonyms    │
└────────┬─────────┘
         │ German terms: ["mieter", "kündigung"]
         ▼
┌──────────────────┐
│  Inverted Index  │  (In-memory)
│  - _inverted     │
│  - _law_summaries│
│  - TF-IDF scoring│
└────────┬─────────┘
         │ Scores: [(law_idx, score), ...]
         ▼
┌──────────────────┐
│  Ranking         │
│  - Sort by score │
│  - Take top 20   │
│  - Add metadata  │
└────────┬─────────┘
         │ JSON: {"results": [...]}
         ▼
┌──────────────────┐
│  index.html      │
│  - Render cards  │
│  - Highlight terms│
└──────────────────┘
```

---

### Law Processing Pipeline

```
┌──────────────────┐
│  gesetze-im-     │
│  internet.de     │
│  (XML Source)    │
└────────┬─────────┘
         │ HTTP GET (ZIP)
         ▼
┌──────────────────┐
│  download_de_    │
│  laws.py         │
│  - Multiprocessing│
│  - 4 workers     │
│  - Retry logic   │
└────────┬─────────┘
         │ XML Files
         ▼
┌──────────────────┐
│  de_federal_raw/ │
│  (XML Storage)   │
└────────┬─────────┘
         │ Read XML
         ▼
┌──────────────────┐
│  process_de_     │
│  laws.py         │
│  - BeautifulSoup │
│  - lxml parser   │
│  - Deduplication │
└────────┬─────────┘
         │ JSON Files
         ▼
┌──────────────────┐
│  de_federal_json/│
│  (JSON Storage)  │
└────────┬─────────┘
         │ Scan & Index
         ▼
┌──────────────────┐
│  app.py          │
│  - build_index() │
│  - TF-IDF        │
└────────┬─────────┘
         │ search_index.json
         ▼
┌──────────────────┐
│  Search Ready    │
└──────────────────┘
```

---

### AI Translation Flow

```
User Clicks "Translate"
       │
       ▼
┌──────────────────┐
│  index.html      │
│  - Check cache   │
│  - If miss:      │
│    POST /api/    │
│    ai_translate  │
└────────┬─────────┘
         │ {"text": "Kündigung"}
         ▼
┌──────────────────┐
│  app.py          │
│  - Check cache   │
│  - _translation_ │
│    cache         │
└────────┬─────────┘
         │ Cache miss
         ▼
┌──────────────────┐
│  Ollama API      │
│  localhost:11434 │
│  - llama3.2      │
│  - Legal prompt  │
└────────┬─────────┘
         │ "termination"
         ▼
┌──────────────────┐
│  Cache Update    │
│  - _translation_ │
│    cache[text]   │
│  - Background    │
│    save (30s)    │
└────────┬─────────┘
         │ JSON: {"translation": "termination"}
         ▼
┌──────────────────┐
│  index.html      │
│  - Update UI     │
│  - Store in      │
│    localStorage  │
└──────────────────┘
```

---

## 🔧 Component Architecture

### Frontend (index.html)

**Size:** 3,182 lines  
**Dependencies:** DOMPurify (CDN), Google Fonts  
**Architecture:** Vanilla JavaScript (no framework)

#### Component Breakdown

```
index.html
├── HTML Structure (Lines 1-400)
│   ├── <head> - Meta, CSS, Fonts
│   ├── Header - Logo, Status, Controls
│   ├── Hero - Search Bar
│   ├── Main Content
│   │   ├── Search Results Panel
│   │   ├── Browse Laws Panel
│   │   ├── Saved Bookmarks Panel
│   │   └── Settings Panel
│   └── Modals - Law Detail, AI Chat
│
├── CSS Styling (Lines 17-700)
│   ├── Design Tokens (CSS Variables)
│   ├── Layout (Flexbox/Grid)
│   ├── Components (Cards, Buttons, Inputs)
│   ├── Animations (Pulse, Fade, Slide)
│   └── Responsive Design
│
└── JavaScript Logic (Lines 701-3182)
    ├── State Management
    │   ├── cachedLawData
    │   ├── currentGermanTerms
    │   └── vaultPage, vaultCategory
    │
    ├── API Client
    │   ├── fetchVaultLaws()
    │   ├── searchLaws()
    │   ├── fetchLawDetail()
    │   └── aiTranslate(), aiChat()
    │
    ├── UI Rendering
    │   ├── renderResults()
    │   ├── renderModalNorms()
    │   ├── highlight()
    │   └── formatAIMarkdown()
    │
    ├── Event Handlers
    │   ├── Search Input
    │   ├── Tab Switching
    │   ├── Modal Controls
    │   └── Bookmark Management
    │
    └── Utilities
        ├── escapeHTML()
        ├── debounce()
        └── localStorage wrappers
```

---

### Backend (app.py)

**Size:** 1,680 lines  
**Framework:** Flask 3.1.0  
**Dependencies:** beautifulsoup4, lxml, requests

#### Module Structure

```
app.py
├── Configuration (Lines 1-100)
│   ├── Imports
│   ├── Constants (JSON_DIR, HOST, PORT)
│   ├── CATEGORIES (11 legal domains)
│   ├── STOPWORDS (DE + EN)
│   └── EN_DE / DE_EXPANSIONS (Dictionaries)
│
├── Rate Limiting (Lines 73-111)
│   ├── _get_client_id()
│   └── rate_limit() decorator
│
├── Text Processing (Lines 720-760)
│   ├── tokenize()
│   └── expand_query()
│
├── Index Building (Lines 770-1050)
│   ├── _extract_summary()
│   ├── _populate_inverted_pure()
│   ├── _fast_load_index()
│   ├── _build_from_source()
│   ├── _persist_index()
│   └── build_index()
│
├── Search Engine (Lines 1060-1180)
│   └── search_laws()
│
├── API Routes (Lines 1190-1450)
│   ├── GET / (index_page)
│   ├── GET /api/status
│   ├── POST /api/search
│   ├── GET /api/laws
│   ├── GET /api/law/<key>
│   ├── POST /api/ai_translate
│   └── POST /api/ai_chat
│
├── AI Integration (Lines 1200-1400)
│   ├── load_ai_translations()
│   ├── save_ai_translations()
│   ├── _ollama_request()
│   └── _translation_background_saver()
│
└── Admin Endpoints (Lines 1600-1680)
    ├── GET /api/admin/info
    ├── POST /api/admin/rebuild_index
    ├── POST /api/admin/clear_translations
    └── POST /api/admin/toggle_debug
```

---

### Data Processing Scripts

#### download_de_laws.py (200 lines)

```python
Main Functions:
├── _make_session()         # HTTP session with retry
├── _safe_dir_name()        # Sanitize law names
├── process_law()           # Download + extract single law
└── main()                  # Orchestrate parallel download

Flow:
1. Fetch TOC XML from gesetze-im-internet.de
2. Parse <item> elements (title + link)
3. Filter already-downloaded laws
4. Download remaining in parallel (4 workers)
5. Extract XML, delete ZIP
6. Log errors to download_errors.txt
```

#### process_de_laws.py (400 lines)

```python
Main Functions:
├── collect_xml_files()     # Recursive XML scan
├── convert_xml_to_dict()   # XML → Dict conversion
├── _parse_norm()           # Extract single norm
├── _dedupe_exact_norms()   # Remove duplicate norms
├── _dedupe_norm_ids()      # Resolve ID collisions
├── process_file()          # Process single XML
└── main()                  # Orchestrate parallel processing

Flow:
1. Scan de_federal_raw/ for XML files
2. Parse each XML with BeautifulSoup + lxml
3. Extract metadata, norms, paragraphs
4. Deduplicate norms and paragraphs
5. Write JSON to de_federal_json/
6. Resolve key collisions (UStG1980 → UStG)
```

---

## 🗄️ Data Models

### Law JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "meta": {
      "type": "object",
      "properties": {
        "source": {"type": "string"},
        "download_date": {"type": "string", "format": "date"},
        "title": {"type": "string"},
        "last_changed": {"type": "string"},
        "alt_title": {"type": "string"}
      }
    },
    "norms": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "norm_id": {"type": "string"},
          "title": {"type": "string"},
          "paragraphs": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {"type": "string"},
                "text": {"type": "string"}
              }
            }
          }
        }
      }
    }
  }
}
```

---

### Search Index Schema

```json
{
  "summaries": [
    {
      "key": "BGB",
      "title": "Bürgerliches Gesetzbuch",
      "category": "housing",
      "norms": [...],
      "file_path": "./de_federal_json/BGB.json",
      "has_translation": true
    }
  ],
  "inverted": {
    "miete": [[0, 10.5], [15, 3.2]],
    "wohnung": [[0, 8.1], [22, 5.0]]
  }
}
```

**Inverted Index Structure:**
- **Key:** Tokenized term (lowercase, no stopwords)
- **Value:** List of `(law_index, tfidf_score)` tuples
- **Example:** `"miete": [[0, 10.5]]` → Law #0 (BGB) has score 10.5 for "miete"

---

### Query Expansion Schema

```python
# EN_DE: English → German legal terms
EN_DE: Dict[str, List[str]] = {
    "tenant": ["Mieter", "Mieterin"],
    "rent": ["Miete", "Mieterhöhung", "Mietvertrag"],
    "eviction": ["Kündigung", "Räumung", "Räumungsklage"],
}

# DE_EXPANSIONS: German synonyms
DE_EXPANSIONS: Dict[str, List[str]] = {
    "miete": ["mietvertrag", "mieterhöhung", "vermieter", "mieter"],
    "kündigung": ["kündigungsfrist", "abmahnung", "kündigen"],
}
```

---

## 🔐 Security Architecture

### Current Security Model

```
┌─────────────────────────────────────┐
│  Localhost-Only Binding             │
│  HOST = "127.0.0.1"                 │
│  PORT = 5000                        │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  In-Memory Rate Limiting            │
│  - Per-IP tracking                  │
│  - Sliding window (60s)             │
│  - 30 requests/minute (search)      │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Token-Based Admin Auth             │
│  - Generated at startup             │
│  - Passed via X-Admin-Token header  │
│  - Also exposed to frontend         │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  XSS Protection                     │
│  - DOMPurify loaded (CDN)           │
│  - escapeHTML() utility             │
│  - Some .innerHTML usage (risk)     │
└─────────────────────────────────────┘
```

### Threat Model

| Threat | Current Mitigation | Residual Risk |
|--------|-------------------|---------------|
| External attacks | Localhost-only binding | Low (for local use) |
| XSS via search | DOMPurify + escapeHTML | Medium (AI output not sanitized) |
| Rate limit bypass | In-memory per-IP | Medium (resets on restart) |
| Admin endpoint abuse | Token auth | High (token in frontend) |
| DoS via long queries | Query truncation (300 chars) | Low |

---

## 📈 Performance Architecture

### Indexing Performance

```
┌──────────────────────────────────────┐
│  Index Build Time                    │
│  - First run: 1-2 minutes            │
│  - Cached: ~5 seconds                │
│  - Force rebuild: 1-2 minutes        │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Memory Usage                        │
│  - _law_summaries: ~50 MB            │
│  - _inverted: ~100 MB                │
│  - Total: ~150-200 MB                │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  Search Latency                      │
│  - Typical: <50 ms                   │
│  - P95: <100 ms                      │
│  - P99: <200 ms                      │
└──────────────────────────────────────┘
```

### Optimization Techniques

1. **Inverted Index:** O(1) term lookup
2. **Prefix Search:** bisect on sorted terms (O(log n))
3. **LRU Cache:** Query expansion cache (1000 entries)
4. **Atomic File Writes:** Prevent corruption
5. **Background Indexing:** Non-blocking startup
6. **Lazy Loading:** Modal norms loaded on demand

---

## 🔄 Deployment Architecture

### Development Deployment

```
┌─────────────────┐
│  Developer PC   │
│  - Windows/macOS│
│  - Python 3.14  │
│  - Ollama local │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  .venv/         │
│  - Flask app    │
│  - Scripts      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  localhost:5000 │
│  - Dev access   │
└─────────────────┘
```

### Production Deployment (Recommended)

```
┌─────────────────┐
│  Load Balancer  │
│  - HTTPS term.  │
│  - Rate limiting│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Flask App      │
│  - Gunicorn     │
│  - Workers: 4   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redis          │
│  - Rate limits  │
│  - Session store│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  File Storage   │
│  - JSON laws    │
│  - Search index │
└─────────────────┘
```

---

## 🧪 Testing Architecture

### Current Testing

**Manual Testing:**
- `verify_gg.py` - Check Grundgesetz (GG.json)
- `verify_norms.py` - Check norm IDs in BGB, FamFG, StGB

### Proposed Testing Stack

```
┌──────────────────────────────────────┐
│  Unit Tests (pytest)                 │
│  - test_tokenize()                   │
│  - test_expand_query()               │
│  - test_search_laws()                │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Integration Tests                   │
│  - test_search_api()                 │
│  - test_law_detail_api()             │
│  - test_ai_translate()               │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  E2E Tests (Playwright/Selenium)     │
│  - test_search_flow()                │
│  - test_bookmark_flow()              │
│  - test_ai_chat_flow()               │
└──────────────────────────────────────┘
```

---

## 📊 Monitoring & Observability

### Current Logging

```python
# Basic logging (INFO level)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)
```

### Proposed Monitoring Stack

```
┌──────────────────────────────────────┐
│  Application Logs                    │
│  - Request/response logging          │
│  - Error tracking                    │
│  - Performance metrics               │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Metrics (Prometheus)                │
│  - Request rate                      │
│  - Error rate                        │
│  - Search latency (p50, p95, p99)    │
│  - Index size                        │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│  Dashboards (Grafana)                │
│  - Real-time traffic                 │
│  - Error trends                      │
│  - Performance over time             │
└──────────────────────────────────────┘
```

---

## 🔮 Future Architecture Considerations

### Scalability Improvements

1. **Database Backend:**
   - Replace JSON files with SQLite/PostgreSQL
   - Enable complex queries (date ranges, boolean operators)
   - Better concurrency control

2. **Search Engine:**
   - Replace TF-IDF with BM25 or neural search
   - Add Elasticsearch/OpenSearch for distributed search
   - Support for phrase search, fuzzy matching

3. **Caching:**
   - Add Redis for query result caching
   - Cache popular searches
   - Reduce Ollama API calls

4. **Frontend:**
   - Migrate to React/Vue for better state management
   - Implement virtual scrolling for large result sets
   - Add PWA support for offline access

---

## 📝 Design Decisions

### Why TF-IDF Instead of BM25?

**Decision:** Use TF-IDF for simplicity  
**Rationale:**
- Sufficient for German legal text
- No external dependencies
- Easy to understand and debug
- Fast enough for 6,500 laws

**Trade-off:** BM25 might provide better relevance for very long documents

---

### Why Vanilla JavaScript?

**Decision:** No frontend framework  
**Rationale:**
- Single HTML file (easy deployment)
- No build step required
- Fast initial load (no bundle download)
- Sufficient for current feature set

**Trade-off:** State management becomes complex as features grow

---

### Why Local Ollama?

**Decision:** Self-hosted AI (no cloud API)  
**Rationale:**
- Privacy (no data leaves localhost)
- No API costs
- Works offline
- Full control over model

**Trade-off:** Requires local GPU/CPU resources

---

### Why JSON Files Instead of Database?

**Decision:** File-based storage  
**Rationale:**
- Simple deployment (no DB setup)
- Easy to backup (copy directory)
- Git-friendly (version control)
- Sufficient for read-heavy workload

**Trade-off:** No complex queries, limited concurrency

---

**End of Architecture Documentation**

*This document should be updated when making significant architectural changes.*
