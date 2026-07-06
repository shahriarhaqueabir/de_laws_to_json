import { QdrantClient } from "@qdrant/js-client-rest";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

const client = new QdrantClient({ url, apiKey });
const COLLECTION = "german_norms";

async function findSection(lawKey: string, normId?: string) {
  try {
    const filter: any = {
      must: [
        { key: "law_key", match: { value: lawKey } }
      ]
    };
    
    const res = await client.scroll(COLLECTION, {
      filter,
      limit: 100, // retrieve more so we can find our norm in memory
      with_payload: true
    });
    
    const matchingPoints = normId 
      ? res.points.filter(p => p.payload?.norm_id === normId)
      : res.points;
    
    if (matchingPoints.length > 0) {
      console.log(`✅ [${lawKey} ${normId || ""}] Found ${matchingPoints.length} matching points.`);
      matchingPoints.forEach(p => {
        console.log(`  - Norm: ${p.payload?.norm_id} | Title: ${p.payload?.norm_title}`);
        console.log(`    Content: ${String(p.payload?.content).substring(0, 100)}...`);
      });
    } else {
      console.log(`❌ [${lawKey} ${normId || ""}] Not found in Qdrant.`);
    }
  } catch (e) {
    console.error(`Error finding ${lawKey} ${normId}:`, e);
  }
}

async function run() {
  await findSection("StGB", "211"); // Mord
  await findSection("GG", "5"); // Freedom of speech
  await findSection("GG", "8"); // Freedom of assembly
  await findSection("BDSG", "1"); // Data protection scope
  await findSection("UStG", "12"); // VAT rates
  await findSection("SGB 6", "1"); // Pension insurance scope
  await findSection("AO", "370"); // Tax evasion
}

run();
