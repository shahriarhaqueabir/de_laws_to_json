#!/usr/bin/env node
/**
 * Create a keyword payload index on law_key in the german_norms collection.
 * This speeds up scroll queries used by GET /api/laws/[key].
 */
const { QdrantClient } = require("@qdrant/js-client-rest");

async function main() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    console.error("Error: QDRANT_URL and QDRANT_API_KEY must be set");
    process.exit(1);
  }

  const client = new QdrantClient({ url, apiKey });
  const collection = process.env.COLLECTION || "german_norms";

  // Index law_key for efficient scroll/lookup
  try {
    await client.createPayloadIndex(collection, {
      field_name: "law_key",
      field_schema: "keyword",
    });
    console.log(`✓ Payload index created on law_key in ${collection}`);
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log(`- Index on law_key already exists in ${collection}`);
    } else {
      throw err;
    }
  }

  // Index category for filtered search queries
  try {
    await client.createPayloadIndex(collection, {
      field_name: "category",
      field_schema: "keyword",
    });
    console.log(`✓ Payload index created on category in ${collection}`);
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log(`- Index on category already exists in ${collection}`);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
