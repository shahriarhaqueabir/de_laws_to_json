# Copilot Instructions for German Law Vault

## Project Overview

**German Law Vault** (formerly de_laws_to_json) provides a comprehensive search engine for all German federal laws (>6,000 laws) from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/). The project fetches, processes, and serves German legal texts with natural language search in both English and German.

## Quick Reference

```bash
# Full pipeline
python download_de_laws.py    # Download laws (~1-2 hours)
python process_de_laws.py     # Process to JSON (~30 min)
python app.py                 # Start dashboard (localhost:5000)

# Testing
cd tests && python run_all_tests.py

# Code quality
black . && flake8 .
```

## Architecture & Data Flow

```
TOC Index (XML)
    ↓ [download_de_laws.py — multiprocessing HTTP download]
    de_federal_raw/ (raw ZIP-extracted XMLs)
    ↓ [process_de_laws.py — XML parsing + tokenization]
    de_federal_json/ (normalized JSON; key = law abbreviation e.g. "BGB")
    ↓ [search_index.json — built by app.py on startup]
    app.py (Flask dashboard with TF-IDF search + keyword categories)
```

### Core Data Structure

Every law JSON has this hierarchy:

```json
{
  "key": "BGB",
  "output": {
    "meta": {
      "title": "Bürgerliches Gesetzbuch",
      "download_date": "2024-01-15",
      "last_changed": "2024-01-10"
    },
    "metadaten": {
      "jurabk": "BGB",
      "amtabk": "BMJ",
      "ausfertigung-datum": "1896-08-18"
    },
    "norms": [
      {
        "meta": { "norm_id": "§ 7", "title": "..." },
        "paragraphs": [
          {
            "meta": { "paragraph_id": "1", "token": 28 },
            "content": "..."
          }
        ]
      }
    ]
  }
}
```

Token counts use OpenAI's `cl100k_base` encoding (tiktoken).

## Critical Workflows

### 1. Full Pipeline (Bootstrap All Data)

```bash
python download_de_laws.py      # ~1-2 hours; creates de_federal_raw/
python process_de_laws.py       # ~30 min; creates de_federal_json/
python app.py                   # Starts Flask on http://localhost:5000
```

**Multiprocessing Notes**:
- `download_de_laws.py` uses `multiprocessing` — **breaks in Jupyter**
- `process_de_laws.py` writes JSON in worker processes to avoid IPC issues
- Both scripts log warnings to console; info/debug suppressed

### 2. Incremental Processing

```python
# In process_de_laws.py, set FILE_FILTER for specific laws:
FILE_FILTER = ('BJNR002190897', 'BJNR119530979')  # Empty tuple = all
```

**Note**: `search_index.json` must be rebuilt after modifying JSON files (restart `app.py`).

### 3. HTTP Resilience

- Retries on 429/500-504 with exponential backoff
- Timeouts: TOC 15s, law ZIP 90s, max retries 3
- Unique subdirs per law prevent filename collisions

## Key Implementation Patterns

### XML Parsing (BeautifulSoup + Tokenization)

- `process_de_laws.py::convert_xml_to_dict()` — recursively flattens XML
- `tiktoken.encoding_for_model('gpt-3.5-turbo')` — tokenizes German text
- Norms identified by `<N.P.m>` tags; paragraphs by `<T>` content

### Search Index & TF-IDF (`app.py`)

- Inverted index: `token → law_key → paragraph_count`
- Query flow: English → German translation → synonym expansion → TF-IDF ranking
- Top 50 results; frontend pagination (5 per page)
- Query cache (`_expansion_cache`) with LRU eviction

### Category Keywords

Hardcoded in `app.py` (~12 domains):
- `housing` (Wohnen & Miete)
- `labor` (Arbeit & Beruf)
- `consumer` (Einkaufen & Verträge)
- `traffic` (Verkehr & Transport)
- `family` (Familie & Leben)
- `criminal` (Strafrecht)
- `finance` (Steuern & Finanzen)
- `social` (Gesundheit & Soziales)
- `public` (Staat & Rechte)
- `tech` (Innovation & Umwelt)
- `berlin` (Berlin)

## Directory Organization

```
german-law-vault/
├── app.py                        # Flask dashboard
├── download_de_laws.py           # Law download script
├── process_de_laws.py            # XML to JSON processor
├── unified_translator.py         # AI translation module
├── logging_config.py             # Logging configuration
├── server_watchdog.py            # Auto-restart monitor
├── requirements.txt              # Dependencies
├── README.md                     # Project overview
├── USER_GUIDE.md                 # User documentation
├── DOCUMENTATION.md              # Developer docs
├── CONTRIBUTING.md               # Contribution guidelines
├── SETUP_GUIDE.md                # Setup instructions
├── .env.example                  # Environment template
├── dictionary/                   # Legal dictionary
│   ├── memory_dict.py            # In-memory dictionary
│   ├── legal_dict.py             # Database dictionary
│   └── de_en_reversed.json       # Reverse lookup data
├── static/                       # Frontend assets
│   ├── css/main.css
│   └── js/*.js
├── templates/                    # HTML templates
│   └── index.html
├── tests/                        # Test suite
├── de_federal_raw/               # Raw XML files (git-ignored)
├── de_federal_json/              # Processed JSON files (git-ignored)
└── Logs/                         # Log files (git-ignored)
```

## Development & Debugging

### Verification Scripts

- `tests/test_dict_lookup.py` — Dictionary lookup tests
- `tests/test_unified_translation.py` — Translation tests
- `dedupe_processed_data.py` — Remove duplicate laws

### Common Pitfalls

1. **Multiprocessing in Jupyter**: Remove or wrap in `if __name__ == '__main__':`
2. **Windows IPC errors**: Fixed by writing JSON in worker processes
3. **Search doesn't find laws**: Restart `app.py` to rebuild index
4. **Download timeouts**: Increase `DOWNLOAD_TIMEOUT` or `MAX_RETRIES`

### Edit Conventions

- Timestamps: ISO 8601 (`2024-10-20`)
- Metadata keys: German (e.g., `ausfertigung-datum`)
- Law abbreviations: Uppercase (BGB, StGB)
- Paragraph IDs: Numeric strings (`"1"`, `"2"`) or `"§ 7"`
- All JSON: UTF-8 encoded

## Dependencies

See [requirements.txt](requirements.txt):

| Package | Purpose |
|---------|---------|
| `flask>=3.1.0` | Web server |
| `requests>=2.32.5` | HTTP downloads |
| `beautifulsoup4>=4.14.3` | XML parsing |
| `lxml>=6.0.2` | Fast XML parser |
| `tiktoken>=0.14.0` | Tokenization |
| `tqdm>=4.67.3` | Progress bars |
| `urllib3>=2.6.3` | HTTP retry logic |

**Python**: 3.13+ recommended

## Configuration

### Environment Variables

```bash
OLLAMA_URL=http://127.0.0.1:11434/api/generate
OLLAMA_MODEL=qwen2.5:1.5b
OLLAMA_TIMEOUT=120
EXPANSION_CACHE_SIZE=1000
```

### Admin API

All admin endpoints require `X-Admin-Token` header (generated at runtime).

```bash
# Get admin token from app.py source or browser console
curl -H "X-Admin-Token: <token>" http://localhost:5000/api/admin/info
```

## Frontend Notes

**Known Issues** (see `Documentation and AI Instructions/TODO.md`):
- `#history-section` partially implemented
- Debounce for search input not wired
- Some dead code in modal logic

## Security Notes

- **Local-only**: Binds to `127.0.0.1` — not for public deployment
- **No authentication**: Admin token generated at runtime
- **Rate limiting**: Applied to admin endpoints
- **Input sanitization**: DOMPurify for XSS prevention

## Quick Start for New Contributors

1. Read [DOCUMENTATION.md](DOCUMENTATION.md) for architecture
2. Understand the **three-stage pipeline**: download → process → serve
3. Multiprocessing is used — never assume synchronous execution
4. `search_index.json` is ephemeral (rebuilt on app restart)
5. German abbreviations: BGB = Bürgerliches Gesetzbuch, StGB = Strafgesetzbuch

## Testing

```bash
# Run all tests
cd tests
python run_all_tests.py

# Run with pytest
pytest tests/ -v

# Code quality
black . && flake8 .
```

## Documentation

- [README.md](../README.md) — Project overview
- [USER_GUIDE.md](../USER_GUIDE.md) — User instructions
- [DOCUMENTATION.md](../DOCUMENTATION.md) — Developer guide
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) — Installation guide
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guidelines
- [API_REFERENCE.md](../Documentation%20and%20AI%20Instructions/API_REFERENCE.md) — API docs
