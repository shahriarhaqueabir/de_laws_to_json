"""Re-index Qdrant collection from existing points.

Scrolls all existing points from Qdrant, regenerates embeddings with
E5-small "passage:" prefix + law context, and upserts back.

No SQLite (laws.db) dependency — reads source data directly from Qdrant.

Usage:
    python scripts/reindex_qdrant.py

Requires env vars:
    QDRANT_URL, QDRANT_API_KEY
"""

import json
import os
import sys
import time
import uuid

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

# ── Configuration ──────────────────────────────────────────────────────────────

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
COLLECTION = os.environ.get("COLLECTION", "german_norms")
SCROLL_BATCH = 100        # points per scroll request
UPSERT_BATCH = 20         # points per upsert (free tier timeouts)
EMBED_BATCH = 32          # texts per model.encode() call
MAX_RETRIES = 5
RETRY_DELAY_SEC = 10
CACHE_PATH = os.path.join(os.path.dirname(__file__), "norms_vectors.npy")
STATUS_PATH = os.path.join(os.path.dirname(__file__), "_reindex_status.json")


def write_status(phase: str, progress_pct: float, detail: str):
    """Write progress to JSON file for external monitoring."""
    status = {
        "phase": phase,
        "progress_pct": round(progress_pct, 1),
        "detail": detail,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    with open(STATUS_PATH, "w") as f:
        json.dump(status, f)
    print(f"  [{phase}] {detail}")


def main():
    if not QDRANT_URL or not QDRANT_API_KEY:
        print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
        sys.exit(1)

    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=120)

    # ── Phase 1: Scroll all existing points ─────────────────────────────────
    print("=" * 60)
    print("Phase 1/5: Scrolling all points from Qdrant...")
    print("=" * 60)
    write_status("scrolling", 0, "Starting scroll")

    all_points = []
    next_offset = None
    while True:
        batch = client.scroll(
            collection_name=COLLECTION,
            limit=SCROLL_BATCH,
            offset=next_offset,
            with_payload=True,
            with_vectors=False,
        )
        points, next_offset = batch
        all_points.extend(points)
        if next_offset is None or not points:
            break
        if len(all_points) % 5000 == 0:
            write_status(
                "scrolling",
                min(99, len(all_points) / 120000 * 100),
                f"{len(all_points)} points scrolled so far",
            )

    print(f"\nScrolled {len(all_points)} points total.")
    if not all_points:
        print("No points found. Nothing to re-index.")
        sys.exit(0)

    # ── Phase 2: Build passage texts from payloads ──────────────────────────
    print("\n" + "=" * 60)
    print("Phase 2/5: Building passage texts from payloads...")
    print("=" * 60)

    norms = []  # list of (point_id, payload)
    content_texts = []
    for pt in all_points:
        payload = pt.payload or {}
        point_id = str(
            uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"german-norm:{payload.get('law_key','')}:{payload.get('norm_id','')}",
            )
        )
        # Build passage text with law context (matching E5-small "passage:" prefix)
        law_title = payload.get("law_title", "") or ""
        norm_title = payload.get("norm_title", "") or ""
        content = payload.get("content", "") or ""
        category = payload.get("category", "") or ""

        passage = (
            "passage: "
            + (law_title + ". " if law_title else "")
            + (norm_title + ". " if norm_title else "")
            + content[:4000]
        )
        norms.append(
            (
                point_id,
                {
                    "law_key": payload.get("law_key", ""),
                    "law_title": law_title,
                    "category": category,
                    "norm_id": payload.get("norm_id", ""),
                    "norm_title": norm_title,
                    "content": content[:16384],
                },
            )
        )
        content_texts.append(passage)

    print(f"Built {len(norms)} passage texts.")

    # ── Phase 3: Load model and generate embeddings ────────────────────────
    print("\n" + "=" * 60)
    print("Phase 3/5: Generating embeddings...")
    print("=" * 60)

    if os.path.exists(CACHE_PATH):
        print(f"Loading cached vectors from {CACHE_PATH}...")
        all_vectors = np.load(CACHE_PATH)
        write_status("cached", 100, f"Loaded {len(all_vectors)} cached vectors")
        print(f"Loaded {len(all_vectors)} cached vectors.")
        if len(all_vectors) != len(content_texts):
            print(
                f"WARNING: Cache has {len(all_vectors)} vectors "
                f"but {len(content_texts)} texts. Regenerating."
            )
            all_vectors = None

    if not os.path.exists(CACHE_PATH) or all_vectors is None:
        print("Loading intfloat/multilingual-e5-small model...")
        write_status("loading_model", 0, "Downloading/loading E5-small model")
        t0 = time.time()
        model = SentenceTransformer("intfloat/multilingual-e5-small")
        print(f"Model loaded in {time.time() - t0:.1f}s")

        total = len(content_texts)
        total_batches = (total + EMBED_BATCH - 1) // EMBED_BATCH
        print(f"Generating {total} embeddings ({total_batches} batches)...")
        t0 = time.time()
        all_vectors = []
        for i in tqdm(range(0, total, EMBED_BATCH)):
            batch_texts = content_texts[i : i + EMBED_BATCH]
            vecs = model.encode(batch_texts, show_progress_bar=False, normalize_embeddings=True)
            all_vectors.extend(vecs)
            n_enc = len(all_vectors)
            pct = n_enc / total * 100
            elapsed = time.time() - t0
            rate = n_enc / elapsed if elapsed > 0 else 0
            if i % max(1, total_batches // 20) == 0:
                write_status(
                    "encoding",
                    pct,
                    f"{n_enc}/{total} texts | {rate:.0f} texts/s | "
                    f"batch {i // EMBED_BATCH}/{total_batches}",
                )

        all_vectors = np.array(all_vectors, dtype=np.float32)
        gen_time = time.time() - t0
        write_status("encoding_done", 100, f"{len(all_vectors)} vectors in {gen_time:.1f}s")
        print(f"\nGenerated {len(all_vectors)} vectors in {gen_time:.1f}s "
              f"({gen_time / total * 1000:.1f}ms each)")

        # Save cache
        print(f"\nSaving vectors to {CACHE_PATH}...")
        np.save(CACHE_PATH, all_vectors)
        print("Cache saved.")

    # ── Phase 4: Build PointStructs ─────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Phase 4/5: Building PointStructs for upload...")
    print("=" * 60)

    points = []
    for (point_id, payload), vector in zip(norms, all_vectors):
        points.append(
            PointStruct(
                id=point_id,
                payload=payload,
                vector=vector.tolist(),
            )
        )

    # Free memory
    del norms, all_vectors, content_texts

    # ── Phase 5: Upsert in batches with retry ───────────────────────────────
    print("\n" + "=" * 60)
    print("Phase 5/5: Uploading to Qdrant...")
    print("=" * 60)

    try:
        existing = client.get_collection(COLLECTION)
        print(f"Collection currently has {existing.points_count} points.")
    except Exception:
        pass

    total_batches = (len(points) + UPSERT_BATCH - 1) // UPSERT_BATCH
    print(f"Uploading {len(points)} points in {total_batches} batches of {UPSERT_BATCH}...")

    t0 = time.time()
    total_uploaded = 0
    failed_batches = 0
    for i in tqdm(range(0, len(points), UPSERT_BATCH)):
        batch = points[i : i + UPSERT_BATCH]
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                client.upsert(
                    collection_name=COLLECTION,
                    points=batch,
                    wait=False,
                )
                total_uploaded += len(batch)
                batch_idx = i // UPSERT_BATCH
                if batch_idx % max(1, total_batches // 30) == 0:
                    pct = total_uploaded / len(points) * 100
                    write_status(
                        "uploading",
                        pct,
                        f"{total_uploaded}/{len(points)} points | "
                        f"{batch_idx}/{total_batches} batches | "
                        f"{failed_batches} failed",
                    )
                break
            except Exception as exc:
                if attempt < MAX_RETRIES:
                    print(
                        f"\nRetry {attempt}/{MAX_RETRIES} for batch "
                        f"{i // UPSERT_BATCH + 1}: {exc}"
                    )
                    time.sleep(RETRY_DELAY_SEC)
                else:
                    print(
                        f"\nFAILED batch {i // UPSERT_BATCH + 1} "
                        f"after {MAX_RETRIES} attempts: {exc}"
                    )
                    failed_batches += 1

    upload_time = time.time() - t0
    print(f"\nUploaded {total_uploaded}/{len(points)} points "
          f"({failed_batches} failed batches) in {upload_time:.1f}s.")

    # ── Verify ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60)
    print("Waiting 30s for Qdrant to index...")
    time.sleep(30)

    info = client.get_collection(COLLECTION)
    print(f"Status:      {info.status}")
    print(f"Points:      {info.points_count}")
    print(f"Indexed vec: {info.indexed_vectors_count}")

    if info.indexed_vectors_count > 0:
        print("\n✓ Re-index complete! Vectors are indexed.")
        write_status("complete", 100, f"{info.indexed_vectors_count} vectors indexed")
    else:
        print("\n⚠ Vectors not yet indexed. Check collection status.")
        write_status("complete", 100, "Upload done but indexing may be delayed")


if __name__ == "__main__":
    main()
