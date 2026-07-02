"""SQLite database initialization and connection management for law processing."""

import os
import sqlite3
import threading

# Database path: laws.db in the project root (one level up from scripts/)
DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "laws.db")
)

_local = threading.local()


def get_connection() -> sqlite3.Connection:
    """Get a thread-local database connection."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=OFF")
        _local.conn = conn
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS laws (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    key         TEXT UNIQUE NOT NULL,
                    title       TEXT,
                    alt_title   TEXT DEFAULT '',
                    source      TEXT,
                    last_changed TEXT,
                    category    TEXT DEFAULT 'other',
                    authority   TEXT DEFAULT 'Federal Law',
                    status      TEXT DEFAULT 'Active',
                    jurisdiction TEXT DEFAULT 'Germany (Federal)'
                );

        CREATE TABLE IF NOT EXISTS norms (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            law_id      INTEGER NOT NULL REFERENCES laws(id),
            norm_id     TEXT NOT NULL,
            title       TEXT,
            content     TEXT,
            token_count INTEGER DEFAULT 0,
            embedding   BLOB
        );

        CREATE INDEX IF NOT EXISTS idx_norms_law_id ON norms(law_id);
        CREATE INDEX IF NOT EXISTS idx_norms_norm_id ON norms(norm_id);
        CREATE INDEX IF NOT EXISTS idx_laws_key ON laws(key);

        CREATE TABLE IF NOT EXISTS law_versions (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    law_key     TEXT NOT NULL UNIQUE,
                    last_changed TEXT,
                    checksum    TEXT,
                    checked_at  TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_law_versions_key ON law_versions(law_key);
    """)
    conn.commit()
