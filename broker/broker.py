"""
German Law Vault — Local Ollama Broker
======================================

A lightweight FastAPI proxy that allows the Next.js frontend to use
a local Ollama instance for AI-powered legal guidance.

Usage:
    pip install fastapi uvicorn httpx
    python broker.py
    # Open http://localhost:9000/health

Required:
    - Ollama running on http://localhost:11434
    - At least one model pulled (default: qwen2.5:1.5b)

Environment:
    OLLAMA_BASE_URL   Ollama endpoint (default: http://localhost:11434)
    BROKER_PORT       Port to listen on (default: 9000)
    DEFAULT_MODEL     Default model (default: qwen2.5:1.5b)
"""

from __future__ import annotations

import json
import os
import sys
from typing import AsyncGenerator

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

app = FastAPI(title="German Law Vault — Local Broker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "qwen2.5:1.5b")
client = httpx.AsyncClient(timeout=120.0)


# ── Helpers ──


def build_ollama_messages(
    message: str,
    context: str = "",
    language: str = "English",
    system_prompt: str = "",
) -> list[dict]:
    system = system_prompt or (
        "You are a precise multilingual German legal expert. "
        "Analyze the provided German law context and answer the user's "
        "question in their language. Cite specific section numbers. "
        "Provide clear practical implications."
    )
    system_with_lang = (
        f"{system}\n\nThe user's language is: {language}. Always respond in {language}."
    )
    messages = [{"role": "system", "content": system_with_lang}]
    if context:
        messages.append(
            {"role": "user", "content": f"Context from German laws:\n{context}"}
        )
    messages.append({"role": "user", "content": message})
    return messages


async def stream_ollama(
    messages: list[dict],
    model: str,
    temperature: float = 0.3,
    top_p: float = 0.9,
    top_k: int = 40,
    max_tokens: int = 1024,
) -> AsyncGenerator[str, None]:
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "num_predict": max_tokens,
        },
    }
    async with httpx.AsyncClient(timeout=120.0) as stream_client:
        async with stream_client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        # SSE format: data: {"response": "..."}
                        yield f"data: {json.dumps({'response': content})}\n\n"
                    if chunk.get("done"):
                        yield f"data: {json.dumps({'done': True})}\n\n"
                        return
                except json.JSONDecodeError:
                    continue


# ── Endpoints ──


@app.get("/health")
async def health():
    """Check broker and Ollama connectivity with detailed diagnostics."""
    try:
        r = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        models = r.json().get("models", [])
        model_names = [m["name"] for m in models]
        # Check if the default model is actually available
        default_available = DEFAULT_MODEL in model_names
        return {
            "status": "ok",
            "ollama": True,
            "broker_version": "1.0",
            "models": model_names,
            "default_model": DEFAULT_MODEL,
            "default_model_available": default_available,
            "model_count": len(model_names),
        }
    except httpx.ConnectError:
        return {
            "status": "error",
            "ollama": False,
            "broker_version": "1.0",
            "detail": "Cannot connect to Ollama. Is it running on "
            + OLLAMA_BASE_URL
            + "?",
            "recommendation": "Start Ollama: ollama serve",
        }
    except Exception as e:
        return {
            "status": "error",
            "ollama": False,
            "broker_version": "1.0",
            "detail": str(e),
        }
        return {
            "status": "degraded",
            "ollama": False,
            "error": str(e),
        }


@app.post("/api/chat")
async def chat(request: Request):
    """Proxy a chat request to Ollama."""
    body = await request.json()
    message = body.get("message", "")
    context = body.get("context", "")
    model = body.get("model") or DEFAULT_MODEL
    language = body.get("language", "English")
    temperature = body.get("temperature", 0.3)
    top_p = body.get("top_p", 0.9)
    top_k = body.get("top_k", 40)
    max_tokens = body.get("max_tokens", 1024)
    system_prompt = body.get("system_prompt", "")
    use_stream = body.get("stream", False)

    if not message:
        return {"error": "No message provided"}

    messages = build_ollama_messages(message, context, language, system_prompt)

    if use_stream:
        return StreamingResponse(
            stream_ollama(messages, model, temperature, top_p, top_k, max_tokens),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming fallback
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "num_predict": max_tokens,
        },
    }
    r = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload)
    r.raise_for_status()
    data = r.json()
    return {"response": data.get("message", {}).get("content", "")}


# ── Startup ──


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("BROKER_PORT", "9000"))
    print(f"Starting broker on http://localhost:{port}")
    print(f"Ollama endpoint: {OLLAMA_BASE_URL}")
    print(f"Default model: {DEFAULT_MODEL}")
    uvicorn.run(app, host="0.0.0.0", port=port)
