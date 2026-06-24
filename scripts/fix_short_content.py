"""
Fix Qdrant visualization & search by deleting very-short-content points.
These have near-identical vectors (cosine sim ~0.89) because E5-small's
"passage: " prefix dominates when actual text is trivial.

Strategy: Scroll all points, find short-content ones, delete in batches.
"""

import collections
import json
import os
import sys
import time
import urllib.request

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    sys.exit(1)

THRESHOLD = 80  # delete points with content <= this many chars


def qdrant_get(path):
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}", headers={"api-key": QDRANT_API_KEY}, method="GET"
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def qdrant_post(path, body):
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"api-key": QDRANT_API_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


# ── Step 1: Collection info ──
print("=" * 60)
print("COLLECTION INFO BEFORE")
print("=" * 60)
info = qdrant_get("/collections/german_norms")["result"]
print(f"  Points:           {info['points_count']}")
print(f"  Indexed vectors:  {info['indexed_vectors_count']}")

# ── Step 2: Collect all short-content point IDs ──
print(f"\n{'=' * 60}")
print(f"STEP 1: Collecting points with content <= {THRESHOLD} chars...")
print("=" * 60)

short_ids = []
short_samples = []
law_counts = collections.Counter()
total_scanned = 0
offset = None
batch_count = 0
MAX_BATCHES = 150  # safety: 103586 / 1000 = ~104 batches

while batch_count < MAX_BATCHES:
    body = {"limit": 1000, "with_payload": True}
    if offset:
        body["offset"] = offset
    data = qdrant_post("/collections/german_norms/points/scroll", body)
    points = data["result"]["points"]
    if not points:
        break
    for p in points:
        total_scanned += 1
        c = p["payload"].get("content", "") or ""
        if len(c) <= THRESHOLD:
            short_ids.append(p["id"])
            lk = p["payload"].get("law_key", "unknown")
            law_counts[lk] += 1
            if len(short_samples) < 20:
                short_samples.append(
                    {
                        "id": p["id"][:16],
                        "law_key": lk,
                        "norm_id": p["payload"].get("norm_id", ""),
                        "content_len": len(c),
                        "content_preview": c[:120],
                    }
                )
    offset = data["result"].get("next_page_offset")
    batch_count += 1
    if batch_count % 10 == 0:
        print(
            f"  Scanned {total_scanned}... found {len(short_ids)} short-content points"
        )
    if not offset:
        print("  No more pages (offset is None). Stopping.")
        break

print(f"\n  Scanned {total_scanned} total points.")
print(
    f"  Found {len(short_ids)} points with content <= {THRESHOLD} chars ({len(short_ids) / total_scanned * 100:.1f}%)"
)

# ── Step 3: Show samples ──
print(f"\n{'=' * 60}")
print("SAMPLE SHORT-CONTENT POINTS (first 20)")
print("=" * 60)
for s in short_samples:
    print(
        f"  [{s['content_len']:3d} chars] {s['law_key']:25s} {s['norm_id']:20s} | {s['content_preview']}"
    )

# ── Step 4: Show law distribution ──
print(f"\n{'=' * 60}")
print("LAWS WITH MOST SHORT-CONTENT POINTS (top 20)")
print("=" * 60)
for lk, cnt in law_counts.most_common(20):
    print(f"  {lk:30s}  {cnt:5d} points")

# ── Step 5: Check vector similarity of a sample ──
print(f"\n{'=' * 60}")
print("VECTOR SIMILARITY CHECK (sample of 5 short points)")
print("=" * 60)
if len(short_ids) >= 5:
    import math

    sample_ids = short_ids[:5]
    vec_data = qdrant_post(
        "/collections/german_norms/points", {"ids": sample_ids, "with_vectors": True}
    )
    vecs = [p["vector"] for p in vec_data["result"] if p.get("vector")]
    if len(vecs) >= 2:
        sims = []
        for i in range(min(5, len(vecs))):
            for j in range(i + 1, min(5, len(vecs))):
                dot = sum(a * b for a, b in zip(vecs[i], vecs[j]))
                n1 = math.sqrt(sum(a * a for a in vecs[i]))
                n2 = math.sqrt(sum(a * a for a in vecs[j]))
                cos_sim = dot / (n1 * n2) if n1 and n2 else 0
                sims.append(cos_sim)
        print(f"  Cosine similarities: {[f'{s:.4f}' for s in sims]}")
        print(f"  Mean: {sum(sims) / len(sims):.4f}")
        print(f"  Min:  {min(sims):.4f}")
        print(f"  Max:  {max(sims):.4f}")

# ── Step 6: Confirm and delete ──
print(f"\n{'=' * 60}")
if not short_ids:
    print("No short-content points found. Nothing to do.")
    sys.exit(0)

print(f"Ready to delete {len(short_ids)} short-content points.")
print("Proceeding with deletion in batches of 1000...")
print("=" * 60)

BATCH_SIZE = 1000
deleted_total = 0
for i in range(0, len(short_ids), BATCH_SIZE):
    batch = short_ids[i : i + BATCH_SIZE]
    body = {"points": batch}
    result = qdrant_post("/collections/german_norms/points/delete", body)
    deleted_total += len(batch)
    print(
        f"  Deleted batch {i // BATCH_SIZE + 1}: {len(batch)} points (total: {deleted_total})"
    )
    time.sleep(0.3)

print(f"\nTotal deleted: {deleted_total}")

# ── Step 7: Verify ──
print(f"\n{'=' * 60}")
print("VERIFICATION")
print("=" * 60)
time.sleep(5)  # Wait for index update

info = qdrant_get("/collections/german_norms")["result"]
print(f"  Points before:     {info['points_count'] + deleted_total}")
print(f"  Points after:      {info['points_count']}")
print(f"  Indexed vectors:   {info['indexed_vectors_count']}")
print(f"  Points removed:    {deleted_total}")

# Test search
print(f"\n  TEST SEARCH: 'accident on road' (no filter)")
data = qdrant_post(
    "/collections/german_norms/points/query",
    {
        "query": {
            "text": "query: accident on road",
            "model": "intfloat/multilingual-e5-small",
        },
        "limit": 10,
        "with_payload": True,
    },
)
for p in data["result"]["points"]:
    c = p["payload"].get("content", "")
    print(
        f"    score={p['score']:.4f} | {p['payload']['law_key']:20s} {p['payload'].get('norm_id', ''):20s} | content_len={len(c)}"
    )

# Test search with category=other filter
print(f"\n  TEST SEARCH: 'accident on road' (category=other)")
data = qdrant_post(
    "/collections/german_norms/points/query",
    {
        "query": {
            "text": "query: accident on road",
            "model": "intfloat/multilingual-e5-small",
        },
        "limit": 10,
        "filter": {"must": [{"key": "category", "match": {"value": "other"}}]},
        "with_payload": True,
    },
)
for p in data["result"]["points"]:
    c = p["payload"].get("content", "")
    print(
        f"    score={p['score']:.4f} | {p['payload']['law_key']:20s} {p['payload'].get('norm_id', ''):20s} | content_len={len(c)}"
    )

print("\n✅ Done!")
