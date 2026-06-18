"""
Local broker — bridges the Next.js app to a local Ollama instance.
Serves as an optional AI guidance layer.

Usage:
    pip install -r requirements.txt
    python broker.py
    # Server starts on http://localhost:9000
"""

import logging
import os
from typing import Optional

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    allow_headers=["*"],
)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    context: str = Field(default="")
    conversationId: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    model: str = OLLAMA_MODEL


LEGAL_DISCLAIMER = (
    "\n\n---\n"
    "*This guidance is based on mathematical reasoning applied to legal text. "
    "It is **not legally binding advice**. Consult a licensed attorney for your specific situation.*"
)

SYSTEM_PROMPT = """You are a German law assistant. Your role is to:
1. Read the user's situation carefully.
2. Search through the provided legal context from German federal laws.
3. Explain which laws and paragraphs are relevant.
4. Apply logical reasoning to explain how the law likely applies.
5. Always respond in the user's language (German or English).
6. Cite specific law keys and section numbers.
"""


@app.get("/health")
async def health():
    """Health check — called by the frontend to detect broker availability."""
    return {"status": "ok", "model": OLLAMA_MODEL}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Forward a chat request to Ollama with legal context."""
    user_prompt = f"""Context from German laws:
{req.context or "(No specific laws found)"}

User situation:
{req.message}

Provide guidance based on the relevant laws above. Include citations."""

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM_PROMPT}\n\n{user_prompt}",
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            response_text = data.get("response", "").strip() + LEGAL_DISCLAIMER
            return ChatResponse(response=response_text)
    except Exception as e:
        logger.error("Ollama request failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Ollama unavailable: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9090)
