"""Seed norms from SQLite into Qdrant with pre-computed E5-small embeddings.

Generates 384-dim vectors locally using sentence-transformers and
intfloat/multilingual-e5-small, then uploads with proper "passage:" prefix.

Features:
- Disk caching of vectors to .npy file (avoids 3h re-encoding if upload fails)
- Small batch upload with retry for Qdrant Cloud free tier
- Deterministic UUID v5 point IDs for idempotency
- Verification at end
"""

import os
import sqlite3
import time
import uuid

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
BATCH_SIZE = 20  # small batches to avoid read timeouts on free tier
EMBED_BATCH_SIZE = 32
MAX_RETRIES = 5
RETRY_DELAY_SEC = 10
CACHE_PATH = os.path.join(os.path.dirname(__file__), "norms_vectors.npy")

if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    exit(1)

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=120)


def seed_db():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "laws.db")
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    print("Fetching norms from SQLite...")
    cur.execute("""
        SELECT l.key as law_key, l.title as law_title,
               n.norm_id, n.title as norm_title, n.content, l.category
        FROM norms n
        JOIN laws l ON n.law_id = l.id
    """)
    rows = cur.fetchall()
    print(f"Loaded {len(rows)} norms from SQLite.")

    # ── 1. Build list of (point_id, payload, content_for_embedding) ──────────
    norms = []
    content_texts = []
    for row in rows:
        norm = dict(row)
        point_id = str(
            uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"german-norm:{norm['law_key']}:{norm['norm_id']}",
            )
        )
        payload = {
            "law_key": norm["law_key"],
            "law_title": norm["law_title"],
            "category": norm["category"] if norm.get("category") else "other",
            "norm_id": norm["norm_id"],
            "norm_title": norm["norm_title"],
            "content": norm["content"][:16384],
        }
        # E5 requires "passage: " prefix for document-side embeddings
        passage_text = "passage: " + norm["content"][:4096]
        norms.append((point_id, payload))
        content_texts.append(passage_text)

    del rows  # free SQLite memory

    # ── 2. Load or generate vectors ──────────────────────────────────────────
    if os.path.exists(CACHE_PATH):
        print(f"Loading cached vectors from {CACHE_PATH}...")
        all_vectors = np.load(CACHE_PATH)
        print(f"Loaded {len(all_vectors)} cached vectors.")
    else:
        print("Loading intfloat/multilingual-e5-small model...")
        t0 = time.time()
        model = SentenceTransformer("intfloat/multilingual-e5-small")
        print(f"Model loaded in {time.time() - t0:.1f}s")

        print(f"Generating {len(content_texts)} embeddings...")
        t0 = time.time()
        all_vectors: list[np.ndarray] = []
        for i in tqdm(range(0, len(content_texts), EMBED_BATCH_SIZE)):
            batch_texts = content_texts[i : i + EMBED_BATCH_SIZE]
            vecs = model.encode(batch_texts, show_progress_bar=False)
            all_vectors.extend(vecs)
        all_vectors = np.array(all_vectors)
        gen_time = time.time() - t0
        print(
            f"Generated {len(all_vectors)} vectors in {gen_time:.1f}s "
            f"({gen_time / len(all_vectors) * 1000:.1f}ms each)"
        )

        # Save cache
        print(f"Saving vectors to {CACHE_PATH}...")
        np.save(CACHE_PATH, all_vectors)
        print("Cache saved.")

    # ── 3. Build PointStructs with actual vectors ──────────────────────────
    print("Building PointStructs...")
    points = []
    for (point_id, payload), vector in zip(norms, all_vectors):
        points.append(
            PointStruct(
                id=point_id,
                payload=payload,
                vector=vector.tolist(),  # 384-dim float32 list
            )
        )

    # Free memory before upload
    del norms, all_vectors, content_texts

    # ── 4. Check how many points already exist ─────────────────────────────
    try:
        existing = client.get_collection("german_norms")
        existing_count = existing.points_count
        print(f"Collection currently has {existing_count} points.")
    except Exception:
        existing_count = 0

    # ── 5. Upsert in batches with retry ───────────────────────────────────
    print(f"Uploading {len(points)} points in batches of {BATCH_SIZE}...")
    t0 = time.time()
    total_uploaded = 0
    failed_batches = 0
    for i in tqdm(range(0, len(points), BATCH_SIZE)):
        batch = points[i : i + BATCH_SIZE]
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                client.upsert(
                    collection_name="german_norms",
                    points=batch,
                    wait=False,
                )
                total_uploaded += len(batch)
                break
            except Exception as exc:
                if attempt < MAX_RETRIES:
                    print(
                        f"\nRetry {attempt}/{MAX_RETRIES} for batch "
                        f"{i // BATCH_SIZE + 1}: {exc}"
                    )
                    time.sleep(RETRY_DELAY_SEC)
                else:
                    print(
                        f"\nFailed batch {i // BATCH_SIZE + 1} "
                        f"after {MAX_RETRIES} attempts"
                    )
                    failed_batches += 1
    upload_time = time.time() - t0
    print(
        f"Uploaded {total_uploaded}/{len(points)} points "
        f"({failed_batches} failed batches) in {upload_time:.1f}s."
    )

    # ── 6. Wait for indexing and verify ─────────────────────────────────────
    print("\nWaiting 30s for Qdrant to index...")
    time.sleep(30)

    info = client.get_collection("german_norms")
    print(f"Collection: green={info.status == 'green'}")
    print(f"Points:      {info.points_count}")
    print(f"Indexed vec: {info.indexed_vectors_count}")

    if info.indexed_vectors_count > 0:
        print("\n✓ Vectors are indexed! Search should work.")
    else:
        print("\n⚠ Vectors not yet indexed. Wait longer or check collection.")


if __name__ == "__main__":
    seed_db()
