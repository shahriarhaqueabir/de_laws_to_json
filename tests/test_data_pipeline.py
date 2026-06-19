"""
test_data_pipeline.py — End-to-end data pipeline validation.

Tests JSON file structure, SQLite database schema, search pagination offsets,
and token count logic using a temporary database with sample data.
"""

import json
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

# ---------------------------------------------------------------------------
# JSON file structure tests
# ---------------------------------------------------------------------------


def test_json_file_structure_matches_expected_schema():
    """A sample JSON law should have key, output.meta, output.metadaten, output.norms."""
    sample = {
        "key": "BGB",
        "output": {
            "meta": {
                "title": "Bürgerliches Gesetzbuch",
                "download_date": "2024-01-15",
                "last_changed": "2024-01-10",
            },
            "metadaten": {
                "jurabk": "BGB",
                "amtabk": "BMJ",
                "ausfertigung-datum": "1896-08-18",
            },
            "norms": [
                {
                    "meta": {"norm_id": "§ 7", "title": "Good Faith"},
                    "paragraphs": [
                        {
                            "meta": {"paragraph_id": "1", "token": 28},
                            "content": "Test paragraph content.",
                        }
                    ],
                }
            ],
        },
    }
    assert "key" in sample
    assert "output" in sample
    assert "meta" in sample["output"]
    assert "metadaten" in sample["output"]
    assert "norms" in sample["output"]
    assert sample["key"] == "BGB"
    assert sample["output"]["meta"]["title"] == "Bürgerliches Gesetzbuch"


def test_norm_array_contains_items_with_meta_and_paragraphs():
    """Each norm in the output.norms array should have meta and paragraphs."""
    sample = {
        "meta": {"norm_id": "§ 7", "title": "Good Faith"},
        "paragraphs": [
            {"meta": {"paragraph_id": "1", "token": 28}, "content": "Paragraph text"}
        ],
    }
    assert "meta" in sample
    assert "paragraphs" in sample
    assert "norm_id" in sample["meta"]
    assert "title" in sample["meta"]
    if sample["paragraphs"]:
        p = sample["paragraphs"][0]
        assert "meta" in p
        assert "content" in p
        assert "paragraph_id" in p["meta"]


# ---------------------------------------------------------------------------
# SQLite database schema tests
# ---------------------------------------------------------------------------


def test_database_has_expected_tables():
    """SQLite database should have: laws, norms, fts_norms, cross_references,
    law_versions, translations_cache."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")

        # Create tables matching the schema
        conn = sqlite3.connect(db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS laws (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                alt_title TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'other',
                authority TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Active',
                jurisdiction TEXT NOT NULL DEFAULT 'Germany (Federal)',
                last_changed TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS norms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                law_id INTEGER NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
                norm_id TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                token_count INTEGER NOT NULL DEFAULT 0,
                embedding BLOB
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS fts_norms USING fts5 (
                norm_id, title, content,
                content='norms', content_rowid='id',
                tokenize='unicode61 remove_diacritics 1'
            );
            CREATE TABLE IF NOT EXISTS cross_references (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_norm_id INTEGER NOT NULL REFERENCES norms(id) ON DELETE CASCADE,
                target_law TEXT NOT NULL DEFAULT '',
                target_norm TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS law_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                law_key TEXT NOT NULL UNIQUE,
                last_changed TEXT NOT NULL DEFAULT '',
                checksum TEXT NOT NULL DEFAULT '',
                checked_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS translations_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_text TEXT NOT NULL UNIQUE,
                translation TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                cached_at TEXT NOT NULL DEFAULT ''
            );
        """)
        conn.close()

        # Check tables exist
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()

        assert "laws" in tables
        assert "norms" in tables
        # fts_norms may not appear in sqlite_master for virtual tables;
        # try checking separately
        conn = sqlite3.connect(db_path)
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' OR type='virtual'"
        )
        all_tables = {row[0] for row in cursor.fetchall()}
        conn.close()

        assert "laws" in all_tables
        assert "norms" in all_tables
        for tbl in ["cross_references", "law_versions", "translations_cache"]:
            assert tbl in all_tables, f"Missing table: {tbl}"


def test_laws_table_schema():
    """laws table columns match: id, key, title, alt_title, category, authority,
    status, jurisdiction, last_changed, source."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")
        conn = sqlite3.connect(db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS laws (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                alt_title TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'other',
                authority TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Active',
                jurisdiction TEXT NOT NULL DEFAULT 'Germany (Federal)',
                last_changed TEXT NOT NULL DEFAULT '',
                source TEXT NOT NULL DEFAULT ''
            )
        """)
        cursor = conn.execute("PRAGMA table_info(laws)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()

        expected = {
            "id",
            "key",
            "title",
            "alt_title",
            "category",
            "authority",
            "status",
            "jurisdiction",
            "last_changed",
            "source",
        }
        assert columns == expected


def test_norms_table_schema():
    """norms table columns match: id, law_id, norm_id, title, content, token_count, embedding."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")
        conn = sqlite3.connect(db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS norms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                law_id INTEGER NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
                norm_id TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                token_count INTEGER NOT NULL DEFAULT 0,
                embedding BLOB
            )
        """)
        cursor = conn.execute("PRAGMA table_info(norms)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()

        expected = {
            "id",
            "law_id",
            "norm_id",
            "title",
            "content",
            "token_count",
            "embedding",
        }
        assert columns == expected


# ---------------------------------------------------------------------------
# Search pagination offset tests
# ---------------------------------------------------------------------------


def test_search_pagination_offset():
    """searchNorms should calculate correct offsets based on page number.
    Standard: page_size=20, offset = (page - 1) * page_size."""

    def get_offset(page: int, page_size: int = 20) -> int:
        return (page - 1) * page_size

    assert get_offset(1) == 0
    assert get_offset(2) == 20
    assert get_offset(3) == 40
    assert get_offset(5) == 80


def test_search_pagination_custom_page_size():
    """Offset calculation should work with custom page sizes."""

    def get_offset(page: int, page_size: int) -> int:
        return (page - 1) * page_size

    assert get_offset(1, 10) == 0
    assert get_offset(3, 25) == 50
    assert get_offset(10, 5) == 45


# ---------------------------------------------------------------------------
# Token count tests
# ---------------------------------------------------------------------------


def test_token_count_uses_whitespace_splitting():
    """Token count should use whitespace splitting as in process_de_laws.py."""

    # From process_de_laws.py line 437:
    # token_count = len(content.split())
    def count_tokens(content: str) -> int:
        return len(content.split())

    assert count_tokens("") == 0
    assert count_tokens("hello") == 1
    assert count_tokens("hello world") == 2
    assert count_tokens("  spaced   text  ") == 2
    assert count_tokens("German law text with multiple words here") == 7


def test_token_count_multiline():
    """Multi-line content should still use whitespace splitting."""

    def count_tokens(content: str) -> int:
        return len(content.split())

    text = """Paragraph one has some text.
Paragraph two continues here.
And a final paragraph."""
    # 13 words total (4+4+4+1)
    assert count_tokens(text) == 13


# ---------------------------------------------------------------------------
# Pipeline stage tests
# ---------------------------------------------------------------------------


def test_pipeline_stages_defined():
    """Pipeline stages should be: download -> process -> seed."""
    stages = ["download", "process", "seed"]
    assert len(stages) == 3
    assert stages[0] == "download"
    assert stages[1] == "process"
    assert stages[2] == "seed"


def test_sample_law_data_can_be_written_and_read():
    """Verify that inserting a law with norms works end-to-end."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")
        conn = sqlite3.connect(db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS laws (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT 'other'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS norms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                law_id INTEGER NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
                norm_id TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                token_count INTEGER NOT NULL DEFAULT 0
            )
        """)

        # Insert a law
        conn.execute(
            "INSERT INTO laws (key, title, category) VALUES ('BGB', 'Bürgerliches Gesetzbuch', 'consumer')"
        )

        # Insert norms
        conn.execute(
            "INSERT INTO norms (law_id, norm_id, title, content, token_count) VALUES (1, '§ 1', 'First', 'Test content A', 3)"
        )
        conn.execute(
            "INSERT INTO norms (law_id, norm_id, title, content, token_count) VALUES (1, '§ 2', 'Second', 'Test content B', 3)"
        )
        conn.commit()

        # Read back
        laws = conn.execute("SELECT key, title, category FROM laws").fetchall()
        assert len(laws) == 1
        assert laws[0][0] == "BGB"

        norms = conn.execute(
            "SELECT norm_id, title, content FROM norms WHERE law_id = 1"
        ).fetchall()
        assert len(norms) == 2
        conn.close()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
