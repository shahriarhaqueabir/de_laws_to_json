# German-English Legal Dictionary

**TEI-Based Dictionary Database for German Law Translation**

---

## Overview

This module provides a comprehensive German→English dictionary specifically optimized for legal text translation. It uses the FreeDict/WikDict English-German TEI dictionary as a source, reverses it to German→English, and stores it in a SQLite database for fast lookups.

### Features

- **100,000+ German headwords** extracted from Wiktionary via FreeDict
- **Legal priority terms** - 300+ curated legal terms with high-priority translations
- **Compound word decomposition** - Break down complex German compounds
- **LRU caching** - Fast repeated lookups
- **Multiple match strategies** - Exact, prefix, and fuzzy matching
- **Frequency scoring** - Rank translations by reliability

---

## Quick Start

### Step 1: Build the Dictionary Database

```bash
# Navigate to project root
cd "e:\Abir\LocalCodeRepo\German Law"

# Run the build pipeline
python dictionary/parse_tei_dictionary.py    # Parse TEI source
python dictionary/reverse_dictionary.py      # Reverse EN→DE to DE→EN
python dictionary/build_dictionary_db.py --rebuild  # Build SQLite database
```

### Step 2: Test the Dictionary

```bash
# Test lookup
python dictionary/legal_dict.py

# Test compound word decomposition
python dictionary/compound_words.py
```

### Step 3: Use in Your Code

```python
from dictionary.legal_dict import LegalDictionary

# Create dictionary instance
legal_dict = LegalDictionary()

# Get translations
translations = legal_dict.get_translations("Kündigung")
for t in translations:
    print(f"  {t['english']} (score: {t['frequency']}, source: {t['source']})")

# Translate a phrase
phrase = legal_dict.translate_phrase("Der Mieter kann kündigen")
print(phrase)
```

---

## Directory Structure

```
dictionary/
├── __init__.py                 # Package init (optional)
├── README.md                   # This file
│
├── parse_tei_dictionary.py     # TEI XML parser
├── reverse_dictionary.py       # EN→DE to DE→EN reversal
├── build_dictionary_db.py      # Database builder
├── legal_dict.py               # Dictionary lookup class
├── compound_words.py           # Compound word decomposer
│
├── schema.sql                  # SQLite schema
├── legal_priority_terms.csv    # Curated legal terms
│
├── en_de_raw.json              # [Generated] Parsed EN→DE mappings
├── de_en_reversed.json         # [Generated] Reversed DE→EN mappings
├── dictionary.db               # [Generated] SQLite database
├── common_components.json      # [Generated] Compound word components
│
└── parse_stats.txt             # [Generated] Parse statistics
└── reverse_stats.txt           # [Generated] Reverse statistics
```

---

## Build Pipeline

### 1. Parse TEI Dictionary

**File:** `parse_tei_dictionary.py`

Parses the `templates/eng-deu.tei` file and extracts English→German mappings.

```bash
python dictionary/parse_tei_dictionary.py
```

**Output:**
- `dictionary/en_de_raw.json` - Raw parsed data
- `dictionary/parse_stats.txt` - Statistics

**TEI Source:**
- Format: TEI XML (Text Encoding Initiative)
- Source: FreeDict/WikDict
- License: CC BY-SA 3.0
- Size: ~70,000 English headwords

---

### 2. Reverse Dictionary

**File:** `reverse_dictionary.py`

Reverses English→German to German→English with frequency scoring.

```bash
python dictionary/reverse_dictionary.py
```

**Output:**
- `dictionary/de_en_reversed.json` - Reversed mappings
- `dictionary/reverse_stats.txt` - Statistics

**Frequency Scoring:**
- Base weight: 1.0
- Noun boost: ×1.5
- Verb boost: ×1.3
- Legal keyword boost: ×1.5
- Single-word translation boost: ×1.2

---

### 3. Build Database

**File:** `build_dictionary_db.py`

Creates SQLite database with indexes and imports legal priority terms.

```bash
# Full rebuild
python dictionary/build_dictionary_db.py --rebuild

# With custom legal terms CSV
python dictionary/build_dictionary_db.py --legal-terms custom_legal_terms.csv
```

**Output:**
- `dictionary/dictionary.db` - SQLite database (~30-50 MB)

**Database Tables:**
- `de_en_dictionary` - Main dictionary entries
- `legal_priority_terms` - Curated legal terms
- `compound_words` - Compound word components
- `translation_cache` - AI translation cache
- `query_stats` - Query statistics

---

## API Reference

### LegalDictionary Class

```python
from dictionary.legal_dict import LegalDictionary

legal_dict = LegalDictionary(db_path="./dictionary/dictionary.db")
```

#### get_translations(german_word, limit=5)

Get English translations for a German word.

```python
translations = legal_dict.get_translations("Kündigung")

# Returns:
[
    {
        'english': 'termination',
        'frequency': 90,
        'pos': 'noun',
        'source': 'legal_priority'
    },
    {
        'english': 'notice',
        'frequency': 75,
        'pos': 'noun',
        'source': 'dictionary'
    }
]
```

**Source Types:**
- `legal_priority` - Curated legal term (highest priority)
- `dictionary` - Main dictionary entry
- `prefix` - Prefix match (inflected forms)
- `compound` - Compound word decomposition
- `fallback_en_de` - Fallback to old EN_DE dict

---

#### translate_phrase(german_text)

Word-by-word translation of a short phrase.

```python
phrase = legal_dict.translate_phrase("Der Mieter kündigt den Vertrag")
# Output: "The tenant terminates the contract"
```

**Note:** For proper translation, use the AI translation endpoint. This is a simple word-by-word lookup.

---

#### normalize_word(word)

Normalize German word for lookup.

```python
normalized = legal_dict.normalize_word("Die Kündigung")
# Output: "kündigung"
```

---

#### clear_cache()

Clear the LRU cache.

```python
legal_dict.clear_cache()
```

---

#### get_stats()

Get dictionary statistics.

```python
stats = legal_dict.get_stats()
# Returns:
{
    'total_entries': 150000,
    'unique_words': 100000,
    'legal_terms': 300,
    'cache_size': 5000
}
```

---

### CompoundDecomposer Class

```python
from dictionary.compound_words import CompoundDecomposer

decomposer = CompoundDecomposer()
```

#### decompose(word)

Decompose a German compound word.

```python
components = decomposer.decompose("Kündigungsschutzfrist")
# Returns: ['kündigung', 'schutz', 'frist']
```

---

#### translate_compound(word, legal_dict)

Decompose and translate a compound word.

```python
result = decomposer.translate_compound(
    "Kündigungsschutzfrist",
    legal_dict=legal_dict
)

# Returns:
{
    'original': 'Kündigungsschutzfrist',
    'components': ['kündigung', 'schutz', 'frist'],
    'component_count': 3,
    'translations': [
        {'german': 'kündigung', 'english': 'termination'},
        {'german': 'schutz', 'english': 'protection'},
        {'german': 'frist', 'english': 'period'}
    ],
    'combined_translation': 'termination protection period'
}
```

---

#### is_likely_compound(word)

Check if a word is likely a compound.

```python
is_compound = decomposer.is_likely_compound("Bundesfernstraßenmautgesetz")
# Returns: True
```

---

## Integration with app.py

### Option 1: Replace EN_DE Dictionary

Modify `app.py` to use the new dictionary:

```python
# In app.py, replace the EN_DE dictionary usage

from dictionary.legal_dict import get_legal_dictionary

legal_dict = get_legal_dictionary()

def expand_query(raw: str) -> Tuple[List[str], List[str]]:
    # ... existing tokenization ...
    
    for tok in tokens:
        # Use database instead of static dict
        translated = legal_dict.get_translations(tok)
        if translated:
            german.extend([t['english'].lower() for t in translated])
        else:
            # Fallback to existing DE_EXPANSIONS
            expanded = DE_EXPANSIONS.get(tok)
            if expanded:
                german.extend(expanded)
    
    # ... rest of function
```

---

### Option 2: Enhance AI Translation

Use dictionary as first-pass, refine with Ollama:

```python
# In app.py, enhance /api/ai_translate

from dictionary.legal_dict import get_legal_dictionary

legal_dict = get_legal_dictionary()

@app.route("/api/ai_translate", methods=["POST"])
def api_ai_translate_enhanced():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "").strip()
    
    # For single words, use dictionary
    if len(text.split()) == 1:
        translations = legal_dict.get_translations(text)
        if translations:
            return jsonify({"translation": translations[0]['english']})
    
    # For phrases, use AI
    # ... existing Ollama logic
```

---

## Legal Priority Terms

The `legal_priority_terms.csv` file contains 300+ curated legal terms with:

| Column | Description |
|--------|-------------|
| `german_term` | German legal term |
| `english_translation` | Primary English translation |
| `alternative_translations` | JSON array of alternatives |
| `priority_level` | 1 (highest) to 5 (lowest) |
| `context_category` | housing, labor, criminal, etc. |
| `notes` | Additional context |

### Categories

- `general` - General legal terms
- `housing` - Housing/rental law
- `labor` - Employment law
- `criminal` - Criminal law
- `finance` - Tax/finance law
- `family` - Family law
- `social` - Social security law
- `public` - Public/administrative law
- `tech` - IP/tech law
- `traffic` - Traffic law

### Adding Custom Terms

Edit `legal_priority_terms.csv`:

```csv
german_term,english_translation,alternative_translations,priority_level,context_category,notes
NeuesGesetz,New Act,"[""New Law"",""New Statute""]",2,general,My custom term
```

Then rebuild:
```bash
python dictionary/build_dictionary_db.py --rebuild
```

---

## Performance

### Lookup Speed

| Operation | Time |
|-----------|------|
| Cache hit | <1 ms |
| Exact match | 5-10 ms |
| Prefix match | 10-20 ms |
| Compound decomposition | 20-50 ms |

### Database Size

| Component | Size |
|-----------|------|
| dictionary.db | ~30-50 MB |
| en_de_raw.json | ~20-30 MB |
| de_en_reversed.json | ~40-60 MB |

### Memory Usage

- LRU cache: ~5,000 entries (configurable via `DICT_CACHE_SIZE`)
- Database connection: ~1 MB per connection
- Compound components: ~5-10 MB

---

## Troubleshooting

### "Dictionary database not found"

```bash
# Build the database
python dictionary/build_dictionary_db.py --rebuild
```

### "TEI file not found"

Ensure `templates/eng-deu.tei` exists:

```bash
# Check file
ls templates/eng-deu.tei

# If missing, download from FreeDict:
# https://github.com/freedict/freedict-dictionaries
```

### Slow lookups

```bash
# Increase cache size
export DICT_CACHE_SIZE=10000

# Rebuild database with WAL mode
python dictionary/build_dictionary_db.py --rebuild
```

### Compound decomposition not working

```bash
# Test decomposer
python dictionary/compound_words.py

# Check components file
cat dictionary/common_components.json
```

---

## License

- **TEI Dictionary (eng-deu.tei):** CC BY-SA 3.0
- **Dictionary Code:** Apache 2.0 (same as main project)
- **Legal Priority Terms:** Apache 2.0

---

## Future Improvements

- [ ] Full compound word decomposition with component dictionary
- [ ] Context-aware translation (category-specific)
- [ ] Neural translation model integration
- [ ] User-contributed translation suggestions
- [ ] Multi-word expression detection
- [ ] Grammatical information (gender, case, plural)

---

## References

- **FreeDict:** https://github.com/freedict/freedict-dictionaries
- **TEI Standard:** https://tei-c.org/
- **Wiktionary:** https://www.wiktionary.org/
- **DBnary:** http://kaiko.getalp.org/about-dbnary/

---

**Last Updated:** February 23, 2026  
**Version:** 1.0
