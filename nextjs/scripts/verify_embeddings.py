#!/usr/bin/env python3
"""
Verify the re-embedding by checking cosine similarity improvement.
Intra-law vs inter-law similarity gap should now be significant.
"""

import json
import os
from pathlib import Path

import numpy as np
import requests

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    for line in open(env_path):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

QDRANT_URL = os.environ.get("QDRANT_URL", "").rstrip("/")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
HEADERS = {"api-key": QDRANT_API_KEY, "Content-Type": "application/json"}
COLLECTION = "german_norms"


def scroll_with_vectors(filter_key=None, limit=500):
    """Scroll points with their vectors."""
    points = []
    offset = None
    while len(points) < limit:
        body = {
            "limit": min(100, limit - len(points)),
            "with_payload": True,
            "with_vector": True,
        }
        if offset is not None:
            body["offset"] = offset
        if filter_key:
            body["filter"] = {
                "must": [{"key": "law_key", "match": {"value": filter_key}}]
            }

        r = requests.post(
            f"{QDRANT_URL}/collections/{COLLECTION}/points/scroll",
            json=body,
            headers=HEADERS,
        )
        if r.status_code != 200:
            print(f"Error: {r.status_code} {r.text[:200]}")
            break
        data = r.json()
        batch = data.get("result", {}).get("points", [])
        if not batch:
            break
        points.extend(batch)
        next_offset = data.get("result", {}).get("next_page_offset")
        if next_offset is None:
            break
        offset = next_offset
    return points[:limit]


def cos_sim(a, b):
    a = np.array(a)
    b = np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


# Test laws: some similar (SGB 10/11 are both social law), some very different (LuftVG is aviation)
test_laws = ["SGB 11", "SGB 10", "LuftVG", "Berlin/BonnG", "BGB"]

print("=" * 60)
print("Verifying Re-embedding Quality")
print("=" * 60)

for law in test_laws:
    pts = scroll_with_vectors(law, limit=100)
    print(f"\n{law}: {len(pts)} points")
    if len(pts) < 2:
        print("  Not enough points")
        continue
    vecs = [p["vector"] for p in pts if p.get("vector")]
    if not vecs:
        print("  No vectors found!")
        continue

    # Intra-law similarity (random sample of pairs)
    intra_sims = []
    for i in range(min(50, len(vecs))):
        for j in range(i + 1, min(i + 5, len(vecs))):
            intra_sims.append(cos_sim(vecs[i], vecs[j]))

    print(f"  Intra-law mean cos sim: {np.mean(intra_sims):.4f}")

# Cross-law comparisons
print("\n--- Cross-law similarity ---")
for i, law_a in enumerate(test_laws):
    pts_a = scroll_with_vectors(law_a, limit=50)
    if not pts_a:
        continue
    for law_b in test_laws[i + 1 :]:
        pts_b = scroll_with_vectors(law_b, limit=50)
        if not pts_b:
            continue
        cross_sims = []
        for pa in pts_a[:10]:
            if not pa.get("vector"):
                continue
            for pb in pts_b[:10]:
                if not pb.get("vector"):
                    continue
                cross_sims.append(cos_sim(pa["vector"], pb["vector"]))
        if cross_sims:
            print(f"  {law_a} vs {law_b}: {np.mean(cross_sims):.4f}")

# Overall statistics
print("\n--- Overall statistics ---")
print("Computing overall mean vector...")
all_pts = scroll_with_vectors(limit=500)
vecs = [p["vector"] for p in all_pts if p.get("vector")]
if vecs:
    mean_vec = np.mean(vecs, axis=0)
    sims_to_mean = [cos_sim(v, mean_vec) for v in vecs]
    print(f"  Mean cos sim to centroid: {np.mean(sims_to_mean):.4f}")
    print(f"  Min cos sim to centroid:  {np.min(sims_to_mean):.4f}")
    print(f"  Max cos sim to centroid:  {np.max(sims_to_mean):.4f}")

    # After centering
    centered = [v - mean_vec for v in vecs]
    centered_sims = []
    for i in range(min(100, len(centered))):
        for j in range(i + 1, min(i + 3, len(centered))):
            centered_sims.append(cos_sim(centered[i], centered[j]))
    print(f"  Mean cos sim (centered):  {np.mean(centered_sims):.4f}")

print(
    "\n✅ Verification complete. If intra-law > 0.90 and cross-law < 0.50, re-embedding worked well."
)
