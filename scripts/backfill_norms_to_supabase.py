"""
Backfill all norms from Qdrant scroll into Supabase norms table.

Scrolls Qdrant collection (payload only, no vectors), batches into groups,
and upserts via Supabase Management API.

Usage:
    set QDRANT_URL, QDRANT_API_KEY, SUPABASE_ACCESS_TOKEN
    python scripts/backfill_norms_to_supabase.py
"""

import json
import os
import time

import requests
from qdrant_client import QdrantClient

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
SUPABASE_ACCESS_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN")
SUPABASE_REF = "zuhhimmdlnsjuwksitpb"

BATCH_SIZE = 500
COLLECTION = "german_norms"

if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    exit(1)
if not SUPABASE_ACCESS_TOKEN:
    print("Error: SUPABASE_ACCESS_TOKEN must be set.")
    exit(1)

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=120)


def scroll_all_norms():
    """Scroll all points from Qdrant (payload only)."""
    norms = []
    next_offset = None
    limit = 1000

    while True:
        results = client.scroll(
            collection_name=COLLECTION,
            limit=limit,
            offset=next_offset,
            with_payload=True,
            with_vectors=False,
        )
        points, next_offset = results
        for p in points:
            payload = p.payload or {}
            norms.append(
                {
                    "law_key": (payload.get("law_key", "") or "").strip(),
                    "law_title": payload.get("law_title", ""),
                    "category": payload.get("category", "other"),
                    "norm_id": payload.get("norm_id", ""),
                    "norm_title": payload.get("norm_title", ""),
                    "content": payload.get("content", ""),
                }
            )

        print(f"  Scrolled {len(norms)} norms...")
        if next_offset is None:
            break

    print(f"Total norms scrolled: {len(norms)}")
    return norms


def upsert_batch(batch):
    """Upsert a batch of norms into Supabase via Management API."""
    # Build SQL: INSERT ... ON CONFLICT (law_key, norm_id) DO UPDATE SET ...
    values_sql = []
    for n in batch:
        # Escape single quotes by doubling them
        law_key = n["law_key"].replace("'", "''")
        law_title = (n.get("law_title") or "").replace("'", "''")
        category = (n.get("category") or "other").replace("'", "''")
        norm_id = n["norm_id"].replace("'", "''")
        norm_title = (n.get("norm_title") or "").replace("'", "''")
        content = (n.get("content") or "").replace("'", "''")
        values_sql.append(
            f"('{law_key}', '{law_title}', '{category}', '{norm_id}', '{norm_title}', '{content}')"
        )

    # Use ON CONFLICT to handle duplicates
    sql = f"""
        INSERT INTO norms (law_key, law_title, category, norm_id, norm_title, content)
        VALUES {",".join(values_sql)}
        ON CONFLICT (law_key, norm_id) DO UPDATE SET
            law_title = EXCLUDED.law_title,
            category = EXCLUDED.category,
            norm_title = EXCLUDED.norm_title,
            content = EXCLUDED.content;
    """

    resp = requests.post(
        f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query",
        headers={
            "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"query": sql},
        timeout=60,
    )

    if resp.status_code not in (200, 201):
        print(f"  Batch FAILED (status {resp.status_code}): {resp.text[:200]}")
        return False

    return True


def main():
    print("Scrolling norms from Qdrant...")
    norms = scroll_all_norms()
    print(f"Scrolled {len(norms)} norms total.")

    # Before upsert, ensure we have a UNIQUE constraint on (law_key, norm_id)
    # The table has no unique constraint yet, so we need to add one
    print("Ensuring unique constraint on (law_key, norm_id)...")
    resp = requests.post(
        f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query",
        headers={
            "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        json={
            "query": """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'norms_law_key_norm_id_key'
                ) THEN
                    ALTER TABLE norms ADD CONSTRAINT norms_law_key_norm_id_key UNIQUE (law_key, norm_id);
                END IF;
            END
            $$;
            """
        },
        timeout=30,
    )
    if resp.status_code == 200:
        print("  Unique constraint ready.")
    else:
        print(f"  Warning: {resp.text[:200]}")

    # Upsert in batches
    total = len(norms)
    success = 0
    failed = 0
    t0 = time.time()

    for i in range(0, total, BATCH_SIZE):
        batch = norms[i : i + BATCH_SIZE]
        ok = upsert_batch(batch)
        if ok:
            success += len(batch)
        else:
            failed += len(batch)

        if (i // BATCH_SIZE) % 5 == 0 or ok is False:
            elapsed = time.time() - t0
            rate = success / elapsed if elapsed > 0 else 0
            print(
                f"  Progress: {success}/{total} upserted, {failed} failed "
                f"({rate:.0f} rows/s, {elapsed:.0f}s)"
            )

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.0f}s.")
    print(f"Success: {success}, Failed: {failed}")

    # Verify
    print("\nVerifying...")
    resp = requests.post(
        f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query",
        headers={
            "Authorization": f"Bearer {SUPABASE_ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"query": "SELECT COUNT(*) as cnt FROM norms;"},
        timeout=15,
    )
    if resp.status_code == 200:
        count = resp.json()[0]["cnt"]
        print(f"Row count in Supabase norms table: {count}")
    else:
        print(f"Verify failed: {resp.text[:200]}")


if __name__ == "__main__":
    main()
