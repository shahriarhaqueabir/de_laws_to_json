"""
Local broker — bridges the Next.js app to a local Ollama instance.
Serves as an optional AI guidance layer.

Usage:
    pip install -r requirements.txt
    python broker.py
    # Server starts on http://localhost:9000
"""

import asyncio
import json
import logging
import os
from typing import Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("broker")

app = FastAPI(title="German Law Vault Broker")

# Allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        os.environ.get("CORS_ORIGIN", ""),
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context: str = Field(default="")
    conversationId: Optional[str] = None
    model: str = Field(default="qwen2.5:1.5b")
    language: str = Field(default="English")
    temperature: float = Field(default=0.3, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=40, ge=0)
    max_tokens: int = Field(default=1024, ge=1, le=4096)
    system_prompt: Optional[str] = None
    stream: bool = Field(default=False)


class ChatResponse(BaseModel):
    response: str
    model: str


@app.get("/health")
async def health():
    """Health check — called by the frontend to detect broker availability."""
    return {"status": "ok", "ollama_url": OLLAMA_URL}


@app.get("/api/tags")
async def list_models():
    """Proxy Ollama's /api/tags to list available models."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{OLLAMA_URL}/api/tags")
        resp.raise_for_status()
        return resp.json()


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """Forward a chat request to Ollama with legal context.

    When stream=True, returns a Server-Sent Events stream of response chunks.
    When stream=False, returns the complete response as JSON.
    """
    user_prompt = f"""Context from German laws:
{req.context or "(No specific laws found)"}

User situation:
{req.message}

Provide guidance based on the relevant laws above. Include citations."""

    system = (
        req.system_prompt
        or "You are a multilingual German legal assistant. Always respond in the user's language."
    )
    # Inject language into the system prompt
    system = (
        system
        + f"\n\nThe user's language is: {req.language}. Always respond in {req.language}."
    )

    payload = {
        "model": req.model,
        "prompt": f"{system}\n\n{user_prompt}",
        "stream": req.stream,
        "options": {
            "temperature": req.temperature,
            "top_p": req.top_p,
            "top_k": req.top_k,
            "num_predict": req.max_tokens,
        },
    }

    try:
        client = httpx.AsyncClient(timeout=120.0)

        if req.stream:
            async with client:
                return StreamingResponse(
                    _stream_ollama_response(client, payload),
                    media_type="text/event-stream",
                )

        # Non-streaming: get full response
        async with client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            response_text = data.get("response", "").strip()
            return ChatResponse(response=response_text, model=req.model)
    except Exception as e:
        logger.error("Ollama request failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Ollama unavailable: {str(e)}")


async def _stream_ollama_response(client, payload):
    """Stream Ollama response as SSE events.

    Ollama returns NDJSON lines when stream=True.
    Each line: {"response": "text chunk", "done": false}
    We wrap these as SSE data events for the frontend.

    The caller is responsible for entering the client context.
    Detects client disconnects by checking for CancelledError.
    """
    try:
        async with client.stream(
            "POST", f"{OLLAMA_URL}/api/generate", json=payload
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        if "response" in chunk:
                            yield f"data: {json.dumps({'response': chunk['response']})}\n\n"
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
    except asyncio.CancelledError:
        logger.info("Streaming client disconnected, cleaning up")
        return
    except Exception:
        logger.exception("Streaming error")
        yield f"data: {json.dumps({'error': 'Streaming error'})}\n\n"


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9000)
