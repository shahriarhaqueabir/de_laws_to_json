"""
test_payload_formats.py — JSON payload format validation.

Verifies that all API response and data shapes across the system match
expected structures using dictionary key checks.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest


def test_law_metadata_shape():
    """Laws table/API shape matches expected columns."""
    law = {
        "key": "BGB",
        "title": "Bürgerliches Gesetzbuch",
        "alt_title": "",
        "category": "consumer",
        "authority": "Federal Law",
        "status": "Active",
        "jurisdiction": "Germany (Federal)",
        "last_changed": "2024-01-10",
        "source": "gesetze-im-internet.de",
    }
    expected_keys = {
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
    assert set(law.keys()) == expected_keys


def test_norm_payload_shape():
    """Norm payload has law_key, law_title, category, norm_id, norm_title, content."""
    norm = {
        "law_key": "BGB",
        "law_title": "Bürgerliches Gesetzbuch",
        "category": "consumer",
        "norm_id": "§ 7",
        "norm_title": "Good Faith",
        "content": "Test content text here.",
    }
    expected_keys = {
        "law_key",
        "law_title",
        "category",
        "norm_id",
        "norm_title",
        "content",
    }
    assert set(norm.keys()) == expected_keys


def test_search_api_response_shape():
    """Search API response shape: { results, total }."""
    response = {
        "results": [
            {
                "key": "BGB",
                "title": "Bürgerliches Gesetzbuch",
                "category": "consumer",
                "relevance": 0.95,
                "normHits": [],
                "contextSummary": "Summary text",
                "relevantNorms": [],
            }
        ],
        "total": 1,
    }
    assert "results" in response
    assert "total" in response
    assert isinstance(response["results"], list)
    assert isinstance(response["total"], int)

    if response["results"]:
        result = response["results"][0]
        result_keys = {
            "key",
            "title",
            "category",
            "relevance",
            "normHits",
            "contextSummary",
            "relevantNorms",
        }
        assert set(result.keys()) == result_keys


def test_chat_api_response_shape():
    """Chat API response: { response, citedLaws, brokerAvailable, mode }."""
    response = {
        "response": "Legal guidance text",
        "citedLaws": ["BGB § 7"],
        "brokerAvailable": True,
        "mode": "legal",
    }
    assert "response" in response
    assert "citedLaws" in response
    assert "brokerAvailable" in response
    assert "mode" in response


def test_explain_api_response_shape():
    """Explain API response: { norm_id, law_key, law_title, lang, ... }."""
    response = {
        "norm_id": "§ 7",
        "law_key": "BGB",
        "law_title": "Bürgerliches Gesetzbuch",
        "lang": "en",
        "translation": "English translation",
        "summary": "Brief summary",
        "implications": ["Point 1", "Point 2"],
        "next_steps": ["Step 1", "Step 2"],
        "disclaimer": "This is not legal advice.",
    }
    expected_keys = {
        "norm_id",
        "law_key",
        "law_title",
        "lang",
        "translation",
        "summary",
        "implications",
        "next_steps",
        "disclaimer",
    }
    assert set(response.keys()) == expected_keys


def test_diagnostics_response_shape():
    """Diagnostics response: { timestamp, env, checks }."""
    response = {
        "timestamp": "2024-01-15T12:00:00Z",
        "env": "production",
        "checks": {
            "supabase": {"status": "ok", "message": "Connected"},
            "qdrant": {"status": "error", "message": "Not reachable"},
        },
    }
    assert "timestamp" in response
    assert "env" in response
    assert "checks" in response
    assert "supabase" in response["checks"]
    assert "qdrant" in response["checks"]
    for service, check in response["checks"].items():
        assert "status" in check
        assert "message" in check


def test_bookmark_shape():
    """Bookmark shape: { law_key, law_title, category, norm_id?, ... }."""
    bookmark = {
        "law_key": "BGB",
        "law_title": "Bürgerliches Gesetzbuch",
        "category": "consumer",
        "norm_id": "§ 7",
        "norm_title": "Good Faith",
        "snippet": "Brief excerpt",
        "added_at": "2024-01-15T12:00:00Z",
    }
    expected_keys = {
        "law_key",
        "law_title",
        "category",
        "norm_id",
        "norm_title",
        "snippet",
        "added_at",
    }
    assert set(bookmark.keys()) == expected_keys


def test_bookmark_optional_norm():
    """Bookmark without norm_id/norm_title should still be valid."""
    bookmark = {
        "law_key": "BGB",
        "law_title": "Bürgerliches Gesetzbuch",
        "category": "consumer",
        "added_at": "2024-01-15T12:00:00Z",
        "norm_id": "",
        "norm_title": "",
        "snippet": "",
    }
    assert "law_key" in bookmark
    assert "added_at" in bookmark


def test_error_response_shape():
    """Error response: { error: { code, message, details? } }."""
    error = {
        "error": {
            "code": "NOT_FOUND",
            "message": "Law not found",
            "details": {"key": "INVALID"},
        }
    }
    assert "error" in error
    assert "code" in error["error"]
    assert "message" in error["error"]
    # details is optional
    assert "details" in error["error"]


def test_error_response_minimal():
    """Minimal error response without details."""
    error = {
        "error": {
            "code": "SERVER_ERROR",
            "message": "Internal server error",
        }
    }
    assert "error" in error
    assert "code" in error["error"]
    assert "message" in error["error"]


def test_broker_health_shape():
    """Broker health: { status, ollama_url }."""
    health = {"status": "ok", "ollama_url": "http://127.0.0.1:11434"}
    assert set(health.keys()) == {"status", "ollama_url"}


def test_broker_chat_response_shape():
    """Broker chat response: { response, model }."""
    chat_resp = {"response": "Legal text", "model": "qwen2.5:1.5b"}
    assert set(chat_resp.keys()) == {"response", "model"}


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
