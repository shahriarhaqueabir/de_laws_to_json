"""
Fix law_key trailing spaces in Qdrant payloads.

Scrolls all points in the german_norms collection, checks if law_key has
trailing spaces, and updates the payload to strip them.

Usage:
    set QDRANT_URL, QDRANT_API_KEY
    python scripts/fix_law_key_trailing_spaces.py
"""

import json
import os
import sys
import time
import urllib.request

COLLECTION = "german_norms"
SLEEP_SEC = 1.0  # rate limit avoidance between API calls

_client_url = None
_client_api_key = None


def _request(path, body, method, retries=3):
    last_error = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                f"{_client_url}{path}",
                data=json.dumps(body).encode("utf-8"),
                headers={
                    "api-key": _client_api_key,
                    "Content-Type": "application/json",
                },
                method=method,
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                last_error = e
                print(
                    f"  [retry] HTTP {e.code} on {method} {path}, attempt {attempt + 1}/{retries}"
                )
                time.sleep(2**attempt)
            else:
                raise
        except (urllib.error.URLError, ConnectionResetError, TimeoutError) as e:
            last_error = e
            print(
                f"  [retry] {type(e).__name__} on {method} {path}, attempt {attempt + 1}/{retries}"
            )
            time.sleep(2**attempt)
    raise RuntimeError(
        f"Request failed after {retries} retries: {last_error}"
    ) from last_error


def qdrant_post(path, body):
    return _request(path, body, "POST")


def qdrant_put(path, body):
    return _request(path, body, "PUT")


def main():
    global _client_url, _client_api_key

    qdrant_url = os.environ.get("QDRANT_URL")
    qdrant_api_key = os.environ.get("QDRANT_API_KEY")

    if not qdrant_url or not qdrant_api_key:
        print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
        sys.exit(1)

    _client_url = qdrant_url.rstrip("/")
    _client_api_key = qdrant_api_key

    # ── Phase 1: Scroll all points ──
    print("=" * 60)
    print("Phase 1: Scrolling all points to find trailing-space law_keys...")
    print("=" * 60)

    to_fix = []
    offset = None
    total = 0

    while True:
        body = {"limit": 1000, "with_payload": True}
        if offset:
            body["offset"] = offset

        data = qdrant_post(f"/collections/{COLLECTION}/points/scroll", body)
        points = data["result"]["points"]
        if not points:
            break

        for p in points:
            total += 1
            lk = p["payload"].get("law_key", "")
            if lk != lk.strip():
                to_fix.append(
                    {
                        "id": p["id"],
                        "old_key": lk,
                        "new_key": lk.strip(),
                    }
                )

        offset = data["result"].get("next_page_offset")
        if total % 5000 == 0:
            print(f"  Scanned {total} points... found {len(to_fix)} issues so far")

        if not offset:
            break

    print(f"\n  Scanned {total} points total.")
    print(f"  Found {len(to_fix)} points with trailing-space law_keys.")

    if not to_fix:
        print("  ✓ No fixes needed!")
        return

    # Show affected law_keys (unique)
    unique_keys = sorted(set(item["old_key"] for item in to_fix))
    print(f"\n  Affected law_keys ({len(unique_keys)}):")
    for k in unique_keys:
        count = sum(1 for item in to_fix if item["old_key"] == k)
        print(f"    '{k}' → '{k.strip()}' ({count} points)")

    # ── Phase 2: Group all points by new_key and update ──
    print(f"\n{'=' * 60}")
    print(f"Phase 2: Grouping {len(to_fix)} points by law_key for efficient updates...")
    print("=" * 60)

    # Group ALL points by their target law_key
    grouped: dict[str, list[int]] = {}
    for item in to_fix:
        grouped.setdefault(item["new_key"], []).append(item["id"])

    print(f"  Unique law_keys to update: {len(grouped)}")
    print(f"  Total point ID array size: {len(to_fix)}")

    # Update one law_key group at a time, sending all its point IDs at once
    total_updated = 0
    key_count = 0
    for new_key, point_ids in sorted(grouped.items()):
        key_count += 1
        total_updated += len(point_ids)
        qdrant_put(
            f"/collections/{COLLECTION}/points/payload",
            {
                "payload": {"law_key": new_key},
                "points": point_ids,
            },
        )
        if key_count % 50 == 0:
            print(
                f"  Updated {total_updated}/{len(to_fix)} points ({key_count}/{len(grouped)} keys)"
            )
        time.sleep(SLEEP_SEC)

    # ── Phase 3: Verify ──
    print(f"\n{'=' * 60}")
    print("Phase 3: Verifying fix...")
    print("=" * 60)

    # Re-count issues
    still_broken = 0
    offset = None
    verify_count = 0
    while True:
        body = {"limit": 1000, "with_payload": True}
        if offset:
            body["offset"] = offset

        data = qdrant_post(f"/collections/{COLLECTION}/points/scroll", body)
        points = data["result"]["points"]
        if not points:
            break

        for p in points:
            verify_count += 1
            lk = p["payload"].get("law_key", "")
            if lk != lk.strip():
                still_broken += 1

        offset = data["result"].get("next_page_offset")
        if not offset:
            break

    print(f"  Verified {verify_count} points.")
    if still_broken:
        print(f"  ⚠ {still_broken} points still have trailing-space law_keys!")
    else:
        print("  ✓ All law_keys are clean!")

    print("\nDone.")


if __name__ == "__main__":
    main()
