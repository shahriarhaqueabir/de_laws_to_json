"""
test_process_de_laws.py — Tests for the XML processing pipeline.

Tests categorization, authority/status/jurisdiction inference,
XML parsing helpers, norm deduplication, key resolution,
and scoring logic.
"""

import json
import os
import sys
import tempfile
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock database.db BEFORE importing process_de_laws — the module does
# "from database.db import init_db, get_connection, DB_PATH" at module
# level, but database/ lives in _archive/backend/ not at the project root.
# We pre-seed sys.modules so Python resolves the import to mocks.
from unittest.mock import MagicMock

sys.modules["database"] = MagicMock()
sys.modules["database.db"] = MagicMock()
sys.modules["database.db"].init_db = MagicMock()
sys.modules["database.db"].get_connection = MagicMock()
sys.modules["database.db"].DB_PATH = ":memory:"

import pytest
from bs4 import BeautifulSoup

from process_de_laws import (
    FILE_FILTER,
    XML_DIR_PATH,
    _categorize,
    _dedupe_exact_norms,
    _dedupe_norm_ids,
    _infer_authority,
    _infer_jurisdiction,
    _infer_status,
    _parse_norm,
    _remove_year_suffix,
    _score_norm,
    collect_xml_files,
    convert_xml_to_dict,
    resolve_keys,
)

# ---------------------------------------------------------------------------
# _categorize tests
# ---------------------------------------------------------------------------


def test_categorize_housing():
    assert _categorize("Mietrecht und Wohnung", "MietG") == "housing"
    assert _categorize("Wohnungseigentumsgesetz", "WEG") == "housing"


def test_categorize_labor():
    assert _categorize("Arbeitsrecht", "ArbG") == "labor"
    assert _categorize("Kündigungsschutzgesetz", "KSchG") == "labor"


def test_categorize_consumer():
    assert _categorize("Kaufvertrag und Garantie", "KaufG") == "consumer"
    assert _categorize("Verbraucherkreditgesetz", "VKrG") == "consumer"


def test_categorize_traffic():
    assert _categorize("Straßenverkehrsordnung", "StVO") == "traffic"


def test_categorize_family():
    assert _categorize("Sorgerecht und Unterhalt", "FamG") == "family"


def test_categorize_criminal():
    assert _categorize("Strafgesetzbuch", "StGB") == "criminal"


def test_categorize_finance():
    assert _categorize("Steuergesetz", "FinG") == "finance"


def test_categorize_social():
    assert _categorize("Sozialgesetzbuch", "SGB") == "social"


def test_categorize_public():
    assert _categorize("Grundgesetz", "GG") == "public"


def test_categorize_tech():
    assert _categorize("Umweltschutz", "UmwG") == "tech"


def test_categorize_berlin():
    assert _categorize("Berliner Gesetz", "BlnG") == "berlin"


def test_categorize_other():
    assert _categorize("Unrelated Text Without Keywords", "XXX") == "other"


def test_categorize_uses_key_too():
    """Categorization should consider the key abbreviation as well."""
    assert _categorize("Unknown Law", "stvo") == "traffic"


# ---------------------------------------------------------------------------
# _infer_authority tests
# ---------------------------------------------------------------------------


def test_infer_authority_federal_law():
    assert _infer_authority("Bürgerliches Gesetzbuch", "BGB") == "Federal Law"
    assert _infer_authority("Einkommensteuergesetz", "EStG") == "Federal Law"


def test_infer_authority_regulation():
    assert _infer_authority("Straßenverkehrsordnung", "StVO") == "Regulation"
    assert _infer_authority("Test Verordnung", "TestV") == "Regulation"


def test_infer_authority_court_decision():
    assert _infer_authority("BGH Entscheidung", "BGH") == "Court Decision"


def test_infer_authority_default():
    """Default should return 'Regulation'."""
    assert _infer_authority("Other Document", "OD") == "Regulation"


# ---------------------------------------------------------------------------
# _infer_status tests
# ---------------------------------------------------------------------------


def test_infer_status_invalid_ausser_kraft():
    assert _infer_status("Gesetz außer Kraft") == "Invalid/Amended"


def test_infer_status_invalid_weggefallen():
    assert _infer_status("Weggefallen") == "Invalid/Amended"


def test_infer_status_invalid_af():
    assert _infer_status("Gesetz (a.F.)") == "Invalid/Amended"


def test_infer_status_active_default():
    assert _infer_status("Bürgerliches Gesetzbuch") == "Active"


# ---------------------------------------------------------------------------
# _infer_jurisdiction tests
# ---------------------------------------------------------------------------


def test_infer_jurisdiction_berlin_key():
    assert _infer_jurisdiction("BlnG", "Berlin Law") == "Berlin (State)"


def test_infer_jurisdiction_berlin_title():
    assert _infer_jurisdiction("BauO", "Berliner Bauordnung") == "Berlin (State)"


def test_infer_jurisdiction_federal_default():
    assert _infer_jurisdiction("BGB", "Bürgerliches Gesetzbuch") == "Germany (Federal)"


# ---------------------------------------------------------------------------
# _remove_year_suffix tests
# ---------------------------------------------------------------------------


def test_remove_year_suffix_strips_digits():
    assert _remove_year_suffix("BGB2024") == "BGB"


def test_remove_year_suffix_no_suffix():
    assert _remove_year_suffix("BGB") == "BGB"


def test_remove_year_suffix_empty():
    assert _remove_year_suffix("") == ""


# ---------------------------------------------------------------------------
# collect_xml_files tests
# ---------------------------------------------------------------------------


def test_collect_xml_files_empty_dir(tmp_path):
    """Should return empty list for empty directory."""
    results = collect_xml_files(str(tmp_path), ())
    assert results == []


def test_collect_xml_files_nonexistent_dir():
    """Should return empty list for nonexistent directory."""
    results = collect_xml_files("/nonexistent/path", ())
    assert results == []


def test_collect_xml_files_filters_by_file_filter(tmp_path):
    """Should only include files matching the FILE_FILTER."""
    (tmp_path / "BJNR001950789.xml").write_text("<a/>")
    (tmp_path / "BJNR002190897.xml").write_text("<b/>")
    (tmp_path / "other.xml").write_text("<c/>")

    results = collect_xml_files(str(tmp_path), ("BJNR001950789",))
    assert len(results) == 1
    assert "BJNR001950789" in results[0]


def test_collect_xml_files_skips_hidden(tmp_path):
    """Should skip hidden files and .gitkeep."""
    (tmp_path / ".hidden.xml").write_text("<a/>")
    (tmp_path / ".gitkeep").write_text("")
    (tmp_path / "valid.xml").write_text("<b/>")

    results = collect_xml_files(str(tmp_path), ())
    assert len(results) == 1
    assert "valid.xml" in results[0]


def test_collect_xml_files_only_xml(tmp_path):
    """Should only return .xml files."""
    (tmp_path / "test.xml").write_text("<a/>")
    (tmp_path / "test.txt").write_text("hello")
    (tmp_path / "test.zip").write_text("zip")

    results = collect_xml_files(str(tmp_path), ())
    assert len(results) == 1
    assert results[0].endswith(".xml")


# ---------------------------------------------------------------------------
# _dedupe_exact_norms tests
# ---------------------------------------------------------------------------


def test_dedupe_exact_norms_removes_duplicates():
    norms = [
        {
            "norm_id": "§ 1",
            "title": "Test",
            "paragraphs": [{"id": "1", "text": "text"}],
        },
        {
            "norm_id": "§ 1",
            "title": "Test",
            "paragraphs": [{"id": "1", "text": "text"}],
        },
        {
            "norm_id": "§ 2",
            "title": "Other",
            "paragraphs": [{"id": "1", "text": "other"}],
        },
    ]
    result = _dedupe_exact_norms(norms)
    assert len(result) == 2


def test_dedupe_exact_norms_keeps_different():
    norms = [
        {"norm_id": "§ 1", "title": "First", "paragraphs": [{"id": "1", "text": "a"}]},
        {"norm_id": "§ 2", "title": "Second", "paragraphs": [{"id": "1", "text": "b"}]},
    ]
    result = _dedupe_exact_norms(norms)
    assert len(result) == 2


# ---------------------------------------------------------------------------
# _score_norm tests
# ---------------------------------------------------------------------------


def test_score_norm_counts_paragraphs():
    norm = {
        "norm_id": "§ 1",
        "title": "Title",
        "paragraphs": [
            {"id": "1", "text": "One"},
            {"id": "2", "text": "Two"},
        ],
    }
    paras, content_len, title_len = _score_norm(norm)
    assert paras == 2
    assert content_len == 6  # len("One") + len("Two")
    assert title_len == 5  # len("Title")


def test_score_norm_empty_paragraphs():
    norm = {"norm_id": "§ 1", "title": "", "paragraphs": []}
    paras, content_len, title_len = _score_norm(norm)
    assert paras == 0
    assert content_len == 0
    assert title_len == 0


# ---------------------------------------------------------------------------
# _dedupe_norm_ids tests
# ---------------------------------------------------------------------------


def test_dedupe_norm_ids_keeps_highest_scored():
    norms = [
        {"norm_id": "§ 1", "title": "Short", "paragraphs": [{"id": "1", "text": "a"}]},
        {
            "norm_id": "§ 1",
            "title": "Long Version",
            "paragraphs": [{"id": "1", "text": "abc"}, {"id": "2", "text": "def"}],
        },
    ]
    result = _dedupe_norm_ids(norms)
    assert len(result) == 1
    assert result[0]["title"] == "Long Version"


def test_dedupe_norm_ids_keeps_empty_id():
    """Norms with empty norm_id should be kept."""
    norms = [
        {"norm_id": "", "title": "Empty", "paragraphs": []},
        {"norm_id": "§ 1", "title": "Real", "paragraphs": [{"id": "1", "text": "x"}]},
    ]
    result = _dedupe_norm_ids(norms)
    assert len(result) == 2


def test_dedupe_norm_ids_different_ids():
    norms = [
        {"norm_id": "§ 1", "title": "First", "paragraphs": [{"id": "1", "text": "a"}]},
        {"norm_id": "§ 2", "title": "Second", "paragraphs": [{"id": "1", "text": "b"}]},
    ]
    result = _dedupe_norm_ids(norms)
    assert len(result) == 2


# ---------------------------------------------------------------------------
# resolve_keys tests
# ---------------------------------------------------------------------------


def test_resolve_keys_basic():
    results = [
        {
            "raw_key": "BGB",
            "title": "BGB",
            "source": "bgb.xml",
            "last_changed": "",
            "norms": [],
        },
    ]
    mapping = resolve_keys(results)
    assert "BGB" in mapping
    assert mapping["BGB"]["raw_key"] == "BGB"


def test_resolve_keys_year_suffixed():
    results = [
        {
            "raw_key": "BGB2024",
            "title": "BGB",
            "source": "bgb.xml",
            "last_changed": "",
            "norms": [],
        },
    ]
    mapping = resolve_keys(results)
    assert "BGB" in mapping
    assert mapping["BGB"]["raw_key"] == "BGB2024"


def test_resolve_keys_keeps_both_when_conflict():
    results = [
        {
            "raw_key": "BGB",
            "title": "BGB alt",
            "source": "old.xml",
            "last_changed": "",
            "norms": [],
        },
        {
            "raw_key": "BGB2024",
            "title": "BGB new",
            "source": "new.xml",
            "last_changed": "",
            "norms": [],
        },
    ]
    mapping = resolve_keys(results)
    assert len(mapping) == 2


# ---------------------------------------------------------------------------
# convert_xml_to_dict tests
# ---------------------------------------------------------------------------


def test_convert_xml_to_dict_simple_text():
    soup = BeautifulSoup("<tag>simple text</tag>", "lxml-xml")
    result = convert_xml_to_dict(soup)
    assert result == {"tag": "simple text"}


def test_convert_xml_to_dict_nested():
    soup = BeautifulSoup("<parent><child>value</child></parent>", "lxml-xml")
    result = convert_xml_to_dict(soup)
    assert result == {"parent": {"child": "value"}}


def test_convert_xml_to_dict_multiple_children():
    soup = BeautifulSoup("<root><a>1</a><a>2</a></root>", "lxml-xml")
    result = convert_xml_to_dict(soup)
    assert result == {"root": {"a": ["1", "2"]}}


# ---------------------------------------------------------------------------
# _parse_norm tests (basic structure)
# ---------------------------------------------------------------------------


def test_parse_norm_extracts_paragraphs():
    """_parse_norm should extract norm_id, title, and paragraphs."""
    xml = """<?xml version="1.0"?>
    <norm doknr="test">
      <metadaten>
        <enbez>§ 7</enbez>
        <jurabk>BGB</jurabk>
        <titel>Test Norm Title</titel>
      </metadaten>
      <textdaten>
        <text>
          <Content>
            <P>First paragraph text.</P>
            <P>Second paragraph text.</P>
          </Content>
        </text>
      </textdaten>
    </norm>"""
    soup = BeautifulSoup(xml, "lxml-xml")
    law_tag = soup.find("norm")
    output = {"norms": []}
    _parse_norm(law_tag, output, "test.xml", [])

    assert len(output["norms"]) == 1
    norm = output["norms"][0]
    assert norm["norm_id"] == "§ 7"
    assert norm["title"] == "Test Norm Title"
    assert len(norm["paragraphs"]) >= 2


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
