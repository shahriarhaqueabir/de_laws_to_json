import { QdrantClient } from "@qdrant/js-client-rest";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

const client = new QdrantClient({ url, apiKey });
const COLLECTION = "german_norms";

async function run() {
  console.log("Listing unique laws in Qdrant...");
  
  let offset: any = undefined;
  const lawKeys = new Set<string>();
  
  // Scroll through to get a list of law keys
  for (let i = 0; i < 20; i++) {
    const res = await client.scroll(COLLECTION, {
      limit: 100,
      offset,
      with_payload: true,
      with_vector: false
    });
    
    res.points.forEach(p => {
      if (p.payload?.law_key) {
        lawKeys.add(p.payload.law_key as string);
      }
    });
    
    offset = res.next_page_offset ?? undefined;
    if (!offset) break;
  }
  
  console.log("Found law keys in Qdrant:", Array.from(lawKeys).sort());
}

run();
