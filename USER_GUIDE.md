# German Law Vault - User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [The Dashboard Interface](#the-dashboard-interface)
3. [Searching for Laws](#searching-for-laws)
4. [Understanding Search Results](#understanding-search-results)
5. [Using AI Features](#using-ai-features)
6. [Tips for Better Results](#tips-for-better-results)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Getting Started

### First-Time Setup

After installing the application (see [README.md](README.md)), the dashboard will be available at:

```
http://localhost:5000
```

The application runs entirely on your local machine. No internet connection is required after the initial law download.

### What You'll See

When you first open the dashboard:

1. **Indexing Progress**: The system will automatically build a search index from the downloaded laws. This takes 1-3 minutes on first launch.
2. **Status Indicator**: Top-right corner shows "Indexing..." then changes to "Ready" when complete.
3. **Search Interface**: Once ready, you can start searching immediately.

---

## The Dashboard Interface

### Main Components

```
┌─────────────────────────────────────────────────────────────┐
│  ⚖️ German Law Vault     [Settings]  [Status: Ready]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              All 6,000+ Federal Laws                        │
│         Understand German Law in a simple way               │
│                                                             │
│    ┌─────────────────────────────────────────────────┐     │
│    │ Explain your situation... (e.g., My boss...)    │🔍│     │
│    └─────────────────────────────────────────────────┘     │
│                                                             │
│    💡 Examples: landlord deposit | fired without notice    │
│                                                             │
│    Citation Shortcuts: BGB | StGB | GG | StPO | ZPO        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Categories: 🏠 Housing | 💼 Work | 🛍️ Consumer | ...      │
└─────────────────────────────────────────────────────────────┘
```

### Header Controls

| Button | Function |
|--------|----------|
| 🏠 Logo | Return to home screen |
| ⚙️ Settings | Open settings panel (admin features) |
| Status Pill | Shows indexing status and law count |

---

## Searching for Laws

### Basic Search

1. **Type your query** in the search box
2. **Press Enter** or click **✨ Ask AI**
3. **Review results** - laws are ranked by relevance

### Search in English or German

The system understands both languages:

**English Examples:**
- "My landlord won't return my security deposit"
- "I was fired without notice period"
- "What are my rights as a tenant?"

**German Examples:**
- "Mein Vermieter zahlt die Kaution nicht zurück"
- "Ich wurde fristlos gekündigt"
- "Welche Rechte habe ich als Mieter?"

### Using Citation Shortcuts

Click on any shortcut to browse that law code:

| Shortcut | Full Name | Description |
|----------|-----------|-------------|
| **BGB** | Bürgerliches Gesetzbuch | Civil Code |
| **StGB** | Strafgesetzbuch | Criminal Code |
| **GG** | Grundgesetz | Basic Law (Constitution) |
| **StPO** | Strafprozessordnung | Criminal Procedure |
| **ZPO** | Zivilprozessordnung | Civil Procedure |

### Browsing by Category

Click on category chips to browse laws by topic:

| Category | Topics Covered |
|----------|----------------|
| 🏠 Wohnen & Miete | Rent, deposits, eviction, neighbors |
| 💼 Arbeit & Beruf | Employment, termination, wages |
| 🛍️ Einkaufen & Verträge | Consumer rights, warranties, contracts |
| 🚗 Verkehr & Transport | Traffic laws, accidents, licenses |
| 👨‍👩‍👧‍👦 Familie & Leben | Divorce, custody, inheritance |
| ⚖️ Strafrecht | Criminal offenses, penalties |
| 💶 Steuern & Finanzen | Taxes, banking, insurance |
| 🏥 Gesundheit & Soziales | Healthcare, social security |
| 🏛️ Staat & Rechte | Constitutional rights, immigration |
| 🌱 Innovation & Umwelt | Environment, digital, IP |
| 🐻 Berlin | Berlin state-specific laws |

---

## Understanding Search Results

### Results Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Search Results for "fired without notice" (24 results)     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 📄 BGB - Civil Code                          Score: 95%    │
│    § 622 Notice periods for termination of employment      │
│    "The notice period for termination of employment..."    │
│    [View Full Law] [Bookmark]                              │
│                                                             │
│ 📄 BGB - Civil Code                          Score: 87%    │
│    § 626 Termination without notice for cause              │
│    "An employment relationship may be terminated..."       │
│    [View Full Law] [Bookmark]                              │
│                                                             │
│ Pagination: [1] [2] [3] [Next]                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Result Components

| Element | Description |
|---------|-------------|
| **Law Title** | Official name of the law (e.g., "BGB - Civil Code") |
| **Paragraph** | Specific section (e.g., "§ 622") |
| **Preview** | First 280 characters of the paragraph |
| **Score** | Relevance percentage (higher = more relevant) |
| **View Full Law** | Opens complete law text in modal |
| **Bookmark** | Save for later reference |

### Reading a Full Law

Click **View Full Law** to see:

1. **Law Header**: Official title and citation
2. **Search Within**: Find specific terms in this law
3. **AI Insights** (if enabled):
   - Plain-language summary
   - Risk/caution notes
   - Common scenarios
   - What the law does NOT cover
4. **Full Text**: All paragraphs with navigation

---

## Using AI Features

### AI Assistant

The AI Assistant can:
- Explain complex legal terms in simple language
- Translate German text to English
- Provide context and examples
- Answer questions about specific laws

### Enabling/Disabling AI

1. Click the **Settings** button (⚙️)
2. Find "AI Assistant Module"
3. Toggle the switch to enable/disable

**Why disable AI?**
- Save system resources
- Troubleshoot generation issues
- Faster response times

### Asking AI Questions

In the law viewer:

1. Click **✨ Ask AI** button
2. Type your question (e.g., "What does this mean for tenants?")
3. Wait for the AI response
4. Response appears in the chat panel

### AI Translation

When viewing a German law:

1. Look for **DE | EN** buttons in the modal
2. Click **EN** for English translation
3. Click **DE** for original German

> ⚠️ **Note**: Translations are for reference only. Always verify with the official German text for legal purposes.

---

## Tips for Better Results

### Writing Effective Queries

**DO:**
- ✅ Be specific: "security deposit return timeline"
- ✅ Use legal terms: "termination notice period"
- ✅ Include context: "tenant rights when landlord sells"
- ✅ Try both languages if one doesn't work well

**DON'T:**
- ❌ Too vague: "help me"
- ❌ Too long: (keep queries under 50 words)
- ❌ Multiple unrelated topics in one query

### Using Synonyms

The system automatically expands queries with synonyms:

| Your Query | Also Searches |
|------------|---------------|
| "landlord" | Vermieter, Vermieterin |
| "fired" | Kündigung, entlassen |
| "deposit" | Kaution, Sicherheitsleistung |
| "accident" | Unfall, Verkehrsunfall |

### Narrowing Results

If you get too many results:

1. **Add more specific terms**: "deposit return **timeline**"
2. **Use law abbreviations**: "BGB § 543"
3. **Filter by category**: Click a category chip first

### Finding Specific Paragraphs

Use citation format:
- `BGB § 543` - Specific paragraph
- `StGB § 263` - Criminal code section
- `GG Art. 1` - Basic Law article

---

## Troubleshooting

### Common Issues

#### "Indexing..." Never Completes

**Cause**: Large dataset or slow disk

**Solution**:
1. Wait up to 5 minutes on first launch
2. Check `Logs/indexing.log` for errors
3. Restart the application

#### No Results Found

**Possible causes**:
- Query too specific or vague
- Translation issue (try German)
- Index not built

**Solutions**:
1. Simplify your query
2. Try alternative keywords
3. Click "Index neu aufbauen" in settings

#### AI Features Not Working

**Check**:
1. Is Ollama installed and running?
2. Is the correct model downloaded?
3. Is AI enabled in settings?

**Commands**:
```bash
# Check Ollama status
ollama list

# Download model if needed
ollama pull llama3.2

# Start Ollama
ollama serve
```

#### Application Won't Start

**Check**:
1. Python version: `python --version` (need 3.13+)
2. Dependencies installed: `pip install -r requirements.txt`
3. Port 5000 not in use

**Solution**:
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall

# Run with debug logging
python app.py
```

### Log Files

Check logs for detailed error messages:

| Log File | Purpose |
|----------|---------|
| `Logs/server.log` | General server activity |
| `Logs/error.log` | Errors and exceptions |
| `Logs/indexing.log` | Index building progress |
| `Logs/ai.log` | AI/Ollama interactions |
| `Logs/watchdog.log` | Auto-restart monitor |

**View logs**:
```bash
# PowerShell (Windows)
Get-Content Logs\error.log -Tail 50

# Linux/macOS
tail -f Logs/error.log
```

---

## FAQ

### General Questions

**Q: Is this legal advice?**  
A: **No.** This tool provides access to legal texts for informational purposes only. Consult a qualified attorney for legal advice.

**Q: How current is the data?**  
A: Laws are downloaded from the official source. To update, re-run `download_de_laws.py` and `process_de_laws.py`.

**Q: Can I use this offline?**  
A: Yes! After initial download and processing, all search functions work offline. AI features require Ollama running locally.

**Q: Is my search data stored?**  
A: No. All searches are processed locally and not stored or transmitted.

### Technical Questions

**Q: How much disk space is needed?**  
A: Approximately 2-3 GB for all law data and indexes.

**Q: Can I search in other languages?**  
A: Currently English and German are supported. The system translates English queries to German for searching.

**Q: Why are some laws missing?**  
A: Some laws may not parse correctly due to unusual XML formatting. Check `Logs/indexing.log` for errors.

**Q: Can I contribute translations?**  
A: Yes! See the [Documentation](DOCUMENTATION.md) for contributing guidelines.

### Privacy & Security

**Q: Is my data sent to external servers?**  
A: No. All data stays on your machine. AI features use local Ollama installation.

**Q: Can others access my dashboard?**  
A: The server runs on `localhost:5000` only. It's not accessible from other devices unless you explicitly configure it.

**Q: Should I expose this to the internet?**  
A: **No.** This application is designed for local use only. Additional security measures would be required for public deployment.

---

## Getting Help

- **Documentation**: See [DOCUMENTATION.md](DOCUMENTATION.md) for developer guides
- **Issues**: Report bugs on GitHub
- **Updates**: Check the README for latest features

---

**Happy Searching! ⚖️**
