"""
test_extract_laws_metadata.py — Tests for CSV metadata extraction.

Uses temporary SQLite databases and CSV files to verify extraction logic.
"""

import csv
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch

import pytest

# Import the module functions directly
from scripts.extract_laws_metadata import extract, format_datetime


def test_format_datetime_yyyy_mm_dd():
    """YYYY-MM-DD input should become 'YYYY-MM-DD 00:00:00'."""
    assert format_datetime("2024-01-15") == "2024-01-15 00:00:00"


def test_format_datetime_empty():
    """Empty input should return empty string."""
    assert format_datetime("") == ""


def test_format_datetime_none():
    """None input should return empty string."""
    assert format_datetime(None) == ""


def test_format_datetime_already_full():
    """Already formatted datetime should pass through unchanged."""
    val = "2024-01-15 12:30:00"
    assert format_datetime(val) == val


def test_extract_creates_csv_with_correct_columns():
    """Should create a CSV with the expected column headers."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")
        csv_path = os.path.join(tmpdir, "laws_metadata.csv")

        # Create a temporary SQLite database with the laws table
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
        conn.execute(
            "INSERT INTO laws (key, title, alt_title, category, authority, status, jurisdiction, last_changed, source) "
            "VALUES ('BGB', 'Bürgerliches Gesetzbuch', 'BGB', 'consumer', 'Federal Law', 'Active', "
            "'Germany (Federal)', '2024-01-10', 'gesetze-im-internet.de')"
        )
        conn.commit()
        conn.close()

        # Patch the module-level db_path and output
        with patch("scripts.extract_laws_metadata.OUTPUT", csv_path):
            with patch("scripts.extract_laws_metadata.os.path.dirname") as mock_dirname:
                # Make os.path.dirname(os.path.dirname(__file__)) point to tmpdir
                mock_dirname.side_effect = [
                    os.path.dirname(tmpdir),
                    tmpdir,
                    os.path.dirname(tmpdir),
                ]
                extract()

        # Read CSV and verify
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            assert reader.fieldnames == [
                "key",
                "title",
                "alt_title",
                "category",
                "authority",
                "status",
                "jurisdiction",
                "last_changed",
                "source",
                "total_norms",
            ]
            rows = list(reader)
            assert len(rows) == 1
            row = rows[0]
            assert row["key"] == "BGB"
            assert row["title"] == "Bürgerliches Gesetzbuch"
            assert row["category"] == "consumer"
            assert row["last_changed"] == "2024-01-10 00:00:00"


def test_empty_category_defaults_to_other():
    """When category is empty or NULL, CSV should show 'other'."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "laws.db")
        csv_path = os.path.join(tmpdir, "laws_metadata.csv")

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
        conn.execute("INSERT INTO laws (key, title) VALUES ('TEST', 'Test Law')")
        conn.commit()
        conn.close()

        with patch("scripts.extract_laws_metadata.OUTPUT", csv_path):
            with patch("scripts.extract_laws_metadata.os.path.dirname") as mock_dirname:
                mock_dirname.side_effect = [
                    os.path.dirname(tmpdir),
                    tmpdir,
                    os.path.dirname(tmpdir),
                ]
                extract()

        with open(csv_path, "r", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))
            assert rows[0]["category"] == "other"


def test_missing_database_file_graceful():
    """Should print error and return gracefully when DB file is missing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "laws_metadata.csv")
        missing_db = os.path.join(tmpdir, "nonexistent.db")

        with patch("scripts.extract_laws_metadata.OUTPUT", csv_path):
            with patch(
                "scripts.extract_laws_metadata.os.path.exists", return_value=False
            ):
                result = extract()
                assert result is None  # Function returns None when DB missing


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
