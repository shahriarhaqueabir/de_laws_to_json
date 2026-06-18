-- German Law Vault — SQLite Schema
-- WAL mode and foreign keys are enabled at connection time in db.py

-- ── Laws ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS laws (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    key           TEXT    UNIQUE NOT NULL,
    title         TEXT    NOT NULL DEFAULT '',
    alt_title     TEXT    NOT NULL DEFAULT '',
    category      TEXT    NOT NULL DEFAULT 'other',
    authority     TEXT    NOT NULL DEFAULT '',
    status        TEXT    NOT NULL DEFAULT 'Active',
    jurisdiction  TEXT    NOT NULL DEFAULT 'Germany (Federal)',
    last_changed  TEXT    NOT NULL DEFAULT '',
    source        TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_laws_category ON laws (category);
CREATE INDEX IF NOT EXISTS idx_laws_key      ON laws (key);

-- ── Norms (paragraphs inside a law) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS norms (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    law_id      INTEGER NOT NULL REFERENCES laws (id) ON DELETE CASCADE,
    norm_id     TEXT    NOT NULL DEFAULT '',
    title       TEXT    NOT NULL DEFAULT '',
    content     TEXT    NOT NULL DEFAULT '',
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding   BLOB                              -- float32 bytes; populated by Phase 2
);

CREATE INDEX IF NOT EXISTS idx_norms_law_id  ON norms (law_id);
CREATE INDEX IF NOT EXISTS idx_norms_norm_id ON norms (norm_id);

-- ── Full-text search over norms (SQLite FTS5) ─────────────────────────────
-- content= makes this a "content table" backed by norms; content_rowid= maps to norms.id
CREATE VIRTUAL TABLE IF NOT EXISTS fts_norms USING fts5 (
    norm_id,
    title,
    content,
    content     = 'norms',
    content_rowid = 'id',
    tokenize    = 'unicode61 remove_diacritics 1'
);

-- Triggers to keep FTS5 in sync with the norms table
CREATE TRIGGER IF NOT EXISTS norms_ai AFTER INSERT ON norms BEGIN
    INSERT INTO fts_norms (rowid, norm_id, title, content)
    VALUES (new.id, new.norm_id, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS norms_ad AFTER DELETE ON norms BEGIN
    INSERT INTO fts_norms (fts_norms, rowid, norm_id, title, content)
    VALUES ('delete', old.id, old.norm_id, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS norms_au AFTER UPDATE ON norms BEGIN
    INSERT INTO fts_norms (fts_norms, rowid, norm_id, title, content)
    VALUES ('delete', old.id, old.norm_id, old.title, old.content);
    INSERT INTO fts_norms (rowid, norm_id, title, content)
    VALUES (new.id, new.norm_id, new.title, new.content);
END;

-- ── Cross-references between norms (populated in Phase 3) ─────────────────
CREATE TABLE IF NOT EXISTS cross_references (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source_norm_id INTEGER NOT NULL REFERENCES norms (id) ON DELETE CASCADE,
    target_law     TEXT    NOT NULL DEFAULT '',
    target_norm    TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_xref_source ON cross_references (source_norm_id);
CREATE INDEX IF NOT EXISTS idx_xref_target ON cross_references (target_law);

-- ── Law version tracking (populated during processing; used by Phase 8) ───
CREATE TABLE IF NOT EXISTS law_versions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    law_key      TEXT    NOT NULL UNIQUE,
    last_changed TEXT    NOT NULL DEFAULT '',
    checksum     TEXT    NOT NULL DEFAULT '',
    checked_at   TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_lv_key ON law_versions (law_key);

-- ── Translation cache (replaces ai_translations.json, used in Phase 4) ────
CREATE TABLE IF NOT EXISTS translations_cache (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source_text TEXT    NOT NULL UNIQUE,
    translation TEXT    NOT NULL DEFAULT '',
    model       TEXT    NOT NULL DEFAULT '',
    cached_at   TEXT    NOT NULL DEFAULT ''
);
