import { QdrantClient } from "@qdrant/js-client-rest";
import { loadEnvConfig } from "@next/env";

// Load dev environment variables
loadEnvConfig(process.cwd());

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

if (!url || !apiKey) {
  console.error("Missing Qdrant config");
  process.exit(1);
}

const client = new QdrantClient({ url, apiKey });
const COLLECTION = "german_norms";

async function checkLaw(lawKey: string) {
  try {
    const res = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: "law_key", match: { value: lawKey } }
        ]
      },
      limit: 1,
      with_payload: true,
      with_vector: false
    });
    
    if (res.points.length > 0) {
      console.log(`✅ [${lawKey}] Found. Sample category: ${res.points[0].payload?.category}`);
    } else {
      console.log(`❌ [${lawKey}] Not found in Qdrant.`);
    }
  } catch (e) {
    console.error(`Error checking ${lawKey}:`, e);
  }
}

async function run() {
  console.log("Checking database for expected test cases...");
  await checkLaw("SGB 8");
  await checkLaw("StVG");
  await checkLaw("BGB");
  await checkLaw("StGB");
  await checkLaw("TzBfG");
  
  // Let's also check available categories
  console.log("\nQuerying random points to see available categories...");
  const sample = await client.scroll(COLLECTION, { limit: 10, with_payload: true });
  const categories = new Set();
  sample.points.forEach(p => categories.add(p.payload?.category));
  console.log("Sample categories found:", Array.from(categories));
}

run();
