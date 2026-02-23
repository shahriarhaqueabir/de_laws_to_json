<div align="center">
  <h3 align="center">Deutsches Rechtsportal</h3>
  <p align="center">German Law Search Dashboard with AI Assistance</p>
</div>

---

## 📋 Overview

**German Law Search** is a comprehensive legal search system that enables natural language search across 6,500+ German federal laws. It features bilingual (English/German) query support, AI-powered legal explanations, and a modern web dashboard.

### Key Features

- **Complete Coverage:** All 6,500+ German federal laws from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/)
- **Bilingual Search:** Query in English or German with automatic translation and synonym expansion
- **AI Assistance:** Local AI (Ollama) provides legal explanations and translations
- **Fast Search:** TF-IDF-based inverted index with sub-50ms query response
- **Modern UI:** Dark-themed, responsive web dashboard with category filtering
- **Offline-First:** All data stored locally; no external API dependencies (except optional AI)

### Example Output

Search for "tenant rights eviction" → Returns matching laws from BGB (Civil Code) with highlighted paragraphs:

```json
{
  "key": "BGB",
  "title": "Bürgerliches Gesetzbuch",
  "relevance": 95,
  "relevant_norms": [
    "§ 543: Außerordentliche fristlose Kündigung aus wichtigem Grund",
    "§ 573: Ordentliche Kündigung des Vermieters"
  ]
}
```

---

## 🚀 Quick Start

### One-Click Setup (Windows)

```bash
# Run the automated setup script
.\run_dashboard.bat
```

This will:
1. Create virtual environment
2. Install dependencies
3. Check/install Ollama (AI engine)
4. Download all laws (~6,500 XML files)
5. Process to JSON
6. Remove duplicates
7. Build Dictionary Database (100,000+ terms)
8. Start the Dashboard at http://127.0.0.1:5000

### Manual Setup

#### 1. Prerequisites

- **Python:** 3.10+ (tested on 3.14.2)
- **Ollama:** Optional, for AI features ([Download](https://ollama.com))

#### 2. Install Dependencies

```bash
# Create virtual environment
python -m venv .venv

# Activate
.venv\Scripts\activate    # Windows
source .venv/bin/activate # Linux/macOS

# Install Python packages
pip install -r requirements.txt
```

#### 3. Download Laws

```bash
python download_de_laws.py
```

**Output:** `de_federal_raw/` directory with XML files

#### 4. Process to JSON

```bash
python process_de_laws.py
```

**Output:** `de_federal_json/` directory with structured JSON files

#### 5. Remove Duplicates

```bash
python dedupe_processed_data.py
```

#### 6. Build Dictionary Database (One-Time)

```bash
# Build the TEI-based dictionary (100,000+ terms)
python dictionary/parse_tei_dictionary.py
python dictionary/reverse_dictionary.py
python dictionary/build_dictionary_db.py --rebuild
```

**Output:** `dictionary/dictionary.db` (29 MB, 100,000+ terms)

#### 7. Start Dashboard

```bash
python app.py
```

Open http://127.0.0.1:5000 in your browser.

---

## 📁 Project Structure

```
German Law/
├── app.py                      # Flask backend (~1,870 lines)
├── download_de_laws.py         # Law downloader
├── process_de_laws.py          # XML → JSON processor
├── dedupe_processed_data.py    # Duplicate remover
├── requirements.txt            # Python dependencies
├── run_dashboard.bat           # Windows one-click launcher
│
├── dictionary/                 # TEI-based dictionary module
│   ├── dictionary.db           # SQLite database (29 MB, 100k+ terms)
│   ├── legal_dict.py           # Dictionary lookup class
│   ├── compound_words.py       # Compound word decomposer
│   ├── legal_priority_terms.csv # 326 curated legal terms
│   └── README.md               # Dictionary documentation
│
├── templates/
│   └── index.html              # Frontend dashboard (3,182 lines)
│
├── de_federal_raw/             # Downloaded XML files (auto-generated)
├── de_federal_json/            # Processed JSON laws (auto-generated)
├── search_index.json           # Search index cache (auto-generated)
├── ai_translations.json        # AI translation cache (auto-generated)
│
└── docs/
    ├── README.md                        # User guide
    ├── AI_GUIDE.md                      # AI agent handover
    ├── AI_TRANSLATION_ENHANCEMENT.md    # Hybrid AI translation
    ├── DICTIONARY_INTEGRATION.md        # Dictionary integration
    ├── ARCHITECTURE.md                  # System architecture
    ├── API_REFERENCE.md                 # API documentation
    ├── BACKEND_FRONTEND_REVIEW.md       # Code review
    ├── TODO.md                          # Pending tasks
    └── DOCS_INDEX.md                    # Documentation index
```

---

## 🔧 Configuration

### Environment Variables (Optional)

```bash
# Search
EXPANSION_CACHE_SIZE=1000      # Query expansion cache size
RATE_LIMIT_SEARCH=30           # Searches per minute
RATE_PERIOD_SEARCH=60

# Generic API
RATE_LIMIT_GENERIC=60          # Requests per minute
RATE_PERIOD_GENERIC=60

# AI Translation
RATE_LIMIT_TRANSLATE=60        # Translations per minute
RATE_PERIOD_TRANSLATE=60
TRANSLATION_SAVE_INTERVAL=30   # Save cache every N seconds

# Ollama (AI)
OLLAMA_MODEL=llama3.2          # Model name
OLLAMA_URL=http://127.0.0.1:11434/api/generate
OLLAMA_TIMEOUT=120             # Request timeout (seconds)
OLLAMA_MAX_RETRIES=3
OLLAMA_RETRY_BACKOFF=1.0

# AI Chat
RATE_LIMIT_AI_CHAT=5           # Chat requests per minute
RATE_PERIOD_AI_CHAT=60
```

Set via:
```bash
# Windows
set OLLAMA_MODEL=mistral:7b

# Linux/macOS
export OLLAMA_MODEL=mistral:7b
```

---

## 📖 Usage

### Web Dashboard

1. **Search:** Type natural language queries in English or German
   - Example: "tenant rights eviction" or "Mieter Kündigung"
2. **Browse:** Click "Browse Laws" to view all laws by category
3. **Categories:** Filter by legal domain (Housing, Labor, Criminal, etc.)
4. **AI Assist:** Click "Ask AI" for legal explanations

### API Endpoints

#### Search
```bash
curl -X POST http://localhost:5000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tenant rights", "category": "housing"}'
```

#### Get Law
```bash
curl http://localhost:5000/api/law/BGB
```

#### List Laws
```bash
curl "http://localhost:5000/api/laws?page=1&per_page=20&category=housing"
```

#### AI Translate
```bash
curl -X POST http://localhost:5000/api/ai_translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Kündigung", "is_title": true}'
```

#### AI Chat
```bash
curl -X POST http://localhost:5000/api/ai_chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What are my rights as a tenant?", "context": "..."}'
```

**Full API documentation:** See [API_REFERENCE.md](API_REFERENCE.md)

---

## 🏛️ Data Pipeline

### 1. Download (`download_de_laws.py`)

- Fetches index from https://www.gesetze-im-internet.de/gii-toc.xml
- Downloads 6,500+ ZIP files in parallel (4 workers)
- Extracts XML to `de_federal_raw/<law_name>/`
- **Resume support:** Skips already-downloaded laws
- **Time:** ~10-20 minutes (depends on connection)

### 2. Process (`process_de_laws.py`)

- Parses XML with BeautifulSoup + lxml
- Extracts metadata, norms, paragraphs
- Deduplicates paragraphs and norms
- Writes structured JSON to `de_federal_json/`
- **Time:** ~5-10 minutes

### 3. Deduplicate (`dedupe_processed_data.py`)

- Removes laws with duplicate titles
- Keeps shortest filename in case of collision
- **Time:** ~30 seconds

### 4. Index (`app.py` startup)

- Builds TF-IDF inverted index
- Caches to `search_index.json` for fast startup
- **Time:** ~1-2 minutes (first run), ~5 seconds (cached)

---

## 🗂️ Data Schema

### Law JSON Format

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

### Categories

Laws are auto-categorized based on keyword matching:

| Category | Icon | Example Laws |
|----------|------|--------------|
| 🏠 Housing | `housing` | BGB (Mietrecht), WoHG |
| 💼 Labor | `labor` | BGB (Arbeitsrecht), KSchG |
| 🛍️ Consumer | `consumer` | BGB (Verbraucherschutz), UWG |
| 🚗 Traffic | `traffic` | StVO, BGB (Verkehrsunfall) |
| 👨‍👩‍👧‍👦 Family | `family` | BGB (Familienrecht), FamFG |
| ⚖️ Criminal | `criminal` | StGB, StPO |
| 💶 Finance | `finance` | AO, EStG, BGB (Finanzen) |
| 🏥 Social | `social` | SGB I-XII |
| 🏛️ Public | `public` | GG, VwVfG, DSGVO |
| 🌱 Tech | `tech` | UrhG, PatG, TKG |
| 🐻 Berlin | `berlin` | Bln Landesrecht |

---

## 🤖 AI Features

### Requirements

- **Ollama:** Install from https://ollama.com
- **Model:** `llama3.2` (default) or any compatible model
  ```bash
  ollama pull llama3.2
  ```

### Features

1. **AI Translation:** German → English for law titles and paragraphs
   - Cached in `ai_translations.json`
   - Background save every 30 seconds

2. **AI Legal Chat:** Context-aware legal explanations
   - Uses retrieved law context
   - Streams responses in real-time
   - Structured output (Summary, Analysis, Guidance)

### Custom Model

```bash
# Use a different model
set OLLAMA_MODEL=mistral:7b
ollama pull mistral:7b
python app.py
```

---

## 🧪 Testing & Verification

### Verify Specific Laws

```bash
# Check Grundgesetz (GG.json)
python verify_gg.py

# Check norm IDs in BGB, FamFG, StGB, SGB 8
python verify_norms.py
```

### Debug Mode

```python
# In app.py, change logging level
logging.basicConfig(level=logging.DEBUG)
```

### Admin Endpoints

```bash
# Get system info
curl http://localhost:5000/api/admin/info \
  -H "X-Admin-Token: <ADMIN_KEY>"

# Rebuild index
curl -X POST http://localhost:5000/api/admin/rebuild_index \
  -H "X-Admin-Token: <ADMIN_KEY>"

# Toggle debug logging
curl -X POST http://localhost:5000/api/admin/toggle_debug \
  -H "X-Admin-Token: <ADMIN_KEY>"
```

**Note:** Admin key is generated at startup and passed to frontend. Check browser console or page source.

---

## ⚠️ Known Limitations

1. **Sentence-level parsing:** Not supported; smallest unit is paragraph ("Absatz")
2. **Empty laws:** Some laws contain only images (no text content)
3. **Malformed XML:** ~1-2% may have parsing issues (logged to console)
4. **AI offline:** If Ollama is down, AI features degrade gracefully (German text still shown)

---

## 🔒 Security Notes

### Current Deployment Model

- **Localhost-only:** Binds to `127.0.0.1:5000` (not externally accessible)
- **In-memory rate limiting:** Per-IP rate limiting (resets on restart)
- **Admin auth:** Token-based (generated at startup)

### For Production Use

⚠️ **This system is designed for local development/research. For production:**

1. Replace admin token auth with session-based or OAuth2
2. Add persistent rate limiting (Redis backend)
3. Enable HTTPS with proper certificates
4. Sanitize all AI output before DOM insertion
5. Add request size limits:
   ```python
   app.config['MAX_CONTENT_LENGTH'] = 16 * 1024
   ```
6. Implement Content Security Policy headers

See [AI_GUIDE.md](AI_GUIDE.md) for detailed security recommendations.

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | User guide (this file) |
| [AI_GUIDE.md](AI_GUIDE.md) | AI agent handover guide |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & architecture |
| [API_REFERENCE.md](API_REFERENCE.md) | Complete API documentation |
| [BACKEND_FRONTEND_REVIEW.md](BACKEND_FRONTEND_REVIEW.md) | Code review findings |
| [TODO.md](TODO.md) | Pending improvements |

---

## 🛠️ Troubleshooting

### Issue: "Index not building" error

**Solution:**
```bash
# Check if data exists
ls de_federal_json/

# If empty, run pipeline
python download_de_laws.py
python process_de_laws.py

# Restart
python app.py
```

### Issue: Ollama connection timeout

**Solution:**
```bash
# Check Ollama
ollama list

# Pull model
ollama pull llama3.2

# Increase timeout
set OLLAMA_TIMEOUT=180
```

### Issue: Search returns no results

**Debug:**
```bash
# Check index status
curl http://localhost:5000/api/status

# Expected:
# {"ready": true, "laws": 6500, "total_norms": 150000}
```

### Issue: Frontend not loading

1. Check backend: http://localhost:5000/api/status
2. Clear browser cache (Ctrl+Shift+R)
3. Check browser console for JS errors
4. Verify no CORS errors in Network tab

---

## 📈 Performance

| Metric | Value |
|--------|-------|
| Total laws | 6,500+ |
| Total norms | ~150,000+ |
| Index build time | 1-2 min (first), 5 sec (cached) |
| Search latency | <50ms (typical) |
| Memory usage | 200-400 MB |
| Disk usage | ~500 MB (JSON) + ~200 MB (XML) |

---

## 🤝 Contributing

### Adding Features

1. **Backend:** Add routes in `app.py` (after line 1200)
2. **Frontend:** Modify `templates/index.html` (vanilla JS only)
3. **Data:** Update `process_de_laws.py` for schema changes

### Testing

```bash
# Quick test (single law)
FILE_FILTER=('BGB') python process_de_laws.py

# Verify
python verify_norms.py

# Run dashboard
python app.py
```

---

## 📄 License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

---

## 🔗 References

- **Source Data:** https://www.gesetze-im-internet.de/
- **Ollama:** https://ollama.ai/
- **Flask:** https://flask.palletsprojects.com/
- **BeautifulSoup:** https://www.crummy.com/software/BeautifulSoup/

---

**Last Updated:** February 23, 2026  
**Python Version:** 3.14.2 (tested)  
**Status:** Production-ready for local/research use
