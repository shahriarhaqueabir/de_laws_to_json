"""
test_broker.py — Tests for the FastAPI broker app.

Uses httpx.AsyncClient with ASGITransport to test the FastAPI app
without running a live server. Ollama HTTP calls are mocked.
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from broker.broker import OLLAMA_URL, ChatRequest, ChatResponse, app


class _MockAsyncClient:
    """Mock that replaces httpx.AsyncClient for testing.

    Supports both regular .post() and .stream() calls.
    """

    def __init__(self, **kwargs):
        self.post_handler = None
        self.stream_handler = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def get(self, url, **kwargs):
        """Default get — returns an empty list of models."""
        return _FakeResponse(200, {"models": []})

    async def post(self, url, **kwargs):
        """Delegates to the test-configured post_handler."""
        if self.post_handler is not None:
            return await self.post_handler(url, **kwargs)
        return _FakeResponse(200, {"response": "", "model": "default"})

    def stream(self, method, url, **kwargs):
        """Return a mock streaming context manager."""
        if self.stream_handler is not None:
            return self.stream_handler(method, url, **kwargs)
        # Default: return a stream that yields nothing
        return _FakeStreamContextManager([])


class _FakeStreamContextManager:
    """Simulates an httpx streaming response context manager."""

    def __init__(self, lines):
        self._lines = lines
        self.status_code = 200

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def raise_for_status(self):
        pass

    async def aiter_lines(self):
        for line in self._lines:
            yield line


class _FakeResponse:
    """Simulates an httpx.Response."""

    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")


@pytest.fixture
def client():
    """Yield an ASGI test client for the broker app."""
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ollama_url" in data
    assert data["ollama_url"] == OLLAMA_URL


@pytest.mark.asyncio
async def test_list_models_proxies_to_ollama(client):
    fake_tags = {"models": [{"name": "qwen2.5:1.5b"}]}

    async def mock_get(url, **kwargs):
        return _FakeResponse(200, fake_tags)

    def make_mock_client(**kwargs):
        c = _MockAsyncClient(**kwargs)
        c.get = mock_get
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        resp = await client.get("/api/tags")
        assert resp.status_code == 200
        data = resp.json()
        assert data == fake_tags


@pytest.mark.asyncio
async def test_chat_valid_request_returns_response(client):
    fake_ollama_response = {"response": "Legal guidance text here."}

    async def mock_post(url, **kwargs):
        return _FakeResponse(200, fake_ollama_response)

    def make_mock_client(**kwargs):
        c = _MockAsyncClient(**kwargs)
        c.post_handler = mock_post
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        resp = await client.post(
            "/api/chat",
            json={"message": "What does BGB say about contracts?"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["response"] == "Legal guidance text here."
        assert data["model"] == "qwen2.5:1.5b"


@pytest.mark.asyncio
async def test_chat_language_injection(client):
    """System prompt should include the requested language."""
    captured_payload = {}

    async def capture_post(url, **kwargs):
        captured_payload.update(kwargs.get("json", {}))
        return _FakeResponse(200, {"response": "Antwort auf Deutsch."})

    def make_mock_client(**kwargs):
        c = _MockAsyncClient(**kwargs)
        c.post_handler = capture_post
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        await client.post(
            "/api/chat",
            json={"message": "Hilfe", "language": "German"},
        )
    prompt_text = captured_payload.get("prompt", "")
    assert "German" in prompt_text
    assert "Always respond in German" in prompt_text


@pytest.mark.asyncio
async def test_chat_custom_system_prompt_merged_with_language(client):
    """Custom system_prompt should appear alongside language instruction."""
    captured_payload = {}

    async def capture_post(url, **kwargs):
        captured_payload.update(kwargs.get("json", {}))
        return _FakeResponse(200, {"response": "Custom guidance."})

    def make_mock_client(**kwargs):
        c = _MockAsyncClient(**kwargs)
        c.post_handler = capture_post
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        await client.post(
            "/api/chat",
            json={
                "message": "Help",
                "system_prompt": "You are a German law expert.",
                "language": "English",
            },
        )
    prompt_text = captured_payload.get("prompt", "")
    assert "German law expert" in prompt_text
    assert "English" in prompt_text


@pytest.mark.asyncio
async def test_chat_ollama_offline_returns_503(client):
    def make_mock_client(**kwargs):
        c = _MockAsyncClient(**kwargs)

        async def raise_error(url, **kwargs):
            raise Exception("Connection refused")

        c.post_handler = raise_error
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        resp = await client.post(
            "/api/chat",
            json={"message": "Test message"},
        )
        assert resp.status_code == 503
        data = resp.json()
        assert "detail" in data
        assert "unavailable" in data["detail"].lower()


@pytest.mark.asyncio
async def test_chat_validation_empty_message(client):
    resp = await client.post("/api/chat", json={"message": ""})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_chat_validation_message_too_long(client):
    long_msg = "x" * 4001
    resp = await client.post("/api/chat", json={"message": long_msg})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_chat_validation_temperature_out_of_range(client):
    resp = await client.post(
        "/api/chat",
        json={"message": "test", "temperature": 5.0},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_chat_streaming_returns_sse(client):
    """Streaming request returns SSE events with response chunks."""
    fake_chunks = [
        {"response": "Legal ", "done": False},
        {"response": "guidance ", "done": False},
        {"response": "here.", "done": True},
    ]
    fake_lines = [json.dumps(c) for c in fake_chunks]

    def make_mock_client(**kwargs):
        c = _MockAsyncClient(**kwargs)
        c.stream_handler = lambda method, url, **kwargs: _FakeStreamContextManager(
            fake_lines
        )
        return c

    with patch("httpx.AsyncClient", side_effect=make_mock_client):
        resp = await client.post(
            "/api/chat",
            json={"message": "Test streaming", "stream": True},
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

        body = await resp.aread()
        text = body.decode()
        assert "data: " in text
        assert '{"response": "Legal "}' in text
        assert '{"response": "guidance "}' in text
        assert '{"response": "here."}' in text


@pytest.mark.asyncio
async def test_cors_headers_include_localhost_3000(client):
    resp = await client.options(
        "/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    # CORS preflight should respond with appropriate headers
    assert "access-control-allow-origin" in resp.headers
    origin = resp.headers["access-control-allow-origin"]
    assert "localhost:3000" in origin or origin == "*"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
