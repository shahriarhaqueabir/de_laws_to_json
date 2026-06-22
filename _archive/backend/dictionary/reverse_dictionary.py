"""
Reverse Dictionary Builder

Reverses the English→German dictionary to German→English with
frequency scoring and aggregation.

Input: en_de_raw.json (from parse_tei_dictionary.py)
Output: de_en_reversed.json (German→English mappings with frequencies)

Usage:
    python reverse_dictionary.py
"""

import json
import logging
import re
from collections import defaultdict
from typing import Dict, List, Tuple

# Configuration
INPUT_FILE = "./dictionary/en_de_raw.json"
OUTPUT_FILE = "./dictionary/de_en_reversed.json"
STATS_FILE = "./dictionary/reverse_stats.txt"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


def normalize_german_word(word: str) -> str:
    """Normalize German word for dictionary lookup."""
    if not word:
        return ""
    
    # Lowercase
    word = word.lower().strip()
    
    # Remove common German article prefixes that might be attached
    # e.g., "derMüller" → "müller"
    word = re.sub(r'^(der|die|das|den|dem|des|ein|eine)\s*', '', word)
    
    # Strip punctuation
    word = re.sub(r'^[^\w]+|[^\w]+$', '', word)
    
    # Remove umlaut variations for normalization (keep original for display)
    # ä→ae, ö→oe, ü→ue, ß→ss
    normalized = word.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    
    return word


def calculate_frequency_weight(pos: str, english_word: str) -> float:
    """
    Calculate frequency weight based on part of speech and word characteristics.
    
    Higher weights = more reliable/important translations
    """
    weight = 1.0
    
    # Boost common parts of speech
    pos_boosts = {
        'noun': 1.5,
        'verb': 1.3,
        'adjective': 1.2,
        'adverb': 1.0,
    }
    
    if pos:
        pos_lower = pos.lower()
        for pos_key, boost in pos_boosts.items():
            if pos_key in pos_lower:
                weight *= boost
                break
    
    # Boost single-word translations (more likely to be direct equivalents)
    if len(english_word.split()) == 1:
        weight *= 1.2
    
    # Boost common legal terms
    legal_keywords = ['recht', 'gesetz', 'vertrag', 'klage', 'gericht', 'straf', 'zivil']
    if any(kw in english_word.lower() for kw in legal_keywords):
        weight *= 1.5
    
    return weight


def reverse_dictionary(en_de_map: Dict) -> Tuple[Dict, Dict]:
    """
    Reverse English→German to German→English with frequency scoring.
    
    Args:
        en_de_map: {english_normalized: [{english, german, pos}, ...]}
    
    Returns:
        Tuple of (de_en_map, statistics)
    """
    de_en_map = defaultdict(list)
    stats = {
        'input_entries': 0,
        'output_entries': 0,
        'total_mappings': 0,
        'compound_words_detected': 0,
        'multi_word_german': 0,
    }
    
    logger.info("Reversing dictionary (EN→DE to DE→EN)...")
    
    for en_normalized, entries in en_de_map.items():
        stats['input_entries'] += 1
        
        for entry in entries:
            english_word = entry['english']
            pos = entry.get('pos')
            
            for german_word in entry['german']:
                stats['total_mappings'] += 1
                
                # Check for multi-word German
                if ' ' in german_word:
                    stats['multi_word_german'] += 1
                
                # Check for compound words (long German words)
                if len(german_word) > 15:
                    stats['compound_words_detected'] += 1
                
                # Normalize German word
                german_normalized = normalize_german_word(german_word)
                if not german_normalized:
                    continue
                
                # Calculate frequency weight
                weight = calculate_frequency_weight(pos, english_word)
                
                # Add to reversed mapping
                de_en_map[german_normalized].append({
                    'german': german_word,
                    'german_normalized': german_normalized,
                    'english': english_word,
                    'english_normalized': en_normalized,
                    'pos': pos,
                    'frequency': weight,
                    'source': 'tei_dict'
                })
    
    # Aggregate and sort by frequency
    logger.info("Aggregating and sorting translations...")
    final_de_en = {}
    
    for german_normalized, entries in de_en_map.items():
        # Group by English word and sum frequencies
        en_aggregated = defaultdict(lambda: {
            'frequency': 0,
            'german_forms': set(),
            'pos_tags': set()
        })
        
        for entry in entries:
            en_word = entry['english_normalized']
            en_aggregated[en_word]['frequency'] += entry['frequency']
            en_aggregated[en_word]['german_forms'].add(entry['german'])
            if entry['pos']:
                en_aggregated[en_word]['pos_tags'].add(entry['pos'])
        
        # Convert to sorted list
        aggregated_list = []
        for en_word, data in en_aggregated.items():
            aggregated_list.append({
                'english': list(data['german_forms'])[0],  # Use first German form
                'english_normalized': en_word,
                'frequency': round(data['frequency'], 2),
                'german_variants': list(data['german_forms']),
                'pos_tags': list(data['pos_tags'])
            })
        
        # Sort by frequency (descending)
        aggregated_list.sort(key=lambda x: x['frequency'], reverse=True)
        
        final_de_en[german_normalized] = aggregated_list
        stats['output_entries'] += 1
    
    return final_de_en, stats


def save_results(de_en_map: Dict, stats: Dict):
    """Save reversed dictionary and statistics."""
    # Save main dictionary
    logger.info(f"Saving reversed dictionary to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(de_en_map, f, ensure_ascii=False, indent=2)
    
    # Save statistics
    logger.info(f"Saving statistics to {STATS_FILE}...")
    with open(STATS_FILE, 'w', encoding='utf-8') as f:
        f.write("Reverse Dictionary Statistics\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Input English Words: {stats['input_entries']:,}\n")
        f.write(f"Output German Words: {stats['output_entries']:,}\n")
        f.write(f"Total Mappings: {stats['total_mappings']:,}\n")
        f.write(f"Compound Words Detected: {stats['compound_words_detected']:,}\n")
        f.write(f"Multi-word German: {stats['multi_word_german']:,}\n")
        f.write(f"\nAverage English translations per German word: ")
        f.write(f"{stats['total_mappings'] / max(stats['output_entries'], 1):.2f}\n")


def main():
    """Main entry point."""
    # Check if input file exists
    import os
    if not os.path.exists(INPUT_FILE):
        logger.error(f"Input file not found: {INPUT_FILE}")
        logger.error("Run parse_tei_dictionary.py first to generate the input file")
        return
    
    # Load parsed dictionary
    logger.info(f"Loading parsed dictionary from {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        en_de_map = json.load(f)
    
    # Reverse dictionary
    de_en_map, stats = reverse_dictionary(en_de_map)
    
    # Save results
    save_results(de_en_map, stats)
    
    # Print summary
    print("\n" + "=" * 50)
    print("Reverse Dictionary Complete!")
    print("=" * 50)
    print(f"Input English words: {stats['input_entries']:,}")
    print(f"Output German words: {stats['output_entries']:,}")
    print(f"Total mappings created: {stats['total_mappings']:,}")
    print(f"Compound words detected: {stats['compound_words_detected']:,}")
    print(f"\nOutput files:")
    print(f"  - {OUTPUT_FILE}")
    print(f"  - {STATS_FILE}")
    print("=" * 50)


if __name__ == "__main__":
    main()
