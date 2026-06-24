#!/usr/bin/env python3
"""
Apply deterministic law_key offsets to all vectors for UMAP visualization.

Each law_key gets a unique pseudo-random unit vector (deterministic via SHA-256).
Vectors are mixed as:  new_vec = normalize(content_vec + alpha * law_key_unit_vec)

This forces separation by law_key in the UMAP visualization while preserving
content similarity structure within each law.
"""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import requests

# ── Config ──────────────────────────────────────────────────────────────
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
DIM = 384
ALPHA = 0.40  # mixing weight — higher = stronger law_key separation
BATCH_SIZE = 100  # scroll+upsert batch
DRY_RUN = os.environ.get("DRY_RUN", "").lower() in (
    "1",
    "true",
    "yes",
)  # set env DRY_RUN=1 to just measure
SKIP_PROMPT = os.environ.get("SKIP_PROMPT", "").lower() in (
    "1",
    "true",
    "yes",
)  # auto-confirm with env SKIP_PROMPT=1

# Cache for law_key unit vectors
_law_cache: dict[str, np.ndarray] = {}

# ── Helpers ─────────────────────────────────────────────────────────────


def json_post(path, data):
    r = requests.post(f"{QDRANT_URL}{path}", json=data, headers=HEADERS, timeout=30)
    if r.status_code >= 400:
        print(f"  POST ERROR {r.status_code}: {r.text[:200]}")
        r.raise_for_status()
    return r.json()


def json_put(path, data):
    r = requests.put(f"{QDRANT_URL}{path}", json=data, headers=HEADERS, timeout=30)
    if r.status_code >= 400:
        print(f"  PUT ERROR {r.status_code}: {r.text[:200]}")
        r.raise_for_status()
    return r.json()


def get_law_key_vector(law_key: str) -> np.ndarray:
    """Deterministic unit vector from law_key string (SHA-256 → seed → normal → normalize)."""
    if law_key in _law_cache:
        return _law_cache[law_key]
    h = hashlib.sha256(law_key.encode()).digest()
    seed = int.from_bytes(h[:8], "little")
    rng = np.random.default_rng(seed)
    v = rng.normal(size=DIM).astype(np.float32)
    v /= np.linalg.norm(v)
    _law_cache[law_key] = v
    return v


def mix_vector(content_vec: np.ndarray, law_key: str) -> np.ndarray:
    """new_vec = normalize(content + alpha * law_key_unit)."""
    if not law_key:
        return content_vec
    lv = get_law_key_vector(law_key)
    mixed = content_vec.astype(np.float32) + ALPHA * lv
    mixed /= np.linalg.norm(mixed)
    return mixed


def cos_sim(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


# ── Step 1: Test on sample ──────────────────────────────────────────────


def test_sample():
    """Test the mixing on a small sample and report separation improvement."""
    print("=" * 60)
    print(f"Testing mixing with ALPHA={ALPHA}")
    print("=" * 60)

    test_laws = ["SGB 11", "SGB 10", "LuftVG", "Berlin/BonnG", "BGB"]
    samples = {}

    for law in test_laws:
        r = json_post(
            f"/collections/{COLLECTION}/points/scroll",
            {
                "limit": 50,
                "with_vector": True,
                "with_payload": True,
                "filter": {"must": [{"key": "law_key", "match": {"value": law}}]},
            },
        )
        pts = r.get("result", {}).get("points", [])
        samples[law] = pts
        print(f"  {law}: {len(pts)} points")

    # Measure intra-law before and after
    print("\n  ── Intra-law similarity ──")
    for law, pts in samples.items():
        if len(pts) < 2:
            continue
        orig_vecs = [
            np.array(p["vector"], dtype=np.float32) for p in pts if p.get("vector")
        ]
        new_vecs = [mix_vector(ov, law) for ov in orig_vecs]

        orig_sims = [
            cos_sim(orig_vecs[i], orig_vecs[j])
            for i in range(min(20, len(orig_vecs)))
            for j in range(i + 1, min(i + 3, len(orig_vecs)))
        ]
        new_sims = [
            cos_sim(new_vecs[i], new_vecs[j])
            for i in range(min(20, len(new_vecs)))
            for j in range(i + 1, min(i + 3, len(new_vecs)))
        ]
        print(
            f"    {law:15s}  before: {np.mean(orig_sims):.4f}  after: {np.mean(new_sims):.4f}"
        )

    # Measure cross-law before and after
    print("\n  ── Cross-law similarity ──")
    for i, law_a in enumerate(test_laws):
        if law_a not in samples or len(samples[law_a]) < 1:
            continue
        for law_b in test_laws[i + 1 :]:
            if law_b not in samples or len(samples[law_b]) < 1:
                continue
            orig_a = [
                np.array(p["vector"], dtype=np.float32)
                for p in samples[law_a][:10]
                if p.get("vector")
            ]
            orig_b = [
                np.array(p["vector"], dtype=np.float32)
                for p in samples[law_b][:10]
                if p.get("vector")
            ]

            # Before
            cross_orig = [cos_sim(oa, ob) for oa in orig_a for ob in orig_b]
            # After
            new_a = [mix_vector(v, law_a) for v in orig_a]
            new_b = [mix_vector(v, law_b) for v in orig_b]
            cross_new = [
                cos_sim(na, nb)
                for na in new_a
                for nb in new_b
                if na is not None and nb is not None
            ]

            intra_a_orig = (
                np.mean(
                    [
                        cos_sim(orig_a[i], orig_a[j])
                        for i in range(min(5, len(orig_a)))
                        for j in range(i + 1, min(i + 2, len(orig_a)))
                    ]
                )
                if len(orig_a) > 1
                else 0
            )
            intra_a_new = (
                np.mean(
                    [
                        cos_sim(new_a[i], new_a[j])
                        for i in range(min(5, len(new_a)))
                        for j in range(i + 1, min(i + 2, len(new_a)))
                    ]
                )
                if len(new_a) > 1
                else 0
            )
            print(f"    {law_a:15s} vs {law_b:15s}")
            print(
                f"      cross: before={np.mean(cross_orig):.4f}  after={np.mean(cross_new):.4f}"
            )
            print(
                f"      intra {law_a}: before={intra_a_orig:.4f}  after={intra_a_new:.4f}"
            )
            gap_before = intra_a_orig - np.mean(cross_orig) if len(orig_a) > 1 else 0
            gap_after = intra_a_new - np.mean(cross_new) if len(new_a) > 1 else 0
            print(f"      gap:  before={gap_before:.4f}  after={gap_after:.4f}")

    print(f"\n  Recommended: ALPHA between 0.3 and 0.5 for UMAP")


# ── Step 2: Apply to all points ─────────────────────────────────────────


def apply_to_all():
    """Scroll all points, mix vectors, upsert in batches."""
    print("=" * 60)
    print(f"Applying law_key offsets to ALL {COLLECTION} points")
    print(f"  Alpha: {ALPHA}, Batch: {BATCH_SIZE}, DRY_RUN: {DRY_RUN}")
    print("=" * 60)

    offset = None
    total = 0
    updated = 0
    start = time.time()

    while True:
        body = {
            "limit": BATCH_SIZE,
            "with_vector": True,
            "with_payload": True,
        }
        if offset is not None:
            body["offset"] = offset

        r = requests.post(
            f"{QDRANT_URL}/collections/{COLLECTION}/points/scroll",
            json=body,
            headers=HEADERS,
            timeout=30,
        )
        data = r.json()
        batch = data.get("result", {}).get("points", [])
        if not batch:
            break

        upsert_points = []
        for p in batch:
            pid = p["id"]
            payload = p.get("payload", {}) or {}
            law_key = str(payload.get("law_key", "")).strip()
            orig_vec = (
                np.array(p["vector"], dtype=np.float32) if p.get("vector") else None
            )
            if orig_vec is None:
                continue

            new_vec = mix_vector(orig_vec, law_key)
            upsert_points.append(
                {
                    "id": pid,
                    "vector": new_vec.tolist(),
                    "payload": payload,
                }
            )

        if not DRY_RUN and upsert_points:
            result = json_put(
                f"/collections/{COLLECTION}/points", {"points": upsert_points}
            )
            status = result.get("result", {}).get("status", "")
            if status in ("acknowledged", "completed"):
                updated += len(upsert_points)

        total += len(batch)
        next_offset = data.get("result", {}).get("next_page_offset")
        if next_offset is None:
            break
        offset = next_offset

        if total % 1000 == 0 or offset is None:
            elapsed = time.time() - start
            rate = total / elapsed if elapsed > 0 else 0
            print(f"  {total} points processed, {updated} updated, {rate:.0f} pts/s")

        # Safety
        if total >= 100000:
            break

    elapsed = time.time() - start
    print(
        f"\n  Done! {total} points processed, {updated} updated in {elapsed:.0f}s ({updated / elapsed:.0f} pts/s)"
    )


# ── Main ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Phase 1: Test
    test_sample()

    # Phase 2: Apply (if not dry run)
    print()
    if DRY_RUN:
        print("DRY_RUN=True — not modifying Qdrant. Set env DRY_RUN=0 to apply.")
    elif SKIP_PROMPT:
        print("SKIP_PROMPT=True — applying offsets...")
        apply_to_all()
    else:
        ans = input(f"\nApply law_key offsets to all points (ALPHA={ALPHA})? [y/N]: ")
        if ans.lower() in ("y", "yes"):
            apply_to_all()
        else:
            print("Skipped.")
