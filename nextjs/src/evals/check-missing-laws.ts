import { QdrantClient } from "@qdrant/js-client-rest";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

const client = new QdrantClient({ url, apiKey });
const COLLECTION = "german_norms";

async function countPoints(lawKey: string) {
  try {
    const res = await client.scroll(COLLECTION, {
      filter: {
        must: [
          { key: "law_key", match: { value: lawKey } }
        ]
      },
      limit: 100,
      with_payload: true
    });
    console.log(`\n=== [${lawKey}] ===`);
    res.points.forEach(p => {
      console.log(`- Norm: ${p.payload?.norm_id} | Title: ${p.payload?.norm_title}`);
      console.log(`  Content: ${String(p.payload?.content).substring(0, 100)}...`);
    });
  } catch (e) {
    console.error(`Error counting ${lawKey}:`, e);
  }
}

async function run() {
  await countPoints("StGB");
  await countPoints("GG");
  await countPoints("BDSG");
  await countPoints("UStG");
  await countPoints("SGB 6");
  await countPoints("AO");
}

run();
