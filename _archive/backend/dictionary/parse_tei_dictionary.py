"""
TEI Dictionary Parser

Parses the eng-deu.tei file (English→German dictionary) and extracts
word mappings for reversal to German→English.

TEI Format:
    <entry>
        <form>
            <orth>english_word</orth>
        </form>
        <gramGrp>
            <pos>part_of_speech</pos>
        </gramGrp>
        <sense>
            <cit type="trans" xml:lang="de">
                <quote>german_translation</quote>
            </cit>
        </sense>
    </entry>

Usage:
    python parse_tei_dictionary.py

Output:
    en_de_raw.json - Raw English→German mappings
    parse_stats.txt - Parsing statistics
"""

import xml.etree.ElementTree as ET
import json
import logging
import os
import re
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

# Configuration
TEI_FILE_PATH = "./templates/eng-deu.tei"
OUTPUT_FILE = "./dictionary/en_de_raw.json"
STATS_FILE = "./dictionary/parse_stats.txt"
CHUNK_SIZE = 10000  # Process in chunks for memory efficiency

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# TEI namespace
TEI_NS = "{http://www.tei-c.org/ns/1.0}"
XML_NS = "{http://www.w3.org/XML/1998/namespace}"


def normalize_word(word: str) -> str:
    """Normalize a word for dictionary lookup."""
    if not word:
        return ""
    # Lowercase, strip punctuation, remove special characters
    word = word.lower().strip()
    word = re.sub(r'^[^\w]+|[^\w]+$', '', word)
    return word


def extract_pos(element) -> Optional[str]:
    """Extract part of speech from gramGrp element."""
    pos_elem = element.find(f'.//{TEI_NS}pos')
    if pos_elem is not None and pos_elem.text:
        return pos_elem.text.strip()
    return None


def extract_translations(entry_elem) -> List[str]:
    """Extract German translations from an entry element."""
    translations = []
    
    # Find all translation citations (cit[@type="trans"])
    for cit in entry_elem.findall(f'.//{TEI_NS}cit'):
        cit_type = cit.get('type')
        if cit_type != 'trans':
            continue
        
        # Check for German language - check both with and without namespace
        lang = cit.get('lang')  # Without namespace
        xml_lang = cit.get(f'{XML_NS.replace("{", "").replace("}", "")}lang')  # With namespace
        
        # Also try getting all attributes and checking for lang
        if not lang or lang != 'de':
            # Try alternative approach - check if any attribute ends with 'lang' and value is 'de'
            is_german = False
            for attr, value in cit.attrib.items():
                if attr.endswith('lang') and value == 'de':
                    is_german = True
                    break
            
            if not is_german:
                # Fallback: if cit has quote children and no explicit non-de lang, assume German
                quotes = cit.findall(f'{TEI_NS}quote')
                if quotes and not lang:
                    is_german = True
            
            if not is_german:
                continue
        
        # Extract all quote elements
        for quote in cit.findall(f'{TEI_NS}quote'):
            if quote.text and quote.text.strip():
                translations.append(quote.text.strip())
    
    return list(set(translations))  # Remove duplicates


def parse_entry(entry_elem) -> Optional[Dict]:
    """Parse a single TEI entry element."""
    try:
        # Extract English headword
        orth_elem = entry_elem.find(f'.//{TEI_NS}orth')
        if orth_elem is None or not orth_elem.text:
            return None
        
        english_word = orth_elem.text.strip()
        if not english_word:
            return None
        
        # Skip very short words or symbols
        if len(english_word) < 2:
            return None
        
        # Extract part of speech
        pos = extract_pos(entry_elem)
        
        # Extract German translations
        german_translations = extract_translations(entry_elem)
        if not german_translations:
            return None
        
        return {
            'english': english_word,
            'english_normalized': normalize_word(english_word),
            'german': german_translations,
            'pos': pos
        }
    
    except Exception as e:
        logger.debug(f"Error parsing entry: {e}")
        return None


def parse_tei_file(tei_path: str) -> Tuple[Dict[str, List[Dict]], Dict]:
    """
    Parse the entire TEI dictionary file.
    
    Returns:
        Tuple of (en_de_mapping, statistics)
    """
    en_de_map = defaultdict(list)
    stats = {
        'total_entries': 0,
        'parsed_entries': 0,
        'skipped_entries': 0,
        'errors': 0,
        'unique_english_words': 0,
        'unique_german_words': set(),
    }
    
    logger.info(f"Parsing TEI file: {tei_path}")
    
    try:
        # Use iterative parsing for large files
        context = ET.iterparse(tei_path, events=('end',))
        
        for event, elem in context:
            if elem.tag == f'{TEI_NS}entry':
                stats['total_entries'] += 1
                
                entry_data = parse_entry(elem)
                
                if entry_data:
                    en_de_map[entry_data['english_normalized']].append(entry_data)
                    stats['parsed_entries'] += 1
                    
                    # Track unique German words
                    for de_word in entry_data['german']:
                        stats['unique_german_words'].add(normalize_word(de_word))
                else:
                    stats['skipped_entries'] += 1
                
                # Clear element to free memory
                elem.clear()
                
                # Progress logging
                if stats['total_entries'] % 10000 == 0:
                    logger.info(f"Processed {stats['total_entries']:,} entries...")
    
    except ET.ParseError as e:
        logger.error(f"XML Parse Error: {e}")
        stats['errors'] += 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        stats['errors'] += 1
    
    # Finalize statistics
    stats['unique_english_words'] = len(en_de_map)
    stats['unique_german_words'] = len(stats['unique_german_words'])
    
    return dict(en_de_map), stats


def save_results(en_de_map: Dict, stats: Dict):
    """Save parsed results to JSON and stats file."""
    # Save main dictionary
    logger.info(f"Saving dictionary to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(en_de_map, f, ensure_ascii=False, indent=2)
    
    # Save statistics
    logger.info(f"Saving statistics to {STATS_FILE}...")
    with open(STATS_FILE, 'w', encoding='utf-8') as f:
        f.write("TEI Dictionary Parse Statistics\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Source File: {TEI_FILE_PATH}\n")
        f.write(f"Total Entries: {stats['total_entries']:,}\n")
        f.write(f"Parsed Entries: {stats['parsed_entries']:,}\n")
        f.write(f"Skipped Entries: {stats['skipped_entries']:,}\n")
        f.write(f"Errors: {stats['errors']}\n")
        f.write(f"Unique English Words: {stats['unique_english_words']:,}\n")
        f.write(f"Unique German Words: {stats['unique_german_words']:,}\n")
        f.write(f"\nAverage translations per English word: ")
        f.write(f"{stats['parsed_entries'] / max(stats['unique_english_words'], 1):.2f}\n")


def main():
    """Main entry point."""
    # Check if TEI file exists
    if not os.path.exists(TEI_FILE_PATH):
        logger.error(f"TEI file not found: {TEI_FILE_PATH}")
        logger.error("Make sure eng-deu.tei exists in the templates/ directory")
        return
    
    # Parse TEI file
    en_de_map, stats = parse_tei_file(TEI_FILE_PATH)
    
    # Save results
    save_results(en_de_map, stats)
    
    # Print summary
    print("\n" + "=" * 50)
    print("TEI Dictionary Parse Complete!")
    print("=" * 50)
    print(f"Total entries processed: {stats['total_entries']:,}")
    print(f"Successfully parsed: {stats['parsed_entries']:,}")
    print(f"Unique English words: {stats['unique_english_words']:,}")
    print(f"Unique German words: {stats['unique_german_words']:,}")
    print(f"\nOutput files:")
    print(f"  - {OUTPUT_FILE}")
    print(f"  - {STATS_FILE}")
    print("=" * 50)


if __name__ == "__main__":
    main()
