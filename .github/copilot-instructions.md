# Copilot Instructions for de_laws_to_json

## Project Overview
**de_laws_to_json** automates fetching, processing, and searching all German federal laws (>6000 laws) from [gesetze-im-internet.de](https://www.gesetze-im-internet.de/). The project converts xmlxml files to normalized JSON structures suitable for vector databases and provides a Flask-based search dashboard.

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
  "key": "BGB",                    /* law abbreviation */
  "output": {
    "meta": {...},                 /* download_date, title, last_changed */
    "metadaten": {...},            /* jurabk, amtabk, ausfertigung-datum */
    "norms": [
      {
        "meta": { "norm_id": "§ 7", "title": "..." },
        "paragraphs": [
          { "meta": { "paragraph_id": "1", "token": 28 }, "content": "..." }
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
python process_de_laws.py       # ~30 min; creates de_federal_json/; emits search_index.json
python app.py                   # Starts Flask on http://localhost:5000
```

**Multiprocessing Notes**:
- `download_de_laws.py` uses `multiprocessing` to parallelize downloads; **breaks in Jupyter** — wrap in `if __name__ == '__main__':` or remove MP for notebooks.
- `process_de_laws.py` writes JSON directly within worker processes to avoid IPC memory issues on Windows; only returns file paths to main process.
- Both scripts log warnings to console; info/debug is suppressed to reduce noise.

### 2. Incremental Processing
- Filter by file stem in `process_de_laws.py`: set `FILE_FILTER = ('BJNR002190897', 'BJNR119530979',)` to process only specific laws (empty tuple = all).
- Output `search_index.json` must be rebuilt after adding/modifying JSON files (restart `app.py` to regenerate).

### 3. HTTP Resilience
- `download_de_laws.py` retries on 429/500-504 with exponential backoff; timeouts: TOC 15s, law ZIP 90s, max retries 3.
- XML index fetched from `https://www.gesetze-im-internet.de/gii-toc.xml` — parse with `ElementTree` to extract download URLs.
- Unique subdirs per law prevent ZIP filename collisions (e.g., `./de_federal_raw/bgb/...`).

## Key Implementation Patterns

### XML Parsing (BeautifulSoup + Tokenization)
- `process_de_laws.py::convert_xml_to_dict()` recursively flattens XML into nested dicts; sibling tags become lists.
- `tiktoken.encoding_for_model('gpt-3.5-turbo')` tokenizes German legal text (cl100k_base encoding).
- Norms are identified by `<N.P.m>` tags; paragraphs by `<T>` content within norms.
- **German naming convention**: file stems like `BJNR001950896` (issued 1989-06-18) → extracted into individual JSON files keyed by `jurabk` (BGB, StGB, etc.).

### Search Index & TF-IDF Ranking (`app.py`)
- On startup, `app.py` scans `de_federal_json/`, builds an inverted index mapping (token → law_key → paragraph count).
- Query flow: English → German translation (via `deep-translator`; disabled if removed) → synonym expansion → TF-IDF score per paragraph.
- Top 50 results ranked by score; frontend pagination shows 5 per page.
- Query cache (`_expansion_cache`) avoids redundant lookups; thread-safe via `_expansion_lock`.
- Category keywords hardcoded in `app.py` (~15 domains: "arbeitsrecht", "traffic", "consumer", etc.) for UI navigation.

### Directory Organization
- `de_federal_raw/{law_id}/`: extracted XMLs from downloaded ZIPs; mirrors official directory structure.
- `de_federal_json/`: individual JSON files, one per law, named `{jurabk}.json` (e.g., `BGB.json`, `StGB.json`).
  - Special names: `SGB_8.json`, `_AG.json` (names with non-alphanumeric chars replaced with underscores).
- `templates/`: Flask HTML/JS templates for dashboard UI.
- `search_index.json`: auto-generated inverted index; DO NOT edit manually (rebuilt on app restart).

## Development & Debugging Patterns

### Verification Scripts
- `verify_norms.py`: checks specific paragraph IDs in a law (e.g., `check_norm_id(bgb_path, [1626, 1627])` → prints found norms).
- `verify_gg.py`: validates law files against a reference schema (use to spot parse errors).
- `dedupe_processed_data.py`: removes duplicate entries from JSON output (run if processing added duplicates).

### Common Pitfalls
1. **Multiprocessing in Jupyter**: Remove or wrap in `if __name__ == '__main__':`.
2. **Windows IPC errors**: Fixed in `process_de_laws.py` by writing JSON in worker processes; main process only handles file path tracking.
3. **Search doesn't find laws**: Restart `app.py` to rebuild search index after modifying JSON files.
4. **Download timeouts**: Network instability → increase `DOWNLOAD_TIMEOUT` (default 90s) or `MAX_RETRIES` (default 3).

### Edit Conventions
- Timestamps use ISO 8601 (`2023-10-20`); metadata keys are German (e.g., `ausfertigung-datum`).
- Law abbreviations (keys) are uppercase; exact 2-4 letter codes from official `jurabk` field.
- Paragraph IDs are numeric strings (`"1"`, `"2"`) or formatted law symbols (`"§ 7"`); stored as normalized `norm_id`.
- All JSON must be UTF-8 encoded.

## Dependencies & Requirements
See [requirements.txt](requirements.txt):
- **Download**: `requests`, `tqdm`, `urllib3` (HTTP with retries & progress bars)
- **Processing**: `beautifulsoup4`, `lxml`, `tiktoken` (XML parsing + tokenization)
- **Dashboard**: `flask`, `deep-translator` (web server + translation; translation feature is disabled for now)

Python 3.13+ recommended.

## Frontend Notes (Flask Templates)
**Known Issues** (see [TODO.md](TODO.md)):
- `#history-section` HTML element partially missing → incomplete query history feature.
- Debounce for search input not wired up; `searchTimeout` unused.
- Some dead code in modal rebinding logic.

## Quick Start for New Agents
1. Understand the **three-stage pipeline**: download (network) → process (parse) → serve (search).
2. All laws flow through same schema; focus on the [example JSON structure](#core-data-structure).
3. Multiprocessing is used for parallelization — **never assume synchronous execution within a single process**.
4. Before modifying search or indexing logic, understand that `search_index.json` is ephemeral (rebuilt on app restart).
5. German legal abbreviations (BGB = Bürgerliches Gesetzbuch) are keys; use `verify_norms.py` to test specific paragraphs.
