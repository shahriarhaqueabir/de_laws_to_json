"""
Creates a Qdrant payload index on the `law_key` field for the `german_norms` collection.
This optimizes filtered scroll queries used by the /api/laws/[key] endpoint.

Usage:
    python scripts/create_qdrant_index.py

Requires:
    QDRANT_URL and QDRANT_API_KEY environment variables
"""

import os
import sys

import requests


def main():
    url = os.environ.get("QDRANT_URL")
    api_key = os.environ.get("QDRANT_API_KEY")

    if not url or not api_key:
        print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
        sys.exit(1)

    # Normalize URL
    url = url.rstrip("/")
    index_url = f"{url}/collections/german_norms/index"

    payload = {"field_name": "law_key", "field_type": "keyword"}

    headers = {"api-key": api_key, "Content-Type": "application/json"}

    print(f"Creating keyword index on 'law_key' for collection 'german_norms'...")
    print(f"PUT {index_url}")

    response = requests.put(index_url, json=payload, headers=headers)

    if response.status_code in (200, 201):
        print("✅ Payload index created successfully.")
        print(f"Response: {response.json()}")
    elif response.status_code == 409:
        print("ℹ️ Index already exists (HTTP 409). Nothing to do.")
    else:
        print(f"❌ Failed to create index: HTTP {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)


if __name__ == "__main__":
    main()
