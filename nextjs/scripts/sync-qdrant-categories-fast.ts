/**
 * Fast Qdrant category sync — scroll ALL points, compare, then batch-update changed ones.
 *
 * Usage:
 *   cd nextjs
 *   QDRANT_URL=... QDRANT_API_KEY=... npx tsx scripts/sync-qdrant-categories-fast.ts laws.json
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
  const jsonStart = raw.indexOf("[");
  if (jsonStart === -1) {
    console.error("No JSON array found in file");
    process.exit(1);
  }
  return JSON.parse(raw.slice(jsonStart));
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx sync-qdrant-categories-fast.ts <laws-json-file>");
    process.exit(1);
  }

  console.log("Loading laws...");
  const laws = loadLaws(filePath);
  console.log(`Loaded ${laws.length} laws`);

  // Build law_key → category map
  const lawCategory = new Map<string, string>();
  for (const law of laws) {
    lawCategory.set(law.key, law.category);
  }

  // Scroll ALL points from Qdrant (107k+)
  console.log("Scrolling all Qdrant points...");
  const pointsToUpdate: Record<string, { id: string; law_key: string; newCat: string }[]> = {};
  let totalPoints = 0;
  let offset: string | number | null | undefined = undefined;

  do {
    const result = await qdrant.scroll(COLLECTION, {
      limit: 500,
      offset: offset,
    });
    const pts = result.points || [];
    totalPoints += pts.length;

    for (const pt of pts) {
      const payload = pt.payload || {};
      const lawKey = (payload as any).law_key as string;
      const currentCat = (payload as any).category as string;
      const newCat = lawCategory.get(lawKey);

      if (newCat && newCat !== currentCat) {
        const key = newCat as string;
        if (!pointsToUpdate[key]) pointsToUpdate[key] = [];
        pointsToUpdate[key].push({ id: pt.id as string, law_key: lawKey, newCat });
      }
    }

    offset = result.next_page_offset;
    if (totalPoints % 10000 === 0) {
      console.log(`  Scanned ${totalPoints} points...`);
    }
  } while (offset);

  console.log(`\nTotal Qdrant points: ${totalPoints}`);
  console.log(`Laws needing category update: ${Object.values(pointsToUpdate).flat().length}`);

  // Batch update by category
  for (const [cat, pts] of Object.entries(pointsToUpdate)) {
    // Split into batches of 500 to avoid payload size limits
    for (let i = 0; i < pts.length; i += 500) {
      const batch = pts.slice(i, i + 500);
      await qdrant.setPayload(COLLECTION, {
        payload: { category: cat },
        points: batch.map((p) => p.id),
      });
      console.log(`  Updated ${cat}: ${i + batch.length}/${pts.length}`);
    }
  }

  console.log("\nDone!");
  console.log(`Total points updated: ${Object.values(pointsToUpdate).flat().length}`);
}

main().catch(console.error);
