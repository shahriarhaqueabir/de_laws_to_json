"""
vector_search.py — Vector embedding generation and similarity re-ranking for Phase 2.

Tries embedded_models in order (default: nomic-embed-text).
"""

import os
import time
import sqlite3
import urllib.request
import urllib.error
import json
import logging
import numpy as np
from typing import List, Dict, Tuple, Optional

from database.db import get_connection, get_db
import math

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
EMBEDDING_MODELS = [
    m.strip() for m in os.environ.get(
        "EMBEDDING_MODEL", "nomic-embed-text"
    ).split(",") if m.strip()
]
# nomic-embed-text native context = 2048 tokens. German text ~3-4 chars/token.
# 1500 chars ≈ 400-500 tokens, well within limit.
MAX_EMBED_CHARS = int(os.environ.get("MAX_EMBED_CHARS", "1500"))

logger = logging.getLogger("vector_search")
logger.setLevel(logging.INFO)


def _try_model(text: str, model: str) -> Optional[np.ndarray]:
    """Try a single model on both Ollama embedding endpoints. Returns None if both fail."""
    timeout = 60 if "nomic" not in model else 10  # Larger models need more time to load

    chars = len(text)
    token_estimate = max(1, math.ceil(chars / 3))  # conservative ~3 chars/token for German
    logger.info("Embedding request: model=%s chars=%d est_tokens=%d", model, chars, token_estimate)

    # Try the newer /api/embed endpoint first (Ollama >= 0.3.0)
    try:
        payload = {"model": model, "input": text}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/embed",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            embeddings = resp_data.get("embeddings")
            if embeddings and len(embeddings) > 0:
                return np.array(embeddings[0], dtype=np.float32)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        logger.warning("Model %s /api/embed HTTP %d (chars=%d): %s", model, e.code, chars, body)
    except Exception as e:
        logger.warning("Model %s /api/embed error (chars=%d): %s", model, chars, e)

    # Fall back to the older /api/embeddings endpoint
    try:
        payload = {"model": model, "prompt": text}
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/embeddings",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            embedding = resp_data.get("embedding")
            if embedding:
                return np.array(embedding, dtype=np.float32)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        logger.warning("Model %s /api/embeddings HTTP %d (chars=%d): %s", model, e.code, chars, body)
    except Exception as e:
        logger.warning("Model %s /api/embeddings error (chars=%d): %s", model, chars, e)

    return None


def get_embedding(text: str) -> Optional[np.ndarray]:
    """
    Call Ollama's embedding endpoint to get the vector for the given text.
    Retries up to 3 times per model, falling through EMBEDDING_MODELS on failure.
    """
    if not text.strip():
        return None

    for attempt in range(3):
        for model in EMBEDDING_MODELS:
            result = _try_model(text, model)
            if result is not None:
                return result
        if attempt < 2:
            logger.warning(f"Embedding attempt {attempt + 1}/3 failed across all models for: {text[:80]}")
            time.sleep(2 ** attempt)

    logger.warning(f"All 3 embedding attempts failed across all models for: {text[:80]}")
    return None


def get_embeddings_batch(texts: List[str]) -> List[Optional[np.ndarray]]:
    """
    Get embeddings for multiple texts. Tries batch endpoint with each model,
    then falls back to individual get_embedding calls per text.
    """
    if not texts:
        return []

    for model in EMBEDDING_MODELS:
        total_chars = sum(len(t) for t in texts)
        logger.info("Batch request: batch_size=%d total_chars=%d model=%s", len(texts), total_chars, model)
        try:
            payload = {"model": model, "input": texts}
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                f"{OLLAMA_URL}/api/embed",
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            timeout = 60 if "nomic" not in model else 30
            with urllib.request.urlopen(req, timeout=timeout) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                embeddings = resp_data.get("embeddings")
                if embeddings and len(embeddings) == len(texts):
                    return [np.array(e, dtype=np.float32) for e in embeddings]
        except Exception:
            pass

    return [get_embedding(t) for t in texts]


def embed_all_norms(batch_size: int = 50) -> None:
    """
    Query all norms where embedding IS NULL, fetch their embeddings, and save back to SQLite.
    """
    conn = get_connection()
    try:
        # Find norms lacking embeddings
        unembedded = conn.execute(
            "SELECT id, title, content FROM norms WHERE embedding IS NULL"
        ).fetchall()
        
        if not unembedded:
            logger.info("All norms already have embeddings.")
            return
            
        logger.info(f"Generating embeddings for {len(unembedded)} norms...")
        
        embedded_count = 0
        total = len(unembedded)
        
        # Process in batches
        for i in range(0, total, batch_size):
            batch = unembedded[i:i + batch_size]
            batch_texts = []
            for row in batch:
                text = f"{row['title']}\n{row['content']}".strip()
                if len(text) > MAX_EMBED_CHARS:
                    text = text[:MAX_EMBED_CHARS]
                    logger.debug("Truncated norm %d to %d chars", row["id"], MAX_EMBED_CHARS)
                batch_texts.append(text)
                
            embeddings = get_embeddings_batch(batch_texts)
            
            # Save to database
            batch_ok = 0
            for row, emb in zip(batch, embeddings):
                if emb is not None:
                    emb_bytes = emb.tobytes()
                    conn.execute(
                        "UPDATE norms SET embedding = ? WHERE id = ?",
                        (emb_bytes, row["id"])
                    )
                    batch_ok += 1
                else:
                    logger.debug("Skipping norm %d (embedding failed)", row["id"])
            conn.commit()
            embedded_count += batch_ok
            if max(1, batch_ok) < len(batch):
                logger.warning("Batch %d: embedded %d/%d norms (HTTP errors)", i // batch_size + 1, batch_ok, len(batch))
            if embedded_count % (batch_size * 4) == 0 or embedded_count == total:
                logger.info(f"Embedded {embedded_count}/{total} norms ({(embedded_count / total) * 100:.0f}%)")
    except Exception as e:
        logger.error(f"Failed to embed norms: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

    if embedded_count < total:
        logger.warning("Embedding complete: %d/%d norms embedded (%d skipped)", embedded_count, total, total - embedded_count)
    else:
        logger.info("Embedding complete: all %d norms embedded successfully.", total)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two 1-D numpy arrays."""
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def vector_rerank(query: str, candidate_norm_ids: List[int], top_k: int = 20) -> List[Tuple[int, float]]:
    """
    Embed the query string, retrieve embeddings for candidate norm IDs, compute cosine similarity,
    and return the top k sorted by similarity score.
    """
    if not candidate_norm_ids:
        return []
        
    query_emb = get_embedding(query)
    if query_emb is None:
        logger.warning("Could not get query embedding; vector re-ranking skipped.")
        return []
        
    results = []
    with get_db() as conn:
        # Load candidate embeddings
        placeholders = ",".join("?" for _ in candidate_norm_ids)
        rows = conn.execute(
            f"SELECT id, embedding FROM norms WHERE id IN ({placeholders}) AND embedding IS NOT NULL",
            candidate_norm_ids
        ).fetchall()
        
        for row in rows:
            norm_id = row["id"]
            emb_bytes = row["embedding"]
            emb = np.frombuffer(emb_bytes, dtype=np.float32)
            
            # If the embedding sizes don't match (e.g. invalid bytes), skip
            if len(emb) != len(query_emb):
                continue
                
            score = cosine_similarity(query_emb, emb)
            results.append((norm_id, score))
            
    # Sort descending by score
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]
