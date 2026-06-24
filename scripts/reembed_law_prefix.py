"""
Re-embed all Qdrant points with law_key-prefixed passages.
Changes: "passage: {content}" → "passage: [{law_key}] {content}"
This makes same-law vectors cluster tightly for better search & visualization.
Uses Qdrant managed inference (server-side GPU embedding) — much faster than local.
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

COLLECTION = "german_norms"
MODEL = "intfloat/multilingual-e5-small"
BATCH_SIZE = 50  # managed inference batches — 50 is safe for free tier
MAX_RETRIES = 3


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


def qdrant_put(path, body):
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"api-key": QDRANT_API_KEY, "Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


# ── Step 1: Clean up test point ──
print("Cleaning up test point from previous check...")
try:
    qdrant_post(
        f"/collections/{COLLECTION}/points/delete",
        {"filter": {"must": [{"key": "law_key", "match": {"value": "TEST"}}]}},
    )
    print("  Test point deleted.")
except:
    print("  No test point to clean.")

# ── Step 2: Collection info ──
print(f"\n{'=' * 60}")
print("COLLECTION INFO BEFORE")
print("=" * 60)
info = qdrant_get(f"/collections/{COLLECTION}")["result"]
total_points = info["points_count"]
print(f"  Points:  {total_points}")

# ── Step 3: Scroll all points ──
print(f"\n{'=' * 60}")
print("STEP 1: Scroll all existing points (IDs + payloads)")
print("=" * 60)

points_data = []  # [(id, law_key, content_text, full_payload), ...]
offset = None
batch_count = 0

while batch_count < 200:
    body = {"limit": 1000, "with_payload": True}
    if offset:
        body["offset"] = offset
    data = qdrant_post(f"/collections/{COLLECTION}/points/scroll", body)
    pts = data["result"]["points"]
    if not pts:
        break
    for p in pts:
        payload = p["payload"]
        lk = payload.get("law_key", "unknown")
        content = payload.get("content", "") or ""
        # Keep all existing payload fields
        full_payload = dict(payload)
        points_data.append((p["id"], lk, content, full_payload))
    offset = data["result"].get("next_page_offset")
    batch_count += 1
    if batch_count % 10 == 0:
        print(f"  Scanned {len(points_data)} points...")
    if not offset:
        break

print(f"\n  Total loaded: {len(points_data)} points")

# ── Step 4: Preview new prefixes ──
print(f"\n{'=' * 60}")
print("PREVIEW: NEW PREFIX FORMAT")
print("=" * 60)
seen_laws = set()
for pid, lk, content, _ in points_data:
    if lk not in seen_laws and len(seen_laws) < 10:
        seen_laws.add(lk)
        preview = content[:80].replace("\n", " ")
        print(f'  [{lk}]  "passage: [{lk}] {preview}..."')
print(f"\n  Total unique law_keys: {len(set(lk for _, lk, _, _ in points_data))}")

# ── Step 5: Re-embed and upsert ──
print(f"\n{'=' * 60}")
print("STEP 2: Re-embedding with Qdrant managed inference")
print(f"  Model: {MODEL}")
print(f"  Batch size: {BATCH_SIZE}")
print(f"  Total batches: {(len(points_data) + BATCH_SIZE - 1) // BATCH_SIZE}")
print("=" * 60)

total_updated = 0
failed = 0
t0 = time.time()
law_counter = collections.Counter()

for i in range(0, len(points_data), BATCH_SIZE):
    batch = points_data[i : i + BATCH_SIZE]
    points_payload = []
    for pid, lk, content, full_payload in batch:
        # Truncate content to avoid token limit (~512 tokens for E5-small)
        # 4096 chars ≈ 1024 tokens for German text
        truncated = content[:4096]
        passage_text = f"passage: [{lk}] {truncated}"
        points_payload.append(
            {
                "id": pid,
                "vector": {
                    "text": passage_text,
                    "model": MODEL,
                },
                "payload": full_payload,  # Preserve ALL existing fields
            }
        )
        law_counter[lk] += 1

    # Retry loop
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = qdrant_put(
                f"/collections/{COLLECTION}/points", {"points": points_payload}
            )
            if result.get("status") == "ok":
                total_updated += len(batch)
            else:
                failed += len(batch)
            break
        except Exception as exc:
            if attempt < MAX_RETRIES:
                print(
                    f"  Retry {attempt}/{MAX_RETRIES} for batch {i // BATCH_SIZE + 1}: {exc}"
                )
                time.sleep(2)
            else:
                print(
                    f"  FAILED batch {i // BATCH_SIZE + 1} after {MAX_RETRIES} attempts: {exc}"
                )
                failed += len(batch)

    if (i // BATCH_SIZE + 1) % 20 == 0:
        elapsed = time.time() - t0
        rate = total_updated / elapsed if elapsed > 0 else 0
        print(
            f"  Batch {i // BATCH_SIZE + 1}/{(len(points_data) + BATCH_SIZE - 1) // BATCH_SIZE}: "
            f"{total_updated} updated, {failed} failed, {rate:.0f} pts/s"
        )

elapsed = time.time() - t0
print(f"\n  Total updated: {total_updated}")
print(f"  Total failed:  {failed}")
print(f"  Time:          {elapsed:.0f}s ({total_updated / elapsed:.0f} pts/s)")

# ── Step 5: Wait for indexing and verify ──
print(f"\n{'=' * 60}")
print("STEP 3: Verifying results")
print("=" * 60)
print("  Waiting 10s for index...")
time.sleep(10)

info = qdrant_get(f"/collections/{COLLECTION}")["result"]
print(f"  Points:           {info['points_count']}")
print(f"  Indexed vectors:  {info['indexed_vectors_count']}")

# Test intra-law similarity
print(f"\n  TEST: Intra-law vector similarity after re-embed")
for test_law in ["LuftVG", "SGB 11", "Berlin/BonnG"]:
    data = qdrant_post(
        f"/collections/{COLLECTION}/points/scroll",
        {
            "limit": 20,
            "with_vectors": True,
            "filter": {"must": [{"key": "law_key", "match": {"value": test_law}}]},
        },
    )
    vecs = [p["vector"] for p in data["result"]["points"] if p.get("vector")]
    if len(vecs) >= 2:
        import math

        sims = []
        for a in range(min(10, len(vecs))):
            for b in range(a + 1, min(10, len(vecs))):
                dot = sum(x * y for x, y in zip(vecs[a], vecs[b]))
                na = math.sqrt(sum(x * x for x in vecs[a]))
                nb = math.sqrt(sum(x * x for x in vecs[b]))
                sims.append(dot / (na * nb) if na and nb else 0)
        print(
            f"    {test_law:20s}: mean intra-law cos sim = {sum(sims) / len(sims):.4f}"
        )

# Test inter-law similarity (should be much lower now)
print(f"\n  TEST: Inter-law vector similarity (should be LOW)")
for l1, l2 in [
    ("LuftVG", "SGB 11"),
    ("LuftVG", "Berlin/BonnG"),
    ("SGB 11", "Berlin/BonnG"),
]:
    data1 = qdrant_post(
        f"/collections/{COLLECTION}/points/scroll",
        {
            "limit": 10,
            "with_vectors": True,
            "filter": {"must": [{"key": "law_key", "match": {"value": l1}}]},
        },
    )
    data2 = qdrant_post(
        f"/collections/{COLLECTION}/points/scroll",
        {
            "limit": 10,
            "with_vectors": True,
            "filter": {"must": [{"key": "law_key", "match": {"value": l2}}]},
        },
    )
    v1 = [p["vector"] for p in data1["result"]["points"] if p.get("vector")]
    v2 = [p["vector"] for p in data2["result"]["points"] if p.get("vector")]
    if v1 and v2:
        import math
        import random

        sims = []
        for _ in range(50):
            a, b = random.choice(v1), random.choice(v2)
            dot = sum(x * y for x, y in zip(a, b))
            na = math.sqrt(sum(x * x for x in a))
            nb = math.sqrt(sum(x * x for x in b))
            sims.append(dot / (na * nb) if na and nb else 0)
        print(f"    {l1:20s} vs {l2:20s}: mean = {sum(sims) / len(sims):.4f}")

# Test search quality
print(f"\n  TEST SEARCH: 'Flugzeug Luftverkehr Genehmigung'")
data = qdrant_post(
    f"/collections/{COLLECTION}/points/query",
    {
        "query": {"text": "query: Flugzeug Luftverkehr Genehmigung", "model": MODEL},
        "limit": 10,
        "with_payload": True,
    },
)
for p in data["result"]["points"]:
    c = p["payload"].get("content", "")
    print(
        f"    score={p['score']:.4f} | {p['payload']['law_key']:20s} | content_len={len(c)}"
    )

print("\n✅ Re-embedding complete!")
print("\nNow try your visualization again with the same query parameters.")
