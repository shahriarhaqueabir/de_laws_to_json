"""
Analyze Qdrant collection to diagnose search relevance issues.
Counts empty vs non-empty content points per law_key.
"""

import json
import os
import sys

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
        headers={
            "api-key": QDRANT_API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


# 1. Scroll all points in batches to count empty vs non-empty
total = 0
empty = 0
with_content = 0
law_empty_counts = {}
law_total_counts = {}
offset = None
batch_count = 0

print("Scanning Qdrant collection...")
while batch_count < 100:  # safety limit
    body = {"limit": 1000, "with_payload": True}
    if offset:
        body["offset"] = offset

    data = qdrant_post("/collections/german_norms/points/scroll", body)
    points = data["result"]["points"]
    if not points:
        break

    for p in points:
        total += 1
        c = p["payload"].get("content", "")
        lk = p["payload"].get("law_key", "unknown")
        law_total_counts[lk] = law_total_counts.get(lk, 0) + 1
        if c in ("-", "", None):
            empty += 1
            law_empty_counts[lk] = law_empty_counts.get(lk, 0) + 1
        else:
            with_content += 1

    offset = data["result"].get("next_page_offset")
    batch_count += 1
    if batch_count % 10 == 0:
        print(
            f"  Scanned {total} points... (empty={empty}, with_content={with_content})"
        )
    if not offset:
        break

print(f"\n{'=' * 60}")
print(f"TOTAL POINTS:     {total}")
print(f"EMPTY CONTENT:    {empty} ({empty / total * 100:.1f}%)")
print(f"WITH CONTENT:     {with_content} ({with_content / total * 100:.1f}%)")
print(f"{'=' * 60}")

# 2. Show laws with most empty-content points
print(f"\nLaws with most empty-content points (top 20):")
sorted_laws = sorted(law_empty_counts.items(), key=lambda x: -x[1])
for lk, ec in sorted_laws[:20]:
    tc = law_total_counts.get(lk, 0)
    print(f"  {lk:30s}  empty={ec:5d}  total={tc:5d}  {ec / tc * 100:.0f}% empty")

# 3. Search test
print(f"\n{'=' * 60}")
print("TEST SEARCH: 'accident on road'")
data = qdrant_post(
    "/collections/german_norms/points/query",
    {
        "query": {
            "text": "query: accident on road",
            "model": "intfloat/multilingual-e5-small",
        },
        "limit": 20,
        "with_payload": True,
    },
)
for p in data["result"]["points"]:
    c = p["payload"].get("content", "")
    status = "EMPTY" if c in ("-", "", None) else "OK"
    print(
        f"  score={p['score']:.4f} | {status} | {p['payload']['law_key']} {p['payload'].get('norm_id', '')} | content_len={len(c)}"
    )

# 4. Check vector similarity of empty-content points
print(f"\n{'=' * 60}")
print("Checking if empty-content points share similar vectors...")
# Get a few empty-content points
empty_ids = []
for p in data["result"]["points"]:
    if p["payload"].get("content") in ("-", "", None):
        empty_ids.append(p["id"])
        if len(empty_ids) >= 3:
            break

if empty_ids:
    # Fetch their vectors
    body = {"ids": empty_ids, "with_vectors": True}
    vec_data = qdrant_post("/collections/german_norms/points", body)
    for p in vec_data["result"]:
        v = p["vector"]
        print(
            f"  ID={p['id'][:12]}... vector_dim={len(v) if isinstance(v, list) else 'not a list'} first_3={v[:3] if isinstance(v, list) else 'N/A'}"
        )

    # Compute similarity between first two empty points
    if len(vec_data["result"]) >= 2:
        import math

        v1 = vec_data["result"][0]["vector"]
        v2 = vec_data["result"][1]["vector"]
        if isinstance(v1, list) and isinstance(v2, list):
            dot = sum(a * b for a, b in zip(v1, v2))
            n1 = math.sqrt(sum(a * a for a in v1))
            n2 = math.sqrt(sum(a * a for a in v2))
            cos_sim = dot / (n1 * n2) if n1 and n2 else 0
            print(f"  Cosine similarity between first 2 empty vectors: {cos_sim:.6f}")

            # Also compare with a proper-content point
            pt_with_content = None
            for p in data["result"]["points"]:
                if p["payload"].get("content") not in ("-", "", None):
                    pt_with_content = p
                    break
            if pt_with_content:
                body = {"ids": [pt_with_content["id"]], "with_vectors": True}
                good_data = qdrant_post("/collections/german_norms/points", body)
                if good_data["result"]:
                    v3 = good_data["result"][0]["vector"]
                    if isinstance(v3, list):
                        dot2 = sum(a * b for a, b in zip(v1, v3))
                        n3 = math.sqrt(sum(a * a for a in v3))
                        cos_sim2 = dot2 / (n1 * n3) if n1 and n3 else 0
                        print(f"  Cosine similarity (empty vs proper): {cos_sim2:.6f}")

print("\nDone.")
