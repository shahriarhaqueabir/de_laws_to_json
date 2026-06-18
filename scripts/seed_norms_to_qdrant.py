import sqlite3
import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from tqdm import tqdm

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")
BATCH_SIZE = 100

if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set.")
    exit(1)

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

def seed_db():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "laws.db")
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    print("Fetching norms from SQLite...")
    cur.execute("""
        SELECT l.key as law_key, l.title as law_title, n.norm_id, n.title as norm_title, n.content, l.category
        FROM norms n
        JOIN laws l ON n.law_id = l.id
    """)
    rows = cur.fetchall()

    norm_points = []
    for row in rows:
        norm = dict(row)
        # Unique ID based on law and norm section
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"german-norm:{norm['law_key']}:{norm['norm_id']}"))

        norm_points.append(PointStruct(
            id=point_id,
            payload={
                "law_key": norm["law_key"],
                "law_title": norm["law_title"],
                "category": norm["category"] if norm.get("category") else "other",
                "norm_id": norm["norm_id"],
                "norm_title": norm["norm_title"],
                "content": norm["content"][:16384], # Increased for legal text depth
            },
            # With managed inference, we send an empty vector or
            # let Qdrant handle it if the collection is configured to embed a payload field.
            vector={}
        ))

    print(f"Loaded {len(norm_points)} norms. Starting upload...")

    # Upsert in batches
    for i in tqdm(range(0, len(norm_points), BATCH_SIZE)):
        batch = norm_points[i:i + BATCH_SIZE]
        client.upsert(collection_name="german_norms", points=batch)

    print("Seeding to Qdrant complete.")

if __name__ == '__main__':
    seed_db()
