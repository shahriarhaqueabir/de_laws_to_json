# AI Handover Guide — German Law Search System

**Project:** Deutsches Rechtsportal (German Law Search Dashboard)  
**Last Updated:** February 23, 2026  
**License:** Apache 2.0  
**Python Version:** 3.14.2 (tested)

---

## 🎯 Quick Start for AI Agents

This is a **complete legal search system** that:
1. Downloads 6,500+ German federal laws from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/)
2. Processes XML → structured JSON with paragraph-level granularity
3. Provides a bilingual (EN/DE) search dashboard with AI-powered legal assistance
4. **NEW:** TEI-based dictionary (100,000+ terms) for enhanced translation
5. **NEW:** Hybrid AI translation (dictionary + Ollama) for fast, accurate results

### Core Commands
```bash
# Full setup (Windows)
.\run_dashboard.bat

# Manual pipeline
python download_de_laws.py    # Download XML laws
python process_de_laws.py     # Convert to JSON
python dedupe_processed_data.py  # Remove duplicates

# Build dictionary database (one-time)
python dictionary/parse_tei_dictionary.py
python dictionary/reverse_dictionary.py
python dictionary/build_dictionary_db.py --rebuild

python app.py                 # Start web dashboard
```

### Key URLs
- **Dashboard:** http://127.0.0.1:5000
- **API Base:** http://127.0.0.1:5000/api/
- **Source:** https://www.gesetze-im-internet.de/gii-toc.xml

---

## 📁 Project Structure

```
German Law/
├── app.py                      # Flask backend (~1,870 lines)
├── download_de_laws.py         # Law downloader (multiprocessing)
├── process_de_laws.py          # XML → JSON processor
├── dedupe_processed_data.py    # Duplicate remover
├── verify_gg.py                # Verification script (GG = Grundgesetz)
├── verify_norms.py             # Norm ID verification
├── requirements.txt            # Python dependencies
├── run_dashboard.bat           # Windows one-click launcher
├── ai_translations.json        # AI translation cache (auto-generated)
├── search_index.json           # Search index cache (auto-generated)
│
├── dictionary/                 # NEW: TEI-based dictionary module
│   ├── dictionary.db           # SQLite database (29 MB, 100k+ terms)
│   ├── legal_dict.py           # Dictionary lookup class
│   ├── compound_words.py       # Compound word decomposer
│   ├── legal_priority_terms.csv # 326 curated legal terms
│   ├── schema.sql              # Database schema
│   ├── parse_tei_dictionary.py # TEI XML parser
│   ├── reverse_dictionary.py   # EN→DE to DE→EN reversal
│   ├── build_dictionary_db.py  # Database builder
│   ├── test_dictionary.py      # Integration tests
│   └── README.md               # Dictionary documentation
│
├── templates/
│   ├── index.html              # Frontend (3,182 lines) - Search dashboard
│   └── [dictionary files]      # Offline translation dictionaries (eng-deu.tei)
│
├── de_federal_raw/             # Downloaded XML files (auto-generated)
├── de_federal_json/            # Processed JSON laws (6,500+ files)
│
└── docs/
    ├── README.md                        # User-facing documentation
    ├── AI_GUIDE.md                      # This file - AI agent handover
    ├── AI_TRANSLATION_ENHANCEMENT.md    # NEW: AI translation details
    ├── DICTIONARY_INTEGRATION.md        # NEW: Dictionary integration guide
    ├── ARCHITECTURE.md                  # System design
    ├── API_REFERENCE.md                 # API endpoint docs
    ├── BACKEND_FRONTEND_REVIEW.md       # Code review findings
    ├── TODO.md                          # Pending tasks
    └── DOCS_INDEX.md                    # Documentation index
```

---

## 🏗️ System Architecture

### Data Flow
```
┌─────────────────────┐
│ gesetze-im-internet │
│     (XML Source)    │
└──────────┬──────────┘
           │ HTTP Download
           ▼
┌─────────────────────┐
│  download_de_laws   │
│   (Multiprocessing) │
└──────────┬──────────┘
           │ XML Files
           ▼
┌─────────────────────┐
│  process_de_laws    │
│ (BeautifulSoup+lxml)│
└──────────┬──────────┘
           │ JSON Files
           ▼
┌─────────────────────┐
│     dedupe_laws     │
│  (Title matching)   │
└──────────┬──────────┘
           │ Clean JSON
           ▼
┌─────────────────────┐
│      app.py         │◄────┐
│  - TF-IDF Index     │     │
│  - Search API       │     │
│  - AI Chat (Ollama) │     │
└──────────┬──────────┘     │
           │                │
           ▼                │
┌─────────────────────┐     │
│   index.html        │─────┘
│  - Search UI        │ AJAX
│  - Results Display  │
│  - AI Assistant     │
└─────────────────────┘
```

### Component Responsibilities

| Component | Lines | Purpose |
|-----------|-------|---------|
| `app.py` | 1,680 | Flask backend: search engine, API routes, AI integration |
| `index.html` | 3,182 | Vanilla JS frontend: search UI, results, AI chat |
| `download_de_laws.py` | ~200 | Parallel XML downloader with retry logic |
| `process_de_laws.py` | ~400 | XML parser with paragraph deduplication |

---

## 🔍 Search Engine Details

### Index Structure
```python
# In-memory data structures (thread-safe)
_law_summaries: List[Dict]      # Metadata for all laws
_inverted: Dict[str, List[Tuple[int, float]]]  # Term → [(law_idx, score)]
_sorted_terms: List[str]        # For prefix lookups via bisect
```

### Query Expansion Pipeline (ENHANCED)
```
User Query (EN/DE)
    │
    ▼
tokenize() → lowercase, remove stopwords, strip punctuation
    │
    ▼
expand_query() → English→German translation + synonym expansion
    │
    ├── legal_dict.get_translations()  # NEW: 100,000+ terms (Priority 1)
    ├── EN_DE: Dict[str, List[str]]    # Static: 200+ legal terms (Priority 2)
    └── DE_EXPANSIONS: Dict[str, List] # German synonyms (Priority 3)
    │
    ▼
Search inverted index with weighted scoring:
    - Law key match: +20.0
    - Title match: +10.0
    - Norm ID/title: +3.0
    - Paragraph preview: +0.4
    │
    ▼
Rank by TF-IDF-style score, return top 20
```

### Key Functions in `app.py`
```python
tokenize(text)              # Text normalization
expand_query(raw)           # Bilingual query expansion (ENHANCED with dictionary)
search_laws(query, top_k)   # Main search logic
build_index(force)          # Index construction (background thread)
_populate_inverted_pure()   # Inverted index builder
```

### Dictionary Integration
```python
# In app.py (automatically loaded)
from dictionary.legal_dict import get_legal_dictionary
legal_dict = get_legal_dictionary()

# Usage in expand_query()
translations = legal_dict.get_translations("Kündigung")
# Returns: [{'english': 'termination', 'frequency': 90, 'source': 'legal_priority'}]
```

---

## 🤖 AI Integration (Ollama) - ENHANCED

### Configuration
```bash
# Environment variables (optional)
OLLAMA_MODEL=llama3.2          # Default model
OLLAMA_URL=http://127.0.0.1:11434/api/generate
OLLAMA_TIMEOUT=120             # Seconds
OLLAMA_MAX_RETRIES=3
```

### Features (ENHANCED with Dictionary)

1. **Hybrid AI Translation:** Dictionary + Ollama refinement
   - **Endpoint:** `POST /api/ai_translate`
   - **Single words:** Dictionary only (<5ms, no AI call)
   - **Short phrases:** Dictionary draft + AI refinement (1-2s)
   - **Long text:** AI only with dictionary fallback
   - **Cached** in `ai_translations.json`
   - **Background saver** every 30s

2. **AI Legal Chat:** Context-aware legal explanations
   - **Endpoint:** `POST /api/ai_chat`
   - **Enhanced with:** Dictionary term detection
   - **Streams responses** (SSE-like)
   - **Uses retrieved law context + German term translations**

### Translation Flow (Hybrid Approach)
```
German Text
     │
     ├─ Single word? → Dictionary → Translation (<5ms)
     │
     ├─ Short phrase? → Dictionary draft → AI refine → Translation (~1-2s)
     │
     └─ Long text? → AI only → Translation (~2-5s)
                        ↓
                 (Fallback to dictionary if AI fails)
```

### Example Responses
```json
// Single word (dictionary)
{
  "translation": "termination",
  "source": "dictionary",
  "dictionary_used": true
}

// Short phrase (AI refined)
{
  "translation": "The tenant can terminate...",
  "source": "ai_refined",
  "dictionary_used": true
}

// AI failure (dictionary fallback)
{
  "translation": "Der Mieter kann...",
  "source": "dictionary_fallback",
  "error": "Ollama connection timeout"
}
```

### Prompt Template (AI Chat - Enhanced)
```python
prompt = (
    "### SYSTEM\n"
    "You are an expert German Legal Assistant...\n\n"
    "### CONTEXT\n"
    f"Relevant legal metadata and norm snippets:\n{context}\n\n"
    # NEW: Dictionary-based term translations
    f"Key German terms detected:\n"
    f"Mieter → tenant\n"
    f"Kündigung → termination\n\n"
    "### TASK\n"
    f'Analyze and answer: "{query}"\n\n'
    "### OUTPUT STRUCTURE\n"
    "1. **Summary**: Brief overview...\n"
    "2. **Detailed Analysis**: Breakdown...\n"
    "3. **Practical Guidance**: Conclusion...\n"
)
```

---

## 🗂️ Data Schema

### Law JSON Structure
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
          "text": "(1) Wer sich an einem Orte ständig niederlässt..."
        }
      ]
    }
  ]
}
```

### Search Index Schema (`search_index.json`)
```json
{
  "summaries": [
    {
      "key": "BGB",
      "title": "Bürgerliches Gesetzbuch",
      "category": "housing",
      "norms": [...],
      "file_path": "./de_federal_json/BGB.json"
    }
  ],
  "inverted": {
    "miete": [[0, 10.5], [15, 3.2]],
    "wohnung": [[0, 8.1], [22, 5.0]]
  }
}
```

---

## 🔧 Development Guide

### Setting Up Environment
```bash
# 1. Create virtual environment
python -m venv .venv

# 2. Activate
.venv\Scripts\activate    # Windows
source .venv/bin/activate # Linux/macOS

# 3. Install dependencies
pip install -r requirements.txt

# 4. Install Ollama (for AI features)
# Download from https://ollama.com
ollama pull llama3.2
```

### Running Tests
```bash
# Verify specific laws
python verify_gg.py      # Check Grundgesetz (GG.json)
python verify_norms.py   # Check BGB, FamFG, StGB norm IDs
```

### Debugging
```python
# Enable debug logging in app.py
logging.basicConfig(level=logging.DEBUG)

# Or use admin endpoint
POST /api/admin/toggle_debug
Headers: X-Admin-Token: <ADMIN_KEY>
```

### Admin Endpoints
```bash
# Get system info
GET /api/admin/info
Headers: X-Admin-Token: <ADMIN_KEY>

# Rebuild search index
POST /api/admin/rebuild_index

# Clear translations (deprecated)
POST /api/admin/clear_translations
```

**Note:** Admin key is generated at runtime (`ADMIN_API_KEY` in `app.py`) and passed to frontend template. For production, replace with session-based auth.

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Sentence-level parsing:** Not supported; smallest unit is paragraph ("Absatz")
2. **Empty laws:** Some laws contain only images (no text)
3. **Malformed XML:** ~1-2% of laws may have parsing issues
4. **Rate limiting:** Server-side rate limiting exists but is basic (in-memory)

### Security Considerations (from code review)
1. **Admin key exposure:** Key passed to frontend template (line 1476)
   - **Mitigation:** Localhost-only deployment (HOST="127.0.0.1")
   - **Future:** Implement session-based auth

2. **XSS potential:** Some `.innerHTML` usage with AI-generated content
   - **Mitigation:** DOMPurify loaded (line 17 of index.html)
   - **Future:** Sanitize all AI output before DOM insertion

3. **No request size limits:** Potential DoS via long queries
   - **Future:** Add `app.config['MAX_CONTENT_LENGTH'] = 16 * 1024`

### Performance Notes
- Index build time: ~2-5 minutes for 6,500 laws
- Search latency: <50ms for typical queries
- Memory usage: ~200-400MB for full index
- Frontend: 3,182 lines vanilla JS (no framework dependencies)

---

## 📊 Categories System

Laws are auto-categorized based on keyword matching:

| Category | Icon | Keywords |
|----------|------|----------|
| `housing` | 🏠 | miet, wohnung, pacht, eigenbedarf, nachbar |
| `labor` | 💼 | arbeit, kündigung, lohn, tarif, urlaub |
| `consumer` | 🛍️ | kauf, gewährleistung, vertrag, widerruf |
| `traffic` | 🚗 | verkehr, stvo, parken, unfall, führerschein |
| `family` | 👨‍👩‍👧‍👦 | ehe, kind, scheidung, unterhalt, erbe |
| `criminal` | ⚖️ | stgb, straf, diebstahl, betrug, körperverletzung |
| `finance` | 💶 | steuer, finanz, bank, zins, insolvenz |
| `social` | 🏥 | sgb, rente, kranken, pflege, bürgergeld |
| `public` | 🏛️ | grundgesetz, asyl, polizei, datenschutz |
| `tech` | 🌱 | umwelt, energie, digital, urheber, klima |
| `berlin` | 🐻 | bln, berlin, landes, bauo, senat |
| `other` | - | Default for unmatched laws |

---

## 🔄 Data Pipeline

### Download Phase (`download_de_laws.py`)
1. Fetch TOC from `https://www.gesetze-im-internet.de/gii-toc.xml`
2. Parse `<item>` elements (title + link)
3. Download each ZIP in parallel (4 workers max)
4. Extract XML to `de_federal_raw/<law_name>/`
5. Delete ZIP immediately after extraction
6. Resume support: skip already-downloaded laws

### Processing Phase (`process_de_laws.py`)
1. Scan `de_federal_raw/` recursively for XML files
2. Parse each XML with BeautifulSoup + lxml
3. Extract metadata (`<metadaten>`, `<langue>`)
4. Parse norms (`<norm>` tags) with paragraph deduplication
5. Write JSON to `de_federal_json/`
6. Resolve key collisions (e.g., `UStG1980` → `UStG`)

### Deduplication Phase (`dedupe_processed_data.py`)
1. Load all JSON files
2. Track by `meta.title`
3. Remove duplicates (keep shortest filename)
4. Log removed files

---

## 🛠️ Modification Guidelines

### Adding New Features
1. **Backend (app.py):**
   - Add routes after line 1200 (Flask routes section)
   - Use `@rate_limit` decorator for new endpoints
   - Thread-safe: use `_index_lock` for reading shared state

2. **Frontend (index.html):**
   - Vanilla JS only (no framework)
   - Use `fetch()` for API calls
   - Sanitize with `DOMPurify.sanitize()` before `.innerHTML`
   - Follow existing CSS variable pattern (lines 20-60)

3. **Data Processing:**
   - Modify `process_de_laws.py` for schema changes
   - Update `_extract_summary()` in `app.py` for new fields
   - Re-run full pipeline after changes

### Testing Changes
```bash
# 1. Quick test (single law)
FILE_FILTER=('BGB') python process_de_laws.py

# 2. Verify output
python verify_norms.py

# 3. Start dashboard
python app.py

# 4. Test search
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tenant rights"}'
```

---

## 📝 Common Tasks

### Task: Add English Translation Support
```python
# 1. Add to EN_DE dictionary in app.py (line ~550)
EN_DE["new_term"] = ["German1", "German2"]

# 2. Add German synonyms to DE_EXPANSIONS (line ~650)
DE_EXPANSIONS["deutsch"] = ["synonym1", "synonym2"]

# 3. Rebuild index
POST /api/admin/rebuild_index
```

### Task: Change AI Model
```bash
# Set environment variable
set OLLAMA_MODEL=mistral:7b  # Windows
export OLLAMA_MODEL=mistral:7b  # Linux/macOS

# Pull model
ollama pull mistral:7b

# Restart app.py
```

### Task: Add New Category
```python
# In app.py, CATEGORIES dict (line ~100)
CATEGORIES["new_cat"] = {
    "title": "New Category",
    "icon": "🆕",
    "keywords": ["keyword1", "keyword2"],
}

# Update frontend CSS (index.html, line ~50)
--cat-new-cat: #color;
```

---

## 🚨 Troubleshooting

### Issue: "Index not building" error
**Solution:**
```bash
# Check if de_federal_json exists
ls de_federal_json/

# If empty, run pipeline
python download_de_laws.py
python process_de_laws.py

# Force rebuild
curl -X POST http://localhost:5000/api/admin/rebuild_index \
  -H "X-Admin-Token: <ADMIN_KEY>"
```

### Issue: Ollama connection timeout
**Solution:**
```bash
# Check Ollama is running
ollama list

# Pull model if missing
ollama pull llama3.2

# Increase timeout
set OLLAMA_TIMEOUT=180
```

### Issue: Search returns no results
**Debug:**
```python
# In app.py, enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Check index state
GET /api/status

# Expected response:
{
  "ready": true,
  "laws": 6500,
  "total_norms": 150000
}
```

### Issue: Frontend not loading
**Check:**
1. Backend running: `http://localhost:5000/api/status`
2. Browser console for JS errors
3. Network tab for failed API calls
4. Clear browser cache (Ctrl+Shift+R)

### Issue: Dictionary not available
**Solution:**
```bash
# Check if dictionary.db exists
ls dictionary/dictionary.db

# If missing, rebuild
python dictionary/parse_tei_dictionary.py
python dictionary/reverse_dictionary.py
python dictionary/build_dictionary_db.py --rebuild
```

### Issue: Translation returns error
**Debug:**
```bash
# Check Ollama is running
ollama list

# Test dictionary directly
python -c "from dictionary.legal_dict import LegalDictionary; d = LegalDictionary(); print(d.get_translations('Kündigung'))"

# Check admin endpoint
GET /api/admin/dictionary_stats
Headers: X-Admin-Token: <ADMIN_KEY>
```

---

## 📚 Reference Documents

- **README.md:** User-facing setup guide
- **AI_GUIDE.md:** This file - AI agent handover
- **AI_TRANSLATION_ENHANCEMENT.md:** Hybrid AI translation details
- **DICTIONARY_INTEGRATION.md:** Dictionary integration guide
- **ARCHITECTURE.md:** Detailed system design
- **API_REFERENCE.md:** Complete API documentation
- **BACKEND_FRONTEND_REVIEW.md:** Code review findings (Feb 2026)
- **TODO.md:** Pending improvements
- **DOCS_INDEX.md:** Documentation navigation index

---

## 🔐 Security Best Practices

### For Local Development
- ✅ Current: Localhost-only binding (`HOST="127.0.0.1"`)
- ✅ Current: No external network exposure
- ⚠️ Warning: Admin key in template (acceptable for localhost)

### For Production Deployment
1. **Replace admin key auth** with session-based or OAuth2
2. **Add rate limiting** with Redis backend (current: in-memory)
3. **Enable HTTPS** with proper certificates
4. **Sanitize all AI output** before DOM insertion
5. **Add request size limits:**
   ```python
   app.config['MAX_CONTENT_LENGTH'] = 16 * 1024  # 16KB
   ```
6. **Implement CSP headers:**
   ```python
   @app.after_request
   def set_csp(response):
       response.headers['Content-Security-Policy'] = "default-src 'self'"
       return response
   ```

---

## 📈 Performance Optimization Tips

### Backend
- Use `_fast_load_index()` to skip rebuild if cache exists
- Increase `MAX_EXPANSION_CACHE_SIZE` for heavy query diversity
- Use `lru_cache` for `expand_query()` (currently manual LRU)

### Frontend
- Virtualize long result lists (currently capped at 20)
- Debounce search input (currently 200ms)
- Lazy-load paragraph content in modal (already implemented)

### Database
- Pre-build index on deployment (don't build on startup)
- Use SQLite for persistent query cache (currently in-memory)
- Compress JSON files with gzip (currently plain JSON)

---

## 🎓 Learning Resources

- **German Law API:** https://www.gesetze-im-internet.de/
- **Ollama Docs:** https://ollama.ai/
- **Flask Docs:** https://flask.palletsprojects.com/
- **BeautifulSoup:** https://www.crummy.com/software/BeautifulSoup/
- **TF-IDF:** https://en.wikipedia.org/wiki/Tf–idf

---

## 📞 Support

For issues or questions:
1. Check `BACKEND_FRONTEND_REVIEW.md` for known issues
2. Review `TODO.md` for planned improvements
3. Inspect logs: `app.log` (if file logging enabled)
4. Use admin endpoint: `GET /api/admin/info`

---

**End of AI Handover Guide**

*This document is maintained as part of the project documentation. Update when making significant architectural changes.*
