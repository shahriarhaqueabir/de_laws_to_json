"""
Diagnose Qdrant visualization issues.
Checks category distribution, content length distribution, law_key density.
"""

import collections
import json
import math
import os
import sys
import urllib.request

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    sys.exit(1)


def qdrant_get(path):
    req = urllib.request.Request(
        f"{QDRANT_URL}{path}",
        headers={"api-key": QDRANT_API_KEY},
        method="GET",
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


# 1. Collection stats
print("=" * 70)
print("COLLECTION INFO")
print("=" * 70)
info = qdrant_get("/collections/german_norms")["result"]
print(f"  Points:           {info['points_count']}")
print(f"  Indexed vectors:  {info['indexed_vectors_count']}")
print(f"  Status:           {info['status']}")

# 2. Scroll all points and analyze
print("\n" + "=" * 70)
print("SCROLLING ALL POINTS - CATEGORY & CONTENT ANALYSIS")
print("=" * 70)

cat_counts = collections.Counter()
law_keys_in_other = collections.Counter()
content_len_dist = collections.Counter()
total = 0
offset = None
batch_count = 0
short_content_laws = collections.Counter()
short_content_ids = []

while batch_count < 200:
    body = {"limit": 1000, "with_payload": True}
    if offset:
        body["offset"] = offset
    data = qdrant_post("/collections/german_norms/points/scroll", body)
    points = data["result"]["points"]
    if not points:
        break
    for p in points:
        total += 1
        cat = p["payload"].get("category", "unknown")
        cat_counts[cat] += 1
        if cat == "other":
            lk = p["payload"].get("law_key", "unknown")
            law_keys_in_other[lk] += 1
        c = p["payload"].get("content", "")
        cl = len(c)
        if cl <= 100:
            content_len_dist["<=100"] += 1
            short_content_laws[p["payload"].get("law_key", "unknown")] += 1
            short_content_ids.append(p["id"])
        elif cl <= 500:
            content_len_dist["101-500"] += 1
        elif cl <= 2000:
            content_len_dist["501-2000"] += 1
        else:
            content_len_dist[">2000"] += 1
    offset = data["result"].get("next_page_offset")
    batch_count += 1
    if batch_count % 20 == 0:
        print(f"  Scanned {total} points...")
    if not offset:
        break

print(f"\n  Total scanned: {total}")
print(f"\n  CATEGORY DISTRIBUTION:")
for cat, cnt in cat_counts.most_common():
    print(f"    {cat:20s}  {cnt:6d}  ({cnt / total * 100:5.1f}%)")

print(f"\n  CONTENT LENGTH DISTRIBUTION:")
for bucket, cnt in content_len_dist.most_common():
    print(f"    {bucket:15s}  {cnt:6d}  ({cnt / total * 100:5.1f}%)")

# Laws with most short-content points
print(f"\n  LAWS WITH MOST SHORT-CONTENT POINTS (<=100 chars, top 20):")
for lk, cnt in short_content_laws.most_common(20):
    print(f"    {lk:30s}  {cnt:5d} short-content points")

# 3. Focus on "other" category analysis
print("\n" + "=" * 70)
print(f"HOW MANY UNIQUE law_key VALUES IN 'other' CATEGORY?")
print("=" * 70)
total_other = sum(law_keys_in_other.values())
unique_law_keys = len(law_keys_in_other)
print(f"  Total points in 'other':   {total_other}")
print(f"  Unique law_key values:     {unique_law_keys}")
print(f"  Avg points per law_key:    {total_other / unique_law_keys:.1f}")
print(f"\n  law_keys with most points in 'other' (top 20):")
for lk, cnt in law_keys_in_other.most_common(20):
    print(f"    {lk:30s}  {cnt:5d} points")

# 4. Check vector similarity among short-content points
print("\n" + "=" * 70)
print("VECTOR SIMILARITY CHECK - SHORT CONTENT POINTS")
print("=" * 70)
if len(short_content_ids) >= 5:
    sample = short_content_ids[:5]
    body = {"ids": sample, "with_vectors": True}
    vec_data = qdrant_post("/collections/german_norms/points", body)
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
        print(
            f"  Cosine similarities between short-content vectors: {[f'{s:.4f}' for s in sims]}"
        )
        print(f"  Mean: {sum(sims) / len(sims):.4f}")

# Also compare a short-content point with a long-content point
print("\n  Short vs long content vector similarity:")
# Find a long content point
long_id = None
offset = None
for attempt in range(5):
    body = {"limit": 100, "with_payload": True}
    if offset:
        body["offset"] = offset
    data = qdrant_post("/collections/german_norms/points/scroll", body)
    for p in data["result"]["points"]:
        if len(p["payload"].get("content", "")) > 2000:
            long_id = p["id"]
            break
    if long_id:
        break
    offset = data["result"].get("next_page_offset")

if long_id and short_content_ids:
    body = {"ids": [short_content_ids[0], long_id], "with_vectors": True}
    pair_data = qdrant_post("/collections/german_norms/points", body)
    if len(pair_data["result"]) == 2:
        v1 = pair_data["result"][0]["vector"]
        v2 = pair_data["result"][1]["vector"]
        if v1 and v2:
            dot = sum(a * b for a, b in zip(v1, v2))
            n1 = math.sqrt(sum(a * a for a in v1))
            n2 = math.sqrt(sum(a * a for a in v2))
            cos_sim = dot / (n1 * n2) if n1 and n2 else 0
            lk1 = pair_data["result"][0].get("payload", {}).get("law_key", "?")
            lk2 = pair_data["result"][1].get("payload", {}).get("law_key", "?")
            print(f"    {lk1}(short) vs {lk2}(long) = {cos_sim:.4f}")

# 5. Test search by category
print("\n" + "=" * 70)
print("TEST SEARCH: 'accident on road' WITH category=traffic FILTER")
print("=" * 70)
data = qdrant_post(
    "/collections/german_norms/points/query",
    {
        "query": {
            "text": "query: accident on road",
            "model": "intfloat/multilingual-e5-small",
        },
        "limit": 10,
        "filter": {"must": [{"key": "category", "match": {"value": "traffic"}}]},
        "with_payload": True,
    },
)
for p in data["result"]["points"]:
    c = p["payload"].get("content", "")
    print(
        f"  score={p['score']:.4f} | {p['payload']['law_key']:20s} {p['payload'].get('norm_id', ''):15s} | content_len={len(c)}"
    )


print("\n" + "=" * 70)
print("TEST SEARCH: 'accident on road' WITH category=other FILTER")
print("=" * 70)
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
        f"  score={p['score']:.4f} | {p['payload']['law_key']:20s} {p['payload'].get('norm_id', ''):15s} | content_len={len(c)} | law_title={p['payload'].get('law_title', '')[:40]}"
    )

print("\nDone.")
