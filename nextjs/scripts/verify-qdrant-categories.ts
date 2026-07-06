/**
 * Verify Qdrant categories — query specific laws to confirm sync.
 * Requires env vars: QDRANT_URL, QDRANT_API_KEY
 */
import { QdrantClient } from "@qdrant/js-client-rest";

const url = process.env.QDRANT_URL;
const key = process.env.QDRANT_API_KEY;
if (!url || !key) {
  console.error("Missing QDRANT_URL or QDRANT_API_KEY");
  process.exit(1);
}
const COLLECTION = "german_norms";
const qdrant = new QdrantClient({ url, apiKey: key });

const tests = [
  { key: "AlkStG", want: "finance" },
  { key: "AMG", want: "social" },
  { key: "AEG", want: "traffic" },
  { key: "AufenthG", want: "public" },
  { key: "AktG", want: "finance" },
  { key: "ArbGG", want: "labor" },
  { key: "FPackV", want: "consumer" },
  { key: "AnlGBlnV", want: "berlin" },
];

async function main() {
  let ok = true;
  for (const t of tests) {
    const r = await qdrant.scroll(COLLECTION, {
      filter: { must: [{ key: "law_key", match: { value: t.key } }] },
      limit: 1,
    });
    const cat = r.points?.[0]?.payload?.category;
    const match = cat === t.want;
    console.log(`${match ? "✅" : "❌"} ${t.key}: ${cat} ${match ? "" : `(expected ${t.want})`}`);
    if (!match) ok = false;
  }
  console.log(ok ? "\n✅ All verified" : "\n❌ Mismatches found");
  process.exit(ok ? 0 : 1);
}
main();
