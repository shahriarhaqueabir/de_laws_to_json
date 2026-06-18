import os
from qdrant_client import QdrantClient, models

QDRANT_URL = os.environ.get("QDRANT_URL")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    print("Error: QDRANT_URL and QDRANT_API_KEY must be set in environment variables.")
    exit(1)

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

print(f"Connecting to Qdrant at {QDRANT_URL}...")

# Create collection with managed inference configuration
# Note: You should also select "intfloat/multilingual-e5-small" in the Qdrant Cloud Dashboard
# if the SDK doesn't support setting the inference model directly on creation for your tier.
client.recreate_collection(
    collection_name="german_norms",
    vectors_config=models.VectorParams(
        size=384,
        distance=models.Distance.COSINE,
    ),
    quantization_config=models.ScalarQuantization(
        scalar=models.ScalarQuantizationConfig(
            type="int8",
            always_ram=True,
        )
    ),
)

# Create payload indexes for performance
client.create_payload_index(
    collection_name="german_norms",
    field_name="law_key",
    field_schema=models.PayloadSchemaType.KEYWORD,
)
client.create_payload_index(
    collection_name="german_norms",
    field_name="category",
    field_schema=models.PayloadSchemaType.KEYWORD,
)

print("Collection 'german_norms' created successfully.")
