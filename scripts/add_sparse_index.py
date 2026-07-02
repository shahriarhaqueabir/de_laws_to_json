#!/usr/bin/env python3
"""Add sparse vector index to the german_norms Qdrant collection.

Run before reindexing to enable hybrid search support.

Usage:
    export QDRANT_URL=... QDRANT_API_KEY=...
    python scripts/add_sparse_index.py
"""

import os

from qdrant_client import QdrantClient
from qdrant_client.models import (
    SparseIndexParams,
    SparseVectorConfig,
    SparseVectorParams,
)

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
COLLECTION = "german_norms"

if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError("QDRANT_URL and QDRANT_API_KEY required")

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# Get current collection info
info = client.get_collection(COLLECTION)
print(f"Current collection: {COLLECTION}")
print(f"  Dense vectors: {info.config.params.vectors}")
print(f"  Existing sparse vectors: {info.config.params.sparse_vectors}")

# Check if sparse bm25 already exists
existing_sparse = info.config.params.sparse_vectors or {}
if "bm25" in existing_sparse:
    print("Sparse 'bm25' vector already configured. No changes needed.")
else:
    # Add sparse vector configuration
    client.update_collection(
        COLLECTION,
        sparse_vectors_config=SparseVectorConfig(
            vectors={
                "bm25": SparseVectorParams(
                    index=SparseIndexParams(
                        on_disk=False,
                    )
                )
            }
        ),
    )
    print("Added 'bm25' sparse vector configuration.")

# Verify
info = client.get_collection(COLLECTION)
print(f"\nUpdated collection sparse vectors: {info.config.params.sparse_vectors}")
