# German Law Vault - Developer Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Pipeline](#data-pipeline)
3. [Core Components](#core-components)
4. [API Reference](#api-reference)
5. [Database Schema](#database-schema)
6. [Development Setup](#development-setup)
7. [Testing](#testing)
8. [Contributing Guidelines](#contributing-guidelines)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        German Law Vault                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Download   │───▶│   Process    │───▶│    Serve     │     │
│  │   (XML)      │    │   (JSON)     │    │   (Search)   │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                   │                   │              │
│         ▼                   ▼                   ▼              │
│  de_federal_raw/     de_federal_json/    search_index.json     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  Dictionary  │    │  Translator  │    │     AI       │     │
│  │   (Memory)   │    │   (Unified)  │    │   (Ollama)   │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Python 3.13+, Flask 3.1+ | Web server, API |
| **Frontend** | Vanilla JS, CSS3 | Dashboard UI |
| **Search** | TF-IDF, Inverted Index | Full-text search |
| **Translation** | In-memory dictionary, Ollama | EN↔DE translation |
| **Data** | JSON files | Law storage |

---

## Data Pipeline

### Stage 1: Download (`download_de_laws.py`)

**Purpose**: Fetch all federal laws from gesetze-im-internet.de

**Process**:
1. Fetch TOC index XML from `https://www.gesetze-im-internet.de/gii-toc.xml`
2. Parse law URLs from index
3. Download each law's ZIP file (with retry logic)
4. Extract XML to `de_federal_raw/{law_id}/`

**Key Features**:
- Multiprocessing for parallel downloads
- HTTP retry with exponential backoff
- Unique subdirectories prevent filename collisions
- Progress bars via `tqdm`

**Configuration**:
```python
TOC_URL = "https://www.gesetze-im-internet.de/gii-toc.xml"
TOC_TIMEOUT = 15  # seconds
DOWNLOAD_TIMEOUT = 90  # seconds per law
MAX_RETRIES = 3
BACKOFF_FACTOR = 1.0
```

**Output Structure**:
```
de_federal_raw/
├── bgb/
│   ├── BJNR000010896.xml
│   └── ...
├── stgb/
│   ├── BJNR000020896.xml
│   └── ...
└── ...
```

### Stage 2: Process (`process_de_laws.py`)

**Purpose**: Convert XML to structured JSON

**Process**:
1. Walk `de_federal_raw/` recursively
2. Parse each XML with BeautifulSoup
3. Extract metadata, norms, paragraphs
4. Tokenize content with tiktoken
5. Write JSON to `de_federal_json/`

**Key Features**:
- Multiprocessing with direct file writes (avoids IPC issues)
- BeautifulSoup + lxml for XML parsing
- tiktoken for token counting
- File filter for incremental processing

**Output Schema**:
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
        "meta": {
          "norm_id": "§ 1",
          "title": "Beginn der Rechtsfähigkeit"
        },
        "paragraphs": [
          {
            "meta": {
              "paragraph_id": "1",
              "token": 28
            },
            "content": "Die Rechtsfähigkeit des Menschen beginnt..."
          }
        ]
      }
    ]
  }
}
```

### Stage 3: Index (`app.py` startup)

**Purpose**: Build searchable inverted index

**Process**:
1. Scan `de_federal_json/` for all law files
2. Extract and tokenize titles, keys, content
3. Build inverted index: `token → law_key → paragraph_count`
4. Calculate BM25 metadata (document lengths, avg length)
5. Save index to `search_index.json`

**Index Structure**:
```json
{
  "index": {
    "mieter": {
      "BGB": 45,
      "ZPO": 12
    },
    "kündigung": {
      "BGB": 89,
      "StGB": 3
    }
  },
  "metadata": {
    "doc_lengths": {"BGB": 125000, "StGB": 45000},
    "avgdl": 85000,
    "total_files": 6234
  }
}
```

---

## Core Components

### `app.py` - Flask Application

**Main Responsibilities**:
- Serve web dashboard
- Handle search queries
- Provide admin API endpoints
- Build/maintain search index

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `expand_query()` | Translate EN→DE, expand synonyms |
| `tokenize()` | Lowercase, remove stopwords, stem |
| `_extract_summary()` | Extract law metadata |
| `build_index()` | Build/rebuild search index |
| `search_laws()` | TF-IDF ranked search |
| `_is_admin()` | Admin token validation |

**Search Algorithm**:
```python
# Simplified search flow
def search_laws(query):
    # 1. Translate and expand query
    tokens, german_terms = expand_query(query)
    
    # 2. Look up terms in inverted index
    candidates = {}
    for term in german_terms:
        for law_key, count in index.get(term, {}).items():
            candidates[law_key] = candidates.get(law_key, 0) + count
    
    # 3. Score with BM25-style ranking
    results = []
    for law_key, score in candidates.items():
        law_data = get_law_data(law_key)
        final_score = bm25_score(score, law_data, query_tokens)
        results.append((law_key, final_score))
    
    # 4. Return top 50 sorted by score
    return sorted(results, key=lambda x: -x[1])[:50]
```

### `unified_translator.py` - Translation Module

**Purpose**: Unified translation with caching and dictionary hints

**Translation Flow**:
```
1. Check cache (instant)
   ↓ (miss)
2. Extract dictionary hints (fast)
   ↓
3. Call Ollama with context (accurate)
   ↓
4. Cache result (persistent)
```

**Configuration**:
```python
OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:1.5b"
OLLAMA_TIMEOUT = 120  # seconds
TRANSLATION_SAVE_INTERVAL = 30  # seconds
```

### `dictionary/memory_dict.py` - Legal Dictionary

**Purpose**: Fast in-memory German-English legal dictionary

**Features**:
- Loaded from `de_en_reversed.json`
- O(1) lookup time
- Reverse lookup (EN→DE and DE→EN)
- No database locking

**Usage**:
```python
from dictionary.memory_dict import get_memory_legal_dictionary

legal_dict = get_memory_legal_dictionary()

# Forward lookup (German → English)
translations = legal_dict.get_translations("Kündigung", limit=5)

# Reverse lookup (English → German)
german_terms = legal_dict.get_german_terms("termination")

# Expand query
expanded = legal_dict.expand_query("tenant rights")
```

### `logging_config.py` - Logging

**Loggers**:
| Logger | File | Level | Purpose |
|--------|------|-------|---------|
| `server` | server.log | INFO | General server activity |
| `error` | error.log | ERROR | Errors and exceptions |
| `indexing` | indexing.log | INFO | Index build progress |
| `dictionary` | dictionary.log | INFO | Dictionary operations |
| `ratelimit` | ratelimit.log | INFO | Rate limiting events |
| `ai` | ai.log | INFO | AI/Ollama interactions |

---

## API Reference

### Public Endpoints

#### `GET /api/search`

Search for laws.

**Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `page` | int | No | Page number (default: 1) |
| `per_page` | int | No | Results per page (default: 5) |

**Response**:
```json
{
  "query": "fired without notice",
  "total": 24,
  "page": 1,
  "per_page": 5,
  "results": [
    {
      "key": "BGB",
      "title": "Bürgerliches Gesetzbuch",
      "norm_id": "§ 626",
      "norm_title": "Fristlose Kündigung aus wichtigem Grund",
      "preview": "Das Arbeitsverhältnis kann...",
      "score": 0.95,
      "category": "labor"
    }
  ]
}
```

#### `GET /api/law/<law_key>`

Get full law text.

**Response**:
```json
{
  "key": "BGB",
  "meta": {...},
  "norms": [...]
}
```

#### `GET /api/categories`

List all law categories.

**Response**:
```json
{
  "housing": {"title": "Wohnen & Miete", "icon": "🏠", "count": 234},
  "labor": {"title": "Arbeit & Beruf", "icon": "💼", "count": 456}
}
```

### Admin Endpoints

All admin endpoints require `X-Admin-Token` header.

#### `GET /api/admin/info`

Get system status.

**Response**:
```json
{
  "indexing": true,
  "total_files": 6234,
  "indexed_files": 5890,
  "laws": 6100,
  "log_level": "INFO"
}
```

#### `POST /api/admin/rebuild_index`

Force index rebuild.

**Response**: `202 Accepted` with `{"status": "reindexing_started"}`

#### `POST /api/admin/toggle_debug`

Toggle debug logging.

**Response**:
```json
{
  "debug": true,
  "level": "DEBUG"
}
```

---

## Database Schema

### Legal Dictionary (In-Memory)

**Source**: `dictionary/de_en_reversed.json`

**Structure**:
```json
{
  "Kündigung": ["termination", "dismissal", "notice"],
  "Mieter": ["tenant", "lessee"],
  "Vermieter": ["landlord", "lessor"]
}
```

### Search Index

**File**: `search_index.json`

**Structure**:
```json
{
  "index": {
    "<term>": {
      "<law_key>": <paragraph_count>
    }
  },
  "metadata": {
    "doc_lengths": {"<law_key>": <token_count>},
    "avgdl": <average_document_length>,
    "total_files": <count>,
    "built_at": "<ISO timestamp>"
  }
}
```

---

## Development Setup

### Environment

```bash
# Clone repository
git clone https://github.com/yourusername/german-law-vault.git
cd german-law-vault

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Install dev dependencies (optional)
pip install pytest pytest-flask black flake8
```

### Running in Development

```bash
# Enable debug mode
export FLASK_ENV=development  # Linux/macOS
set FLASK_ENV=development  # Windows

# Run with auto-reload
python app.py
```

### Code Style

- **Formatting**: Black (line length: 100)
- **Linting**: Flake8
- **Imports**: Sorted alphabetically
- **Docstrings**: Google style

```bash
# Format code
black .

# Lint
flake8 .

# Run tests
pytest tests/
```

---

## Testing

### Test Structure

```
tests/
├── run_all_tests.py          # Test runner
├── test_dict_lookup.py       # Dictionary tests
├── test_unified_translation.py # Translation tests
├── test_system_settings.py   # System config tests
└── README.md                 # Test documentation
```

### Running Tests

```bash
# Run all tests
cd tests
python run_all_tests.py

# Run specific test
python test_dict_lookup.py

# With pytest
pytest tests/ -v
```

### Writing Tests

```python
import unittest
from app import expand_query, tokenize

class TestSearch(unittest.TestCase):
    def test_expand_query_english(self):
        tokens, german = expand_query("tenant rights")
        self.assertIn("Mieter", german)
    
    def test_tokenize(self):
        tokens = tokenize("Der Mieter muss zahlen!")
        self.assertEqual(tokens, ["mieter", "zahlt"])

if __name__ == '__main__':
    unittest.main()
```

---

## Contributing Guidelines

### Pull Request Process

1. **Fork** the repository
2. **Create branch**: `git checkout -b feature/your-feature`
3. **Make changes** following code style guidelines
4. **Write tests** for new functionality
5. **Update documentation** if needed
6. **Commit** with clear messages
7. **Push** and create Pull Request

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Tests
- `chore`: Maintenance

**Example**:
```
feat(search): add fuzzy matching for German terms

- Implement Levenshtein distance matching
- Add configuration for similarity threshold
- Update search API documentation

Closes #123
```

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No security issues introduced
- [ ] Performance impact considered

---

## Troubleshooting

### Common Development Issues

#### Import Errors

```
ModuleNotFoundError: No module named 'flask'
```

**Solution**: Activate virtual environment and reinstall:
```bash
.venv\Scripts\activate
pip install -r requirements.txt
```

#### Multiprocessing Errors (Windows)

```
RuntimeError: An attempt has been made to start a new process...
```

**Solution**: Wrap multiprocessing code in `if __name__ == '__main__':`

#### Index Not Building

```
WARNING: No laws found in de_federal_json/
```

**Solution**: Run processing pipeline:
```bash
python download_de_laws.py
python process_de_laws.py
```

#### Ollama Connection Failed

```
WARNING: AI health check: Ollama unavailable
```

**Solution**:
```bash
# Check if Ollama is running
ollama list

# Start Ollama
ollama serve

# Pull model if needed
ollama pull qwen2.5:1.5b
```

### Debugging

**Enable debug logging**:
```python
# In app.py or via admin API
import logging
logging.getLogger().setLevel(logging.DEBUG)
```

**Check logs**:
```bash
# Follow log in real-time
tail -f Logs/server.log

# Search for errors
grep ERROR Logs/error.log
```

**Interactive debugging**:
```python
import pdb; pdb.set_trace()  # Breakpoint
```

---

## Performance Optimization

### Index Building

- **Current**: ~2-3 minutes for 6000+ laws
- **Bottleneck**: File I/O
- **Optimization**: Consider SQLite for metadata

### Search Performance

- **Current**: <100ms for most queries
- **Optimization**: 
  - Query result caching
  - Pre-computed synonym expansions
  - Async index updates

### Memory Usage

- **Current**: ~500MB with full index
- **Optimization**:
  - Lazy loading for law texts
  - Compressed index storage
  - Memory-mapped files

---

## Security Considerations

### Current Security Measures

- Local-only binding (`127.0.0.1`)
- Admin token authentication
- Rate limiting on API endpoints
- Input sanitization with DOMPurify
- No external API calls for core functionality

### Known Limitations

- **Not production-ready** for public deployment
- No user authentication system
- No HTTPS/TLS support
- Admin token generated at runtime (not persistent)

### Recommendations for Production

1. Add user authentication (OAuth2, JWT)
2. Implement HTTPS with valid certificates
3. Add request validation and throttling
4. Use environment variables for secrets
5. Implement audit logging
6. Add database abstraction layer
7. Regular security audits

---

## Additional Resources

- [API_REFERENCE.md](Documentation%20and%20AI%20Instructions/API_REFERENCE.md) - Detailed API docs
- [ARCHITECTURE.md](Documentation%20and%20AI%20Instructions/ARCHITECTURE.md) - Architecture deep dive
- [AI_GUIDE.md](Documentation%20and%20AI%20Instructions/AI_GUIDE.md) - AI integration guide

---

**For questions or contributions, please open an issue or pull request on GitHub.**
