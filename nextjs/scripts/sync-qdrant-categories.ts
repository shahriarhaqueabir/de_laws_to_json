/**
 * Sync Qdrant categories — reads law→category mapping from JSON file,
 * then scrolls Qdrant by law_key and sets payload.
 *
 * Usage:
 *   1. npx supabase db query --linked "SELECT json_agg(json_build_object('key', key, 'category', category) ORDER BY key) FROM public.laws;" > laws.json
 *   2. npx tsx nextjs/scripts/sync-qdrant-categories.ts nextjs/laws.json
 */
import fs from "fs";
import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION = "german_norms";

if (!QDRANT_URL || !QDRANT_API_KEY) {
  console.error("Missing QDRANT_URL or QDRANT_API_KEY env vars");
  process.exit(1);
}

const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });

interface Law {
  key: string;
  category: string;
}

function loadLaws(path: string): Law[] {
  const raw = fs.readFileSync(path, "utf-8");
  // The CLI output has "Initialising login role..." then the JSON array
  const jsonStart = raw.indexOf("[");
  if (jsonStart === -1) {
    console.error("No JSON array found in file");
    process.exit(1);
  }
  return JSON.parse(raw.slice(jsonStart));
}

async function updateQdrantForLaw(
  lawKey: string,
  category: string,
): Promise<number> {
  let updated = 0;
  let offset: string | number | null | undefined = undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      do {
        const result = await qdrant.scroll(COLLECTION, {
          filter: {
            must: [{ key: "law_key", match: { value: lawKey } }],
          },
          limit: 100,
          offset: offset,
        });

        const points = result.points || [];
        if (points.length === 0) break;

        await qdrant.setPayload(COLLECTION, {
          payload: { category },
          points: points.map((p: any) => p.id),
        });

        updated += points.length;
        offset = result.next_page_offset;
      } while (offset);

      break; // Success — exit retry loop
    } catch (err: any) {
      if (attempt === 2) throw err;
      console.error(`  Retry ${attempt + 1} for ${lawKey}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return updated;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx sync-qdrant-categories.ts <laws-json-file>");
    process.exit(1);
  }

  console.log("Loading laws...");
  const laws = loadLaws(filePath);
  console.log(`Loaded ${laws.length} laws`);

  // Report category distribution
  const byCategory: Record<string, number> = {};
  for (const law of laws) {
    byCategory[law.category] = (byCategory[law.category] || 0) + 1;
  }
  console.log("\nCategory distribution:");
  for (const [cat, count] of Object.entries(byCategory).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log("\nUpdating Qdrant categories...");
  let totalUpdated = 0;
  let errorCount = 0;

  for (let i = 0; i < laws.length; i++) {
    const { key, category } = laws[i];
    try {
      const count = await updateQdrantForLaw(key, category);
      totalUpdated += count;
      if (i % 500 === 0 || count > 0) {
        process.stdout.write(
          `  [${i + 1}/${laws.length}] ${key}: Q=${count} cat=${category}\n`,
        );
      }
    } catch (err: any) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`  ERROR [${key}]: ${err.message}`);
      }
    }
  }

  console.log(`\nDone. Total Qdrant points updated: ${totalUpdated}`);
  console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
