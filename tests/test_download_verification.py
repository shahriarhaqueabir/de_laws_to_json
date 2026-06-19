"""
test_download_verification.py — Data source and download integrity verification.

Tests that the TOC URL is reachable, the XML parses correctly, and processed
JSON files (if they exist) have valid structure.

Marked with @pytest.mark.integration — skip by setting SKIP_NETWORK_TESTS=1.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import xml.etree.ElementTree as ET

import pytest
import requests

from download_de_laws import RAW_DIR, TOC_URL

# Skip network tests if env var is set
SKIP_NETWORK = os.environ.get("SKIP_NETWORK_TESTS", "0") == "1"


# ---------------------------------------------------------------------------
# Source reachability tests (network)
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.skipif(SKIP_NETWORK, reason="SKIP_NETWORK_TESTS is set")
def test_toc_url_is_reachable():
    """The TOC URL should respond with a 200 status."""
    resp = requests.head(TOC_URL, timeout=15)
    assert resp.status_code == 200


@pytest.mark.integration
@pytest.mark.skipif(SKIP_NETWORK, reason="SKIP_NETWORK_TESTS is set")
def test_toc_xml_parses_with_valid_entries():
    """The TOC XML should contain law entries with 'item' elements."""
    resp = requests.get(TOC_URL, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    items = root.findall(".//item")
    assert len(items) > 100, f"Expected > 100 laws, got {len(items)}"


@pytest.mark.integration
@pytest.mark.skipif(SKIP_NETWORK, reason="SKIP_NETWORK_TESTS is set")
def test_each_law_entry_has_link_and_name():
    """Each item in the TOC should have 'link' and 'title' elements."""
    resp = requests.get(TOC_URL, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    for item in root.findall(".//item"):
        title = item.find("title")
        link = item.find("link")
        assert title is not None, f"Missing title in item: {ET.tostring(item)}"
        assert link is not None, f"Missing link in item: {ET.tostring(item)}"
        assert title.text, f"Empty title in item"
        assert link.text, f"Empty link in item"


@pytest.mark.integration
@pytest.mark.skipif(SKIP_NETWORK, reason="SKIP_NETWORK_TESTS is set")
def test_law_zip_urls_follow_expected_pattern():
    """Law ZIP URLs should follow https://www.gesetze-im-internet.de/{abbr}/xml.zip."""
    resp = requests.get(TOC_URL, timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    for item in root.findall(".//item"):
        link = item.find("link")
        if link is not None and link.text:
            assert link.text.startswith("https://www.gesetze-im-internet.de/")
            assert link.text.endswith("/xml.zip")


# ---------------------------------------------------------------------------
# Offline verification tests (no network)
# ---------------------------------------------------------------------------


def test_known_law_keys_produce_expected_patterns():
    """Sample law keys (BGB, StGB, GG) should map to expected URL patterns."""
    laws = {
        "BGB": "https://www.gesetze-im-internet.de/bgb/xml.zip",
        "StGB": "https://www.gesetze-im-internet.de/stgb/xml.zip",
        "GG": "https://www.gesetze-im-internet.de/gg/xml.zip",
    }
    for key, expected_url in laws.items():
        inferred = f"https://www.gesetze-im-internet.de/{key.lower()}/xml.zip"
        assert inferred == expected_url


def test_toc_url_constant():
    """TOC_URL constant should not change unexpectedly."""
    assert TOC_URL == "https://www.gesetze-im-internet.de/gii-toc.xml"


# ---------------------------------------------------------------------------
# Local JSON validation (no network)
# ---------------------------------------------------------------------------


def test_processed_json_files_if_exist():
    """If de_federal_json exists, verify JSON files have valid structure."""
    json_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "de_federal_json"
    )
    if not os.path.isdir(json_dir):
        pytest.skip("de_federal_json directory not found")

    json_files = [f for f in os.listdir(json_dir) if f.endswith(".json")]
    assert len(json_files) > 0, "No JSON files found in de_federal_json"

    for fname in json_files[:10]:  # Check up to 10 files
        fpath = os.path.join(json_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Verify expected structure
        assert "key" in data, f"Missing 'key' in {fname}"
        assert "output" in data, f"Missing 'output' in {fname}"
        output = data["output"]
        assert "meta" in output, f"Missing 'meta' in {fname}"
        assert "metadaten" in output, f"Missing 'metadaten' in {fname}"
        assert "norms" in output, f"Missing 'norms' in {fname}"


@pytest.mark.integration
@pytest.mark.skipif(SKIP_NETWORK, reason="SKIP_NETWORK_TESTS is set")
def test_raw_directory_contents():
    """If de_federal_raw exists, it should contain law subdirectories with XML files."""
    raw_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "de_federal_raw"
    )
    if not os.path.isdir(raw_dir):
        pytest.skip("de_federal_raw directory not found")

    law_dirs = [
        d for d in os.listdir(raw_dir) if os.path.isdir(os.path.join(raw_dir, d))
    ]
    assert len(law_dirs) > 0, "No law subdirectories found"

    # Check a few directories for XML files
    checked = 0
    for d in law_dirs[:5]:
        xml_files = [
            f for f in os.listdir(os.path.join(raw_dir, d)) if f.endswith(".xml")
        ]
        assert len(xml_files) > 0, f"No XML files in {d}"
        checked += 1
    assert checked > 0, "No law directories checked"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
