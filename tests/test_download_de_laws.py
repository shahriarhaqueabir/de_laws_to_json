"""
test_download_de_laws.py — Tests for the law download pipeline.

Mocks requests.Session to test HTTP logic without actually downloading
6000+ laws from gesetze-im-internet.de.
"""

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, PropertyMock, patch

import pytest
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from download_de_laws import (
    DOWNLOAD_TIMEOUT,
    MAX_RETRIES,
    RAW_DIR,
    TOC_TIMEOUT,
    TOC_URL,
    _make_session,
    _safe_dir_name,
    process_law,
    process_with_delay,
)


def test_safe_dir_name_extracts_correct_name():
    """Should extract the law abbreviation from the URL path."""
    url = "https://www.gesetze-im-internet.de/bgb/xml.zip"
    assert _safe_dir_name(url) == "bgb"


def test_safe_dir_name_handles_trailing_slash():
    """Trailing slash should not affect extraction."""
    url = "https://www.gesetze-im-internet.de/stgb/xml.zip/"
    assert _safe_dir_name(url) == "stgb"


def test_safe_dir_name_sanitizes_special_chars():
    """Special characters should be replaced with underscores."""
    url = "https://www.gesetze-im-internet.de/abk.+e.f./xml.zip"
    result = _safe_dir_name(url)
    assert all(c in "abcdefghijklmnopqrstuvwxyz0123456789_-" for c in result)


def test_make_session_has_correct_retry_config():
    """Session should have retry strategy with max_retries=3 and correct status_forcelist."""
    session = _make_session()
    adapter = session.get_adapter("https://")
    assert hasattr(adapter, "max_retries")
    retry = adapter.max_retries
    assert retry.total == MAX_RETRIES
    assert retry.total == 3
    assert 429 in retry.status_forcelist
    assert 500 in retry.status_forcelist
    assert 502 in retry.status_forcelist
    assert 503 in retry.status_forcelist
    assert 504 in retry.status_forcelist


def test_make_session_https_and_http_mounted():
    """Session should have adapters mounted for https and http."""
    session = _make_session()
    assert session.get_adapter("https://example.com") is not None
    assert session.get_adapter("http://example.com") is not None


def test_toc_url_is_correct():
    """TOC URL should point to the gesetze-im-internet.de index."""
    assert TOC_URL == "https://www.gesetze-im-internet.de/gii-toc.xml"


def test_download_timeout_is_90_seconds():
    """DOWNLOAD_TIMEOUT should be set to 90 seconds."""
    assert DOWNLOAD_TIMEOUT == 90


def test_toc_timeout_is_15_seconds():
    """TOC_TIMEOUT should be set to 15 seconds."""
    assert TOC_TIMEOUT == 15


def test_process_law_downloads_and_extracts(tmp_path):
    """process_law should download a ZIP and extract XML files."""
    # Create a valid ZIP in memory with an XML file inside
    import io
    import zipfile

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zf:
        zf.writestr(
            "law.xml",
            "<root><item><title>Test</title><link>http://test</link></item></root>",
        )
    zip_buffer.seek(0)

    mock_response = MagicMock()
    mock_response.iter_content.return_value = [zip_buffer.read()]
    mock_response.raise_for_status.return_value = None

    mock_session = MagicMock()
    mock_session.get.return_value = mock_response

    with patch("download_de_laws.RAW_DIR", str(tmp_path)):
        with patch("download_de_laws._make_session", return_value=mock_session):
            success, msg = process_law(
                {"link": "https://www.gesetze-im-internet.de/bgb/xml.zip"}
            )

            assert success is True
            # The ZIP should have been cleaned up
            zip_files = list(tmp_path.rglob("*.zip"))
            assert len(zip_files) == 0
            # XML should exist
            xml_files = list(tmp_path.rglob("*.xml"))
            assert len(xml_files) > 0


def test_process_law_handles_http_failure(tmp_path):
    """Should return False tuple when HTTP request fails."""
    mock_session = MagicMock()
    mock_session.get.side_effect = Exception("Connection error")

    with patch("download_de_laws.RAW_DIR", str(tmp_path)):
        with patch("download_de_laws._make_session", return_value=mock_session):
            success, msg = process_law(
                {"link": "https://www.gesetze-im-internet.de/bgb/xml.zip"}
            )
            assert success is False
            assert "Error" in msg


def test_process_law_handles_404(tmp_path):
    """Should handle 404 responses gracefully."""
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = Exception("404 Client Error")

    mock_session = MagicMock()
    mock_session.get.return_value = mock_response

    with patch("download_de_laws.RAW_DIR", str(tmp_path)):
        with patch("download_de_laws._make_session", return_value=mock_session):
            success, msg = process_law(
                {"link": "https://www.gesetze-im-internet.de/nonexistent/xml.zip"}
            )
            assert success is False


def test_process_with_delay_adds_pause():
    """process_with_delay should call process_law after a brief delay."""
    mock_law = {"link": "https://test.example/xml.zip", "title": "Test"}
    with patch("download_de_laws.process_law", return_value=(True, "ok")):
        with patch("time.sleep") as mock_sleep:
            result = process_with_delay(mock_law)
            mock_sleep.assert_called_once_with(0.15)
            assert result == (True, "ok")


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
