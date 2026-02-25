# German Law Vault ⚖️

**All 6,000+ German Federal Laws — Searchable in English and German**

German Law Vault is a comprehensive search engine for German federal laws. It enables natural language search in both English and German, making German legal texts accessible to everyone. Describe your legal situation in plain language, and the system finds relevant laws and paragraphs.

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.13+-blue.svg)
![Laws](https://img.shields.io/badge/laws-6000+-green.svg)

## Screenshots

<p align="center">
  <img src="assets/screenshot 1.png" width="700"/>
</p>
<p align="center">
  <img src="assets/screenshot 2.png" width="700"/>
</p>
<p align="center">
  <img src="assets/screenshot 3.png" width="700"/>
</p>
<p align="center">
  <img src="assets/screenshot 4.png" width="700"/>
</p>
<p align="center">
  <img src="assets/screenshot 5.png" width="700"/>
</p>

## ✨ Features

- **Natural Language Search**: Search using everyday language in English or German
- **6,000+ Federal Laws**: Complete collection of German federal legislation
- **Smart Translation**: English queries automatically translated to German legal terms
- **Legal Dictionary**: Integrated German-English legal terminology dictionary
- **AI Assistant**: Optional AI-powered analysis and explanation of laws
- **Categorized Browse**: Laws organized by topic (Housing, Employment, Family, Criminal, etc.)
- **Offline First**: All data stored locally, no external API required for search
- **Fast & Responsive**: TF-IDF based ranking with instant results

## 🚀 Quick Start

### Prerequisites

- **Python 3.13** or higher
- **pip** (Python package manager)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/german-law-vault.git
   cd german-law-vault
   ```

2. **Create and activate virtual environment**
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate

   # Linux/macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Download German laws** (takes ~1-2 hours)
   ```bash
   python download_de_laws.py
   ```

5. **Process laws into searchable format** (takes ~30 minutes)
   ```bash
   python process_de_laws.py
   ```

6. **Start the dashboard**
   ```bash
   python app.py
   ```

7. **Open your browser**
   ```
   http://localhost:5000
   ```

## 📖 Usage

### Basic Search

1. Enter your legal question in English or German
2. Click "✨ Ask AI" or press Enter
3. Review relevant laws and paragraphs
4. Click on any result to read the full text

### Example Queries

| English | German |
|---------|--------|
| "My landlord refuses to return my deposit" | "Mein Vermieter zahlt die Kaution nicht zurück" |
| "I was fired without notice" | "Ich wurde ohne Kündigung fristlos entlassen" |
| "Neighbor plays loud music at night" | "Nachbar spielt nachts laute Musik" |
| "Car accident without insurance" | "Verkehrsunfall ohne Versicherung" |

### Citation Shortcuts

Quick access to major law codes:
- **BGB** - Civil Code (Bürgerliches Gesetzbuch)
- **StGB** - Criminal Code (Strafgesetzbuch)
- **GG** - Basic Law/Constitution (Grundgesetz)
- **StPO** - Code of Criminal Procedure
- **ZPO** - Code of Civil Procedure

### Categories

Browse laws by topic:
- 🏠 **Wohnen & Miete** - Housing & Rent
- 💼 **Arbeit & Beruf** - Employment & Work
- 🛍️ **Einkaufen & Verträge** - Consumer & Contracts
- 🚗 **Verkehr & Transport** - Traffic & Transport
- 👨‍👩‍👧‍👦 **Familie & Leben** - Family & Life
- ⚖️ **Strafrecht** - Criminal Law
- 💶 **Steuern & Finanzen** - Taxes & Finance
- 🏥 **Gesundheit & Soziales** - Health & Social
- 🏛️ **Staat & Rechte** - State & Rights
- 🌱 **Innovation & Umwelt** - Innovation & Environment
- 🐻 **Berlin** - Berlin State Law

## 🏗️ Architecture

```
┌─────────────────────┐
│   TOC Index (XML)   │
│  gesetze-im-internet│
└──────────┬──────────┘
           │ download_de_laws.py
           ▼
┌─────────────────────┐
│   de_federal_raw/   │  Raw XML files
└──────────┬──────────┘
           │ process_de_laws.py
           ▼
┌─────────────────────┐
│  de_federal_json/   │  Structured JSON
└──────────┬──────────┘
           │ app.py (startup)
           ▼
┌─────────────────────┐
│   search_index.json │  Inverted index
└──────────┬──────────┘
           │ Flask Dashboard
           ▼
┌─────────────────────┐
│  localhost:5000     │  Web UI
└─────────────────────┘
```

## 📁 Project Structure

```
german-law-vault/
├── app.py                      # Flask web application
├── download_de_laws.py         # Law download script
├── process_de_laws.py          # XML to JSON processor
├── unified_translator.py       # AI translation module
├── logging_config.py           # Logging configuration
├── server_watchdog.py          # Auto-restart monitor
├── requirements.txt            # Python dependencies
├── README.md                   # This file
├── USER_GUIDE.md               # User documentation
├── DOCUMENTATION.md            # Developer documentation
├── LICENSE                     # Apache 2.0 License
├── .gitignore                  # Git ignore rules
├── dictionary/                 # Legal dictionary module
│   ├── memory_dict.py          # In-memory dictionary
│   ├── legal_dict.py           # Dictionary database
│   └── de_en_reversed.json     # Reverse lookup data
├── static/                     # Frontend assets
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── app.js
│       ├── search.js
│       ├── translation.js
│       └── ...
├── templates/                  # HTML templates
│   └── index.html
├── tests/                      # Test suite
│   └── ...
└── Documentation and AI Instructions/
    └── ...                     # Development docs
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama AI API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model for AI features |
| `OLLAMA_TIMEOUT` | `120` | AI request timeout (seconds) |
| `EXPANSION_CACHE_SIZE` | `1000` | Query cache size |

### Optional: AI Features

For AI-powered analysis and translation:

1. **Install Ollama**: https://ollama.ai
2. **Pull a model**: `ollama pull llama3.2`
3. **Start Ollama**: `ollama serve`

The application will automatically detect Ollama and enable AI features.

## 🧪 Testing

Run the test suite:

```bash
cd tests
python run_all_tests.py
```

## 📊 Data Sources

- **Primary**: [gesetze-im-internet.de](https://www.gesetze-im-internet.de/)
  - Official source of German federal laws
  - Updated regularly by the German Ministry of Justice
  - XML format via `gii-toc.xml` index

- **Dictionary**: FreeDict project (eng-deu.tei)
  - German-English legal terminology
  - Open source dictionary data

## 🔒 Security

- **No external API calls** for core search functionality
- **Local data storage** - all law data stored on your machine
- **Rate limiting** on admin endpoints
- **CORS protection** for API endpoints
- **No user authentication** - runs locally on localhost only

⚠️ **Important**: This application is designed for **local use only**. Do not expose it to the public internet without additional security measures.

## 📝 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Issues & Support

- **Bug Reports**: Open an issue on GitHub
- **Questions**: Check the [USER_GUIDE.md](USER_GUIDE.md) and [DOCUMENTATION.md](DOCUMENTATION.md)
- **Legal Disclaimer**: This tool is for informational purposes only and does not constitute legal advice.

## 📚 Documentation

- [User Guide](USER_GUIDE.md) - Detailed usage instructions
- [Developer Documentation](DOCUMENTATION.md) - Architecture and development guide
- [API Reference](Documentation%20and%20AI%20Instructions/API_REFERENCE.md) - API endpoint documentation

## 🙏 Acknowledgments

- German Federal Ministry of Justice for providing open access to laws
- FreeDict project for dictionary data
- Flask community for the web framework

---

**Built with ❤️ for accessible legal information**
