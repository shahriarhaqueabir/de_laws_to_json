-- German Law Search Dictionary Database Schema
-- SQLite database for German→English legal dictionary
-- Created: February 23, 2026

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Main dictionary table: German → English translations
CREATE TABLE IF NOT EXISTS de_en_dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    german_word TEXT NOT NULL,
    german_word_normalized TEXT NOT NULL,
    english_translation TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    part_of_speech TEXT,
    source_entry TEXT,  -- Original English headword from TEI
    context_tags TEXT,  -- JSON array: ["legal", "formal", "contract"]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_german_word ON de_en_dictionary(german_word_normalized);
CREATE INDEX IF NOT EXISTS idx_german_word_exact ON de_en_dictionary(german_word COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_german_prefix ON de_en_dictionary(german_word_normalized COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_frequency ON de_en_dictionary(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_pos ON de_en_dictionary(part_of_speech);

-- Compound words support table
-- German compound words: "Kündigungsschutzfrist" → ["Kündigung", "Schutz", "Frist"]
CREATE TABLE IF NOT EXISTS compound_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_word TEXT NOT NULL UNIQUE,
    components TEXT NOT NULL,  -- JSON array of component words
    component_count INTEGER NOT NULL,
    english_translation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compound_word ON compound_words(full_word);

-- Legal priority terms (manually curated high-value legal terms)
CREATE TABLE IF NOT EXISTS legal_priority_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    german_term TEXT NOT NULL UNIQUE,
    german_term_normalized TEXT NOT NULL,
    english_translation TEXT NOT NULL,
    alternative_translations TEXT,  -- JSON array of alternatives
    priority_level INTEGER NOT NULL DEFAULT 1,  -- 1=highest, 5=lowest
    context_category TEXT,  -- "housing", "labor", "criminal", etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_term ON legal_priority_terms(german_term_normalized);
CREATE INDEX IF NOT EXISTS idx_legal_priority ON legal_priority_terms(priority_level);
CREATE INDEX IF NOT EXISTS idx_legal_category ON legal_priority_terms(context_category);

-- Translation cache (mirrors ai_translations.json for faster access)
CREATE TABLE IF NOT EXISTS translation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    german_text TEXT NOT NULL UNIQUE,
    english_translation TEXT NOT NULL,
    is_title BOOLEAN DEFAULT FALSE,
    source TEXT DEFAULT 'manual',  -- 'manual', 'ai', 'dictionary'
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_text ON translation_cache(german_text);
CREATE INDEX IF NOT EXISTS idx_cache_usage ON translation_cache(usage_count DESC);

-- Query statistics for optimization
CREATE TABLE IF NOT EXISTS query_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_term TEXT NOT NULL,
    query_type TEXT NOT NULL,  -- 'exact', 'prefix', 'fuzzy', 'compound'
    results_found INTEGER DEFAULT 0,
    response_time_ms REAL,
    queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stats_term ON query_stats(query_term);
CREATE INDEX IF NOT EXISTS idx_stats_time ON query_stats(queried_at);

-- View: Most frequent translations per German word
CREATE VIEW IF NOT EXISTS v_top_translations AS
SELECT 
    german_word,
    german_word_normalized,
    english_translation,
    frequency,
    part_of_speech,
    ROW_NUMBER() OVER (
        PARTITION BY german_word_normalized 
        ORDER BY frequency DESC
    ) as rank
FROM de_en_dictionary;

-- View: Legal terms with translations
CREATE VIEW IF NOT EXISTS v_legal_terms AS
SELECT 
    german_term,
    english_translation,
    alternative_translations,
    priority_level,
    context_category
FROM legal_priority_terms
ORDER BY priority_level, german_term;

-- View: Dictionary statistics
CREATE VIEW IF NOT EXISTS v_dictionary_stats AS
SELECT 
    'Total Entries' as metric,
    COUNT(*) as value
FROM de_en_dictionary
UNION ALL
SELECT 
    'Unique German Words',
    COUNT(DISTINCT german_word_normalized)
FROM de_en_dictionary
UNION ALL
SELECT 
    'Legal Priority Terms',
    COUNT(*)
FROM legal_priority_terms
UNION ALL
SELECT 
    'Compound Words',
    COUNT(*)
FROM compound_words
UNION ALL
SELECT 
    'Cached Translations',
    COUNT(*)
FROM translation_cache;

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_de_en_dictionary_timestamp 
AFTER UPDATE ON de_en_dictionary
BEGIN
    UPDATE de_en_dictionary 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Insert default legal priority terms (sample - will be populated from CSV)
INSERT OR IGNORE INTO legal_priority_terms 
(german_term, german_term_normalized, english_translation, alternative_translations, priority_level, context_category)
VALUES 
    ('BGB', 'bgb', 'Civil Code', '["German Civil Code", "Bürgerliches Gesetzbuch"]', 1, 'general'),
    ('StGB', 'stgb', 'Criminal Code', '["German Criminal Code", "Strafgesetzbuch"]', 1, 'criminal'),
    ('GG', 'gg', 'Basic Law', '["German Constitution", "Grundgesetz"]', 1, 'public'),
    ('Kündigung', 'kündigung', 'termination', '["notice", "dismissal", "cancellation"]', 1, 'labor'),
    ('Miete', 'miete', 'rent', '["rental", "lease", "tenancy"]', 1, 'housing'),
    ('Vermieter', 'vermieter', 'landlord', '["lessor"]', 1, 'housing'),
    ('Mieter', 'mieter', 'tenant', '["lessee", "renter"]', 1, 'housing'),
    ('Vertrag', 'vertrag', 'contract', '["agreement"]', 1, 'general'),
    ('Gesetz', 'gesetz', 'law', '["statute", "act", "legislation"]', 1, 'general'),
    ('Gericht', 'gericht', 'court', '["tribunal"]', 1, 'general');
