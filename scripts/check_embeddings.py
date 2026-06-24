"""
Diagnose why UMAP clusters overlap.
Measures intra-law vs inter-law cosine similarity to see if embeddings
actually separate different legal domains.
"""

import collections
import json
import math
import os
import random
import sys
import urllib.request

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    sys.exit(1)


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


TARGET_LAWS = ["SGB 11", "SGB 10", "Berlin/BonnG", "LuftVG", "LuftVZO"]


def cosine(v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(a * a for a in v2))
    return dot / (n1 * n2) if n1 and n2 else 0


# 1. Fetch points for target laws
print("=" * 70)
print("FETCHING POINTS FOR TARGET LAWS")
print("=" * 70)

law_points = {}
for law in TARGET_LAWS:
    pts = []
    offset = None
    while True:
        body = {"limit": 1000, "with_payload": True, "with_vectors": True}
        if offset:
            body["offset"] = offset
        body["filter"] = {"must": [{"key": "law_key", "match": {"value": law}}]}
        data = qdrant_post("/collections/german_norms/points/scroll", body)
        batch = data["result"]["points"]
        if not batch:
            break
        pts.extend(batch)
        offset = data["result"].get("next_page_offset")
        if not offset:
            break
        if len(pts) >= 500:
            break
    law_points[law] = pts
    print(f"  {law:20s}: {len(pts)} points")

# 2. Compute intra-law similarity
print("\n" + "=" * 70)
print("INTRA-LAW COSINE SIMILARITY")
print("=" * 70)
for law, pts in law_points.items():
    vecs = [p["vector"] for p in pts if p.get("vector")]
    if len(vecs) < 2:
        print(f"  {law:20s}: need >= 2 points, got {len(vecs)}")
        continue
    sims = []
    sample = random.sample(range(len(vecs)), min(50, len(vecs)))
    for i in range(len(sample)):
        for j in range(i + 1, len(sample)):
            sims.append(cosine(vecs[sample[i]], vecs[sample[j]]))
    if sims:
        print(
            f"  {law:20s}: mean={sum(sims) / len(sims):.4f}  min={min(sims):.4f}  max={max(sims):.4f}  (n={len(sims)} pairs)"
        )

# 3. Compute inter-law similarity (cross pairs)
print("\n" + "=" * 70)
print("INTER-LAW COSINE SIMILARITY")
print("=" * 70)
law_names = [
    l for l, pts in law_points.items() if len([p for p in pts if p.get("vector")]) >= 2
]
for i in range(len(law_names)):
    for j in range(i + 1, len(law_names)):
        l1, l2 = law_names[i], law_names[j]
        v1s = [p["vector"] for p in law_points[l1] if p.get("vector")]
        v2s = [p["vector"] for p in law_points[l2] if p.get("vector")]
        sims = []
        for _ in range(min(100, len(v1s) * len(v2s))):
            a = random.choice(v1s)
            b = random.choice(v2s)
            sims.append(cosine(a, b))
        if sims:
            print(
                f"  {l1:20s} vs {l2:20s}: mean={sum(sims) / len(sims):.4f}  min={min(sims):.4f}  max={max(sims):.4f}"
            )

# 4. Check the magnitue of vectors
print("\n" + "=" * 70)
print("VECTOR MAGNITUDES & FIRST 3 DIMENSIONS (sample 3 per law)")
print("=" * 70)
for law in TARGET_LAWS:
    pts = law_points.get(law, [])
    vecs = [p["vector"] for p in pts[:3] if p.get("vector")]
    for idx, v in enumerate(vecs):
        mag = math.sqrt(sum(x * x for x in v))
        print(
            f"  {law:20s} pt{idx}: mag={mag:.4f}  [0:3]={[f'{x:.4f}' for x in v[:3]]}"
        )

# 5. Check if "passage: " prefix creates a dominant direction
print("\n" + "=" * 70)
print("DOMINANT DIMENSION ANALYSIS")
print("=" * 70)
# Collect all vectors
all_vecs = []
for pts in law_points.values():
    for p in pts:
        if p.get("vector"):
            all_vecs.append(p["vector"])

if all_vecs:
    # Compute mean vector
    dim = len(all_vecs[0])
    mean_vec = [sum(v[d] for v in all_vecs) / len(all_vecs) for d in range(dim)]
    mean_mag = math.sqrt(sum(x * x for x in mean_vec))
    print(f"  Mean vector magnitude: {mean_mag:.4f}")

    # Subtract mean from each vector and check residual magnitude
    residuals = []
    for v in all_vecs[:100]:
        residual = [v[d] - mean_vec[d] for d in range(dim)]
        residuals.append(residual)

    # Compute mean cosine of raw vectors (should be high if all share a dominant direction)
    raw_sims = []
    for i in range(min(30, len(all_vecs))):
        for j in range(i + 1, min(30, len(all_vecs))):
            raw_sims.append(cosine(all_vecs[i], all_vecs[j]))

    # Compute mean cosine of centered vectors
    centered_sims = []
    for i in range(min(30, len(residuals))):
        for j in range(i + 1, min(30, len(residuals))):
            centered_sims.append(cosine(residuals[i], residuals[j]))

    print(f"  Raw vectors mean cosine:       {sum(raw_sims) / len(raw_sims):.4f}")
    if centered_sims:
        print(
            f"  Centered vectors mean cosine:  {sum(centered_sims) / len(centered_sims):.4f}"
        )
        print(
            f"  Improvement:                   {sum(raw_sims) / len(raw_sims) - sum(centered_sims) / len(centered_sims):.4f}"
        )

# 6. Compare with query-time embedding (managed inference)
print("\n" + "=" * 70)
print("QUERY-TIME EMBEDDING CHECK")
print("=" * 70)
# If we search for something specific to one law, does it find that law?
queries = [
    ("LuftVG-specific", "Flugzeug Luftfahrt Luftverkehr Genehmigung"),
    ("LuftVZO-specific", "Luftfahrzeug Zulassung Betriebsordnung"),
    ("SGB-specific", "Sozialgesetzbuch Sozialhilfe Rehabilitation"),
]
for label, q in queries:
    data = qdrant_post(
        "/collections/german_norms/points/query",
        {
            "query": {"text": f"query: {q}", "model": "intfloat/multilingual-e5-small"},
            "limit": 20,
            "with_payload": True,
        },
    )
    law_hits = collections.Counter()
    for p in data["result"]["points"]:
        law_hits[p["payload"].get("law_key", "?")] += 1
    top3 = law_hits.most_common(5)
    print(f"  '{label}':")
    for lk, cnt in top3:
        print(f"     {lk:20s}: {cnt} hits")

print("\nDone.")
