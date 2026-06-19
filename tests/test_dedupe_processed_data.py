"""
test_dedupe_processed_data.py — Tests for data deduplication.

Uses temporary directories and JSON files to verify deduplication
logic without affecting real processed data.
"""

import json
import logging
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch

import pytest

from dedupe_processed_data import JSON_DIR, dedupe_laws


def test_removes_duplicate_laws_by_title():
    """Should remove duplicate laws that share the same title."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create three JSON files: two with same title, one unique
        data1 = {"meta": {"title": "Bürgerliches Gesetzbuch"}}
        data2 = {"meta": {"title": "Bürgerliches Gesetzbuch"}}  # duplicate
        data3 = {"meta": {"title": "Strafgesetzbuch"}}

        os.makedirs(tmpdir, exist_ok=True)
        with open(os.path.join(tmpdir, "bgb.json"), "w", encoding="utf-8") as f:
            json.dump(data1, f)
        with open(os.path.join(tmpdir, "bgb_dup.json"), "w", encoding="utf-8") as f:
            json.dump(data2, f)
        with open(os.path.join(tmpdir, "stgb.json"), "w", encoding="utf-8") as f:
            json.dump(data3, f)

        with patch("dedupe_processed_data.JSON_DIR", tmpdir):
            dedupe_laws()

        remaining = [f for f in os.listdir(tmpdir) if f.endswith(".json")]
        assert len(remaining) == 2  # bgb.json + stgb.json
        assert "bgb_dup.json" not in remaining


def test_keeps_shortest_filename():
    """When duplicates exist, the shortest filename should be kept."""
    with tempfile.TemporaryDirectory() as tmpdir:
        data = {"meta": {"title": "Duplicate Law"}}
        # Short filename
        with open(os.path.join(tmpdir, "a.json"), "w", encoding="utf-8") as f:
            json.dump(data, f)
        # Long filename — should be removed
        with open(
            os.path.join(tmpdir, "very_long_duplicate_name.json"), "w", encoding="utf-8"
        ) as f:
            json.dump(data, f)

        with patch("dedupe_processed_data.JSON_DIR", tmpdir):
            dedupe_laws()

        remaining = [f for f in os.listdir(tmpdir) if f.endswith(".json")]
        assert "a.json" in remaining
        assert "very_long_duplicate_name.json" not in remaining


def test_handles_missing_json_directory():
    """Should log and return gracefully when JSON_DIR is missing."""
    with patch("dedupe_processed_data.JSON_DIR", "/nonexistent/dir"):
        # Should not raise
        dedupe_laws()


def test_logs_removal_of_duplicates(caplog):
    """Should log each duplicate removal."""
    with tempfile.TemporaryDirectory() as tmpdir:
        data1 = {"meta": {"title": "Test Law"}}
        data2 = {"meta": {"title": "Test Law"}}

        with open(os.path.join(tmpdir, "test1.json"), "w", encoding="utf-8") as f:
            json.dump(data1, f)
        with open(os.path.join(tmpdir, "test2.json"), "w", encoding="utf-8") as f:
            json.dump(data2, f)

        with patch("dedupe_processed_data.JSON_DIR", tmpdir):
            with caplog.at_level(logging.INFO):
                dedupe_laws()

            assert any("Removing duplicate" in r.message for r in caplog.records)


def test_error_handling_for_corrupted_json(caplog):
    """Corrupted JSON files should be logged as errors without crashing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Create invalid JSON file
        with open(os.path.join(tmpdir, "corrupt.json"), "w", encoding="utf-8") as f:
            f.write("{invalid json content")

        with open(os.path.join(tmpdir, "valid.json"), "w", encoding="utf-8") as f:
            json.dump({"meta": {"title": "Valid Law"}}, f)

        with patch("dedupe_processed_data.JSON_DIR", tmpdir):
            with caplog.at_level(logging.ERROR):
                dedupe_laws()

            assert any("Error reading" in r.message for r in caplog.records)

        # valid.json should still be present
        assert os.path.exists(os.path.join(tmpdir, "valid.json"))


def test_no_duplicates_does_nothing():
    """When there are no duplicates, no files should be removed."""
    with tempfile.TemporaryDirectory() as tmpdir:
        data1 = {"meta": {"title": "Law One"}}
        data2 = {"meta": {"title": "Law Two"}}

        with open(os.path.join(tmpdir, "law1.json"), "w", encoding="utf-8") as f:
            json.dump(data1, f)
        with open(os.path.join(tmpdir, "law2.json"), "w", encoding="utf-8") as f:
            json.dump(data2, f)

        initial_count = len([f for f in os.listdir(tmpdir) if f.endswith(".json")])

        with patch("dedupe_processed_data.JSON_DIR", tmpdir):
            dedupe_laws()

        remaining = [f for f in os.listdir(tmpdir) if f.endswith(".json")]
        assert len(remaining) == initial_count


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
