# German Law Vault — Project Guide

## Stack
- **Python 3.13+** — Flask web app (app.py)
- **SQLite** — Local database in database/
- **TF-IDF** — Vector search (vector_search.py)
- **Ollama** — Optional local AI for translation and analysis
- **No external API dependencies** — Fully offline capable

## Key Files
| File | Purpose |
|------|---------|
| `app.py` | Flask web server & main entry point |
| `process_de_laws.py` | Import/process German law JSON→database |
| `download_de_laws.py` | Download law data from official sources |
| `unified_translator.py` | German↔English translation with local AI |
| `vector_search.py` | TF-IDF search index |
| `ai_guardrails.py` | AI safety filters |
| `cross_reference_parser.py` | Parse legal cross-references |
| `database/` | SQLite DB files |
| `templates/` + `static/` | Web UI (Jinja2 + CSS/JS) |

## Running
- `python app.py` — starts Flask on http://localhost:5000
- `.\run_dashboard.bat` — Windows launcher with Ollama auto-start
- `python download_de_laws.py` — fetch laws (run once)
- `python process_de_laws.py` — process into searchable DB

## Conventions
- Python: snake_case, type hints preferred, `fro`-string formatting
- Imports: stdlib → third-party → local, grouped with blank lines
- Tests live in `tests/` — run with `cd tests && python run_all_tests.py`
- Translations stored in `dictionary/` as JSON
- AI responses must pass through `ai_guardrails.py` before rendering

## Git
- Active branch: `clientsidelocalai` (local/offline AI focus)
- Remote: `origin` (GitHub)
