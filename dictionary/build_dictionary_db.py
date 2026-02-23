"""
Dictionary Database Builder

Builds the SQLite dictionary database from the reversed dictionary JSON.
Creates indexes and populates legal priority terms.

Input: de_en_reversed.json (from reverse_dictionary.py)
Output: dictionary.db (SQLite database)

Usage:
    python build_dictionary_db.py
    
Options:
    --legal-terms CSV_FILE  Import additional legal terms from CSV
    --rebuild              Force rebuild (delete existing database)
"""

import json
import logging
import os
import sqlite3
import argparse
import csv
from typing import Dict, List, Optional

# Configuration
INPUT_FILE = "./dictionary/de_en_reversed.json"
SCHEMA_FILE = "./dictionary/schema.sql"
DB_FILE = "./dictionary/dictionary.db"
LEGAL_TERMS_CSV = "./dictionary/legal_priority_terms.csv"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


def get_db_connection(db_path: str) -> sqlite3.Connection:
    """Create database connection with optimizations."""
    conn = sqlite3.connect(db_path)
    
    # Optimize for performance
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA cache_size = 10000")
    conn.execute("PRAGMA temp_store = MEMORY")
    conn.execute("PRAGMA mmap_size = 268435456")  # 256MB
    
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON")
    
    return conn


def create_schema(conn: sqlite3.Connection, schema_path: str):
    """Create database schema from SQL file."""
    logger.info("Creating database schema...")
    
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    conn.executescript(schema_sql)
    conn.commit()
    
    logger.info("Schema created successfully")


def populate_dictionary(conn: sqlite3.Connection, de_en_map: Dict, batch_size: int = 1000):
    """Populate main dictionary table."""
    logger.info("Populating dictionary table...")
    
    cursor = conn.cursor()
    entries = []
    total_inserted = 0
    
    for german_normalized, translations in de_en_map.items():
        for entry in translations:
            entries.append((
                entry.get('german', german_normalized),
                german_normalized,
                entry.get('english', ''),
                int(entry.get('frequency', 1)),
                ', '.join(entry.get('pos_tags', [])) if entry.get('pos_tags') else None,
                entry.get('english_normalized', ''),
                None  # context_tags (JSON)
            ))
            
            # Batch insert
            if len(entries) >= batch_size:
                cursor.executemany('''
                    INSERT INTO de_en_dictionary 
                    (german_word, german_word_normalized, english_translation, 
                     frequency, part_of_speech, source_entry, context_tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', entries)
                conn.commit()
                total_inserted += len(entries)
                entries = []
                
                if total_inserted % 10000 == 0:
                    logger.info(f"Inserted {total_inserted:,} entries...")
    
    # Insert remaining entries
    if entries:
        cursor.executemany('''
            INSERT INTO de_en_dictionary 
            (german_word, german_word_normalized, english_translation, 
             frequency, part_of_speech, source_entry, context_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', entries)
        conn.commit()
        total_inserted += len(entries)
    
    logger.info(f"Dictionary table populated: {total_inserted:,} entries")
    return total_inserted


def populate_legal_terms_from_csv(conn: sqlite3.Connection, csv_path: str):
    """Populate legal priority terms from CSV file."""
    if not os.path.exists(csv_path):
        logger.warning(f"Legal terms CSV not found: {csv_path}")
        return 0
    
    logger.info(f"Loading legal terms from {csv_path}...")
    
    cursor = conn.cursor()
    inserted = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                cursor.execute('''
                    INSERT OR REPLACE INTO legal_priority_terms 
                    (german_term, german_term_normalized, english_translation,
                     alternative_translations, priority_level, context_category, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    row.get('german_term', ''),
                    row.get('german_term_normalized', row.get('german_term', '').lower()),
                    row.get('english_translation', ''),
                    row.get('alternative_translations', '[]'),
                    int(row.get('priority_level', 3)),
                    row.get('context_category', 'general'),
                    row.get('notes', '')
                ))
                inserted += 1
            except Exception as e:
                logger.debug(f"Error inserting row: {e}")
    
    conn.commit()
    logger.info(f"Legal terms inserted: {inserted}")
    return inserted


def identify_compound_words(conn: sqlite3.Connection, min_length: int = 12):
    """Identify and store compound words for decomposition."""
    logger.info(f"Identifying compound words (min length: {min_length})...")
    
    cursor = conn.cursor()
    
    # Find long German words (likely compounds)
    cursor.execute('''
        SELECT DISTINCT german_word, german_word_normalized, english_translation
        FROM de_en_dictionary
        WHERE LENGTH(german_word_normalized) >= ?
        ORDER BY LENGTH(german_word_normalized) DESC
        LIMIT 5000
    ''', (min_length,))
    
    compounds = cursor.fetchall()
    inserted = 0
    
    for german, german_norm, english in compounds:
        # Simple heuristic: look for common compound markers
        # This is a basic implementation - full decomposition requires a component dictionary
        components = []
        
        # Common compound suffixes
        suffixes = ['ung', 'keit', 'heit', 'schaft', 'lich', 'tion', 'ierung']
        for suffix in suffixes:
            if german_norm.endswith(suffix) and len(german_norm) > len(suffix) + 3:
                stem = german_norm[:-len(suffix)]
                components = [stem, suffix]
                break
        
        if components:
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO compound_words 
                    (full_word, components, component_count, english_translation)
                    VALUES (?, ?, ?, ?)
                ''', (
                    german_norm,
                    json.dumps(components),
                    len(components),
                    english
                ))
                inserted += 1
            except Exception as e:
                logger.debug(f"Error inserting compound: {e}")
    
    conn.commit()
    logger.info(f"Compound words identified: {inserted}")
    return inserted


def create_indexes(conn: sqlite3.Connection):
    """Create additional indexes for performance."""
    logger.info("Creating indexes...")
    
    cursor = conn.cursor()
    
    # Full-text search index
    try:
        cursor.execute('''
            CREATE VIRTUAL TABLE IF NOT EXISTS de_en_fts USING fts5(
                german_word,
                english_translation,
                content='de_en_dictionary',
                content_rowid='id'
            )
        ''')
        
        # Populate FTS index
        cursor.execute('''
            INSERT INTO de_en_fts(german_word, english_translation)
            SELECT german_word, english_translation FROM de_en_dictionary
        ''')
        
        conn.commit()
        logger.info("Full-text search index created")
    except Exception as e:
        logger.warning(f"FTS index creation failed: {e}")


def get_stats(conn: sqlite3.Connection) -> Dict:
    """Get database statistics."""
    cursor = conn.cursor()
    
    stats = {}
    
    # Total entries
    cursor.execute("SELECT COUNT(*) FROM de_en_dictionary")
    stats['total_entries'] = cursor.fetchone()[0]
    
    # Unique German words
    cursor.execute("SELECT COUNT(DISTINCT german_word_normalized) FROM de_en_dictionary")
    stats['unique_german_words'] = cursor.fetchone()[0]
    
    # Legal terms
    cursor.execute("SELECT COUNT(*) FROM legal_priority_terms")
    stats['legal_terms'] = cursor.fetchone()[0]
    
    # Compound words
    cursor.execute("SELECT COUNT(*) FROM compound_words")
    stats['compound_words'] = cursor.fetchone()[0]
    
    # Database size
    cursor.execute("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()")
    stats['db_size_bytes'] = cursor.fetchone()[0]
    
    return stats


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Build German-English Dictionary Database')
    parser.add_argument('--legal-terms', type=str, default=LEGAL_TERMS_CSV,
                       help='Path to legal terms CSV file')
    parser.add_argument('--rebuild', action='store_true',
                       help='Force rebuild (delete existing database)')
    
    args = parser.parse_args()
    
    # Check input file
    if not os.path.exists(INPUT_FILE):
        logger.error(f"Input file not found: {INPUT_FILE}")
        logger.error("Run reverse_dictionary.py first")
        return
    
    # Remove existing database if rebuild requested
    if args.rebuild and os.path.exists(DB_FILE):
        logger.info(f"Removing existing database: {DB_FILE}")
        os.remove(DB_FILE)
    
    # Load reversed dictionary
    logger.info(f"Loading reversed dictionary from {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        de_en_map = json.load(f)
    
    logger.info(f"Loaded {len(de_en_map):,} German headwords")
    
    # Create database
    logger.info(f"Creating database: {DB_FILE}")
    conn = get_db_connection(DB_FILE)
    
    try:
        # Create schema
        create_schema(conn, SCHEMA_FILE)
        
        # Populate dictionary
        total_entries = populate_dictionary(conn, de_en_map)
        
        # Populate legal terms
        legal_terms_count = populate_legal_terms_from_csv(conn, args.legal_terms)
        
        # Identify compound words
        compound_count = identify_compound_words(conn)
        
        # Create indexes
        create_indexes(conn)
        
        # Get statistics
        stats = get_stats(conn)
        
        # Print summary
        print("\n" + "=" * 50)
        print("Dictionary Database Build Complete!")
        print("=" * 50)
        print(f"Total dictionary entries: {stats['total_entries']:,}")
        print(f"Unique German words: {stats['unique_german_words']:,}")
        print(f"Legal priority terms: {stats['legal_terms']:,}")
        print(f"Compound words: {stats['compound_words']:,}")
        print(f"Database size: {stats['db_size_bytes'] / 1024 / 1024:.2f} MB")
        print(f"\nDatabase file: {DB_FILE}")
        print("=" * 50)
    
    finally:
        conn.close()


if __name__ == "__main__":
    main()
