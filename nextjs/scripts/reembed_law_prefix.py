#!/usr/bin/env python3
"""
Re-embed all points in the german_norms collection with a [law_key] prefix.

Changes the passage text from:
    "passage: {content}"
to:
    "passage: [{law_key}] {content[:4096]}"

This makes same-law vectors cluster tightly for UMAP visualization
and improves semantic search relevance.
"""

import json
import os
import sys
import time
from pathlib import Path

import requests

# Load .env from parent directory
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    print("ERROR: QDRANT_URL and QDRANT_API_KEY must be set in .env")
    sys.exit(1)

COLLECTION = "german_norms"
MODEL = "intfloat/multilingual-e5-small"
BATCH_SIZE = 50
HEADERS = {"api-key": QDRANT_API_KEY, "Content-Type": "application/json"}

BASE = QDRANT_URL.rstrip("/")


def json_post(path, data):
    url = f"{BASE}{path}"
    r = requests.post(url, json=data, headers=HEADERS)
    if r.status_code >= 400:
        print(f"  ERROR {r.status_code}: {r.text[:200]}")
    r.raise_for_status()
    return r.json()


def json_put(path, data):
    url = f"{BASE}{path}"
    r = requests.put(url, json=data, headers=HEADERS)
    if r.status_code >= 400:
        print(f"  ERROR {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def get_collection_info():
    """Get collection info using GET (not POST which returns 404 on newer Qdrant)."""
    url = f"{BASE}/collections/{COLLECTION}"
    r = requests.get(url, headers=HEADERS)
    if r.status_code >= 400:
        print(f"ERROR getting collection: {r.status_code} {r.text[:200]}")
        return None
    return r.json()


def scroll_all():
    """Scroll all points with payload, handling pagination."""
    points = []
    offset = None
    batch_num = 0
    while True:
        body = {
            "limit": 1000,
            "with_payload": True,
            "with_vector": False,
        }
        if offset is not None:
            body["offset"] = offset

        r = requests.post(
            f"{BASE}/collections/{COLLECTION}/points/scroll",
            json=body,
            headers=HEADERS,
        )
        if r.status_code >= 400:
            print(f"  Scroll ERROR {r.status_code}: {r.text[:200]}")
            break
        data = r.json()
        batch = data.get("result", {}).get("points", [])
        if not batch:
            break
        points.extend(batch)
        batch_num += 1
        next_offset = data.get("result", {}).get("next_page_offset")
        if next_offset is None:
            break
        offset = next_offset
        if batch_num % 20 == 0:
            print(f"  Scrolled {len(points)} points...")

        # Safety limit
        if batch_num >= 200:
            print("  WARNING: Hit safety limit of 200 scroll batches")
            break

    print(f"  Total scrolled: {len(points)} points")
    return points


def reembed(points):
    """Re-embed points with law_key prefix using Qdrant managed inference."""
    total = len(points)
    updated = 0
    failed = 0
    start_time = time.time()

    law_key_chars = {}

    for i in range(0, total, BATCH_SIZE):
        batch = points[i : i + BATCH_SIZE]
        batch_points = []
        for p in batch:
            pid = p["id"]
            payload = p.get("payload", {}) or {}
            law_key = str(payload.get("law_key", "")).strip()

            # Track law_key characters for diagnostics
            if law_key:
                law_key_chars[law_key] = law_key_chars.get(law_key, 0) + 1

            content = str(payload.get("content", ""))

            # Build embedding text with law_key prefix (truncated to ~1024 tokens)
            if law_key:
                embedding_text = f"passage: [{law_key}] {content[:4096]}"
            else:
                embedding_text = f"passage: {content[:4096]}"

            point = {
                "id": pid,
                "vector": {
                    "text": embedding_text,
                    "model": MODEL,
                },
                "payload": payload,
            }
            batch_points.append(point)

        # Upsert with managed inference
        try:
            result = json_put(
                f"/collections/{COLLECTION}/points",
                {
                    "points": batch_points,
                },
            )
            status = result.get("result", {}).get("status", "")
            if status in ("acknowledged", "completed"):
                updated += len(batch_points)
            else:
                failed += len(batch_points)
                print(f"  Batch {i // BATCH_SIZE + 1} unexpected status: {status}")
        except Exception as e:
            failed += len(batch_points)
            print(f"  Batch {i // BATCH_SIZE + 1} FAILED: {e}")

        elapsed = time.time() - start_time
        rate = updated / elapsed if elapsed > 0 else 0
        pct = (i + len(batch)) / total * 100

        if (i // BATCH_SIZE) % 5 == 0 or i + BATCH_SIZE >= total:
            print(
                f"  Batch {i // BATCH_SIZE + 1}/{(total + BATCH_SIZE - 1) // BATCH_SIZE}: {updated} updated, {failed} failed, {rate:.0f} pts/s, {pct:.1f}%"
            )

    elapsed = time.time() - start_time
    print(
        f"\n  Done! {updated} updated, {failed} failed in {elapsed:.0f}s ({updated / elapsed:.0f} pts/s)"
    )
    print(f"  Unique law_keys seen: {len(law_key_chars)}")
    # Show law_key distribution
    top_keys = sorted(law_key_chars.items(), key=lambda x: -x[1])[:10]
    print(f"  Top law_keys: {top_keys}")


def main():
    print("=" * 60)
    print("Qdrant Re-embedding with Law-Key Prefix")
    print(f"  Collection: {COLLECTION}")
    print(f"  Model: {MODEL}")
    print(f"  Batch size: {BATCH_SIZE}")
    print(f"  URL: {QDRANT_URL}")
    print("=" * 60)

    # Check collection info
    info = get_collection_info()
    if info:
        points_count = info.get("result", {}).get("points_count", "?")
        print(f"\nCollection points: {points_count}")
    else:
        print("\nWARNING: Could not get collection info, continuing anyway...")

    print("\n--- Step 1: Scroll all points ---")
    points = scroll_all()
    print(f"  Retrieved {len(points)} points for re-embedding")

    if not points:
        print("ERROR: No points to re-embed")
        sys.exit(1)

    print(f"\n--- Step 2: Re-embedding with managed inference ---")
    print(f"  Model: {MODEL}")
    print(f"  Batch size: {BATCH_SIZE}")
    print(f"  Total batches: {(len(points) + BATCH_SIZE - 1) // BATCH_SIZE}")
    print("-" * 40)

    reembed(points)

    print("\nDone! Re-embedding complete.")


if __name__ == "__main__":
    main()
