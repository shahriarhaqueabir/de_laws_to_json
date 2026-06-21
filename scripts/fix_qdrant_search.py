"""
Fix Qdrant search relevance by deleting points with empty content ("-").
These points share identical vectors (all "passage: -") and form an artificial
cluster that drowns out all real results.

Strategy: Scroll all points, find empty ones, delete them in batches.
Then test search to verify fix.
"""

import json
import math
import os
import sys
import time

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    sys.exit(1)

import urllib.request


def qdrant_post(path, body):
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"api-key": QDRANT_API_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


# ── Step 1: Collect all empty-content point IDs ──
print("=" * 60)
print("STEP 1: Collecting empty-content point IDs...")
print("=" * 60)

all_empty_ids = []
offset = None
batch_count = 0

while True:
    body = {"limit": 1000, "with_payload": True}
    if offset:
        body["offset"] = offset

    data = qdrant_post("/collections/german_norms/points/scroll", body)
    points = data["result"]["points"]
    if not points:
        break

    for p in points:
        c = p["payload"].get("content", "")
        if c in ("-", "", None):
            all_empty_ids.append(p["id"])

    offset = data["result"].get("next_page_offset")
    batch_count += 1
    if batch_count % 10 == 0:
        print(
            f"  Scanned {batch_count * 1000} points... found {len(all_empty_ids)} empty so far"
        )
    if not offset:
        break

print(f"\nFound {len(all_empty_ids)} empty-content points to delete.")

# Show sample
print(f"Sample empty IDs: {all_empty_ids[:3]}")

# ── Step 2: Verify they're all empty (spot check a few) ──
print(f"\n{'=' * 60}")
print("STEP 2: Verifying empty points...")
print("=" * 60)

if all_empty_ids:
    spot = all_empty_ids[:5]
    body = {"ids": spot, "with_payload": True}
    verify = qdrant_post("/collections/german_norms/points", body)
    for p in verify["result"]:
        print(f"  {p['id'][:24]}... content='{p['payload'].get('content', '')[:20]}'")

# ── Step 3: Delete in batches ──
print(f"\n{'=' * 60}")
print("STEP 3: Deleting empty points in batches of 1000...")
print("=" * 60)

BATCH_SIZE = 1000
deleted_total = 0
for i in range(0, len(all_empty_ids), BATCH_SIZE):
    batch = all_empty_ids[i : i + BATCH_SIZE]
    body = {"points": batch}
    result = qdrant_post("/collections/german_norms/points/delete", body)
    deleted_total += len(batch)
    print(
        f"  Deleted batch {i // BATCH_SIZE + 1}: {len(batch)} points (total: {deleted_total})"
    )
    time.sleep(0.5)  # rate limit

print(f"\nTotal deleted: {deleted_total}")

# ── Step 4: Wait for collection update ──
print(f"\n{'=' * 60}")
print("STEP 4: Waiting for indexing...")
print("=" * 60)
time.sleep(5)

# ── Step 5: Test search ──
print(f"\n{'=' * 60}")
print("STEP 5: Testing search after fix...")
print("=" * 60)

test_queries = [
    "accident on road",
    "Unfall auf der Straße",
    "Kündigung Wohnung",
    "Mietminderung",
]

for query in test_queries:
    print(f"\n  Query: '{query}'")
    data = qdrant_post(
        "/collections/german_norms/points/query",
        {
            "query": {
                "text": f"query: {query}",
                "model": "intfloat/multilingual-e5-small",
            },
            "limit": 5,
            "with_payload": True,
        },
    )
    for p in data["result"]["points"]:
        c = p["payload"].get("content", "")
        status = "EMPTY" if c in ("-", "", None) else "OK"
        print(
            f"    score={p['score']:.4f} | {status} | {p['payload']['law_key']} {p['payload'].get('norm_id', '')}"
        )

# ── Step 6: Collection stats ──
print(f"\n{'=' * 60}")
print("STEP 6: Updated collection stats...")
print("=" * 60)
info = qdrant_post("/collections/german_norms", {})
print(json.dumps(info["result"], indent=2)[:500])

print("\n✅ Fix complete!")
