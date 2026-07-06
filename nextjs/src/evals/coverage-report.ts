import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);

import { createClient } from "@supabase/supabase-js";
import { QdrantClient } from "@qdrant/js-client-rest";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});
const COLLECTION = "german_norms";

// Known categories in the app (lowercase as stored in DB)
const EXPECTED_CATEGORIES = [
  "criminal", "labor", "family", "traffic",
  "housing", "consumer", "social", "finance",
  "public", "tech", "other", "berlin",
];

// Known landmark German laws that MUST be present per category
const LANDMARK_LAWS: Record<string, string[]> = {
  criminal: ["StGB", "StPO"],
  labor:    ["KSchG", "BUrlG", "ArbZG", "MiLoG", "TzBfG", "AGG", "ArbGG"],
  family:   ["SGB 8", "BEEG", "MuSchG", "BGB", "LPartG"],
  traffic:  ["StVG", "StVO", "FeV"],
  housing:  ["WoGG", "WoBindG"],
  consumer: ["UrhG", "MarkenG", "UWG"],
  social:   ["SGB 5", "SGB 6", "SGB 9", "SGB 3", "AsylbLG", "BEEG"],
  finance:  ["EStG", "InsO", "AktG", "BBankG"],
  public:   ["GG", "VwVfG", "AufenthG", "BImSchG", "GwG"],
  tech:     ["TKG", "TTDSG", "BDSG", "UrhG", "TMG"],
  other:    ["BGB", "HGB", "ZPO", "GVG"],
  berlin:   [],
};

async function getCategorySummary() {
  // 1. Get all laws from Supabase grouped by category
  const { data: laws, error } = await supabase
    .from("laws")
    .select("key, title, category, status")
    .order("category");

  if (error) throw error;

  const lawsByCategory: Record<string, typeof laws> = {};
  for (const law of laws ?? []) {
    const cat = law.category || "unknown";
    if (!lawsByCategory[cat]) lawsByCategory[cat] = [];
    lawsByCategory[cat].push(law);
  }

  // 2. Get Qdrant norm counts per category
  const qdrantCountByCategory: Record<string, number> = {};
  for (const cat of Object.keys(lawsByCategory)) {
    try {
      const res = await qdrant.count(COLLECTION, {
        filter: { must: [{ key: "category", match: { value: cat } }] },
        exact: false,
      });
      qdrantCountByCategory[cat] = res.count;
    } catch {
      qdrantCountByCategory[cat] = -1; // error
    }
  }

  // 3. Print the coverage report
  console.log("\n=================================================================");
  console.log(" CATEGORY COVERAGE REPORT");
  console.log("=================================================================\n");

  const allCategories = new Set([
    ...Object.keys(lawsByCategory),
    ...EXPECTED_CATEGORIES,
  ]);

  for (const cat of Array.from(allCategories).sort()) {
    const categoryLaws = lawsByCategory[cat] ?? [];
    const lawKeys = categoryLaws.map(l => l.key);
    const normCount = qdrantCountByCategory[cat] ?? 0;
    const landmark = LANDMARK_LAWS[cat] ?? [];
    const missing = landmark.filter(k => !lawKeys.includes(k));

    console.log(`\n📂 Category: ${cat.toUpperCase()}`);
    console.log(`   Laws in DB:     ${categoryLaws.length}`);
    console.log(`   Norms in Qdrant: ${normCount === -1 ? "ERROR" : normCount}`);
    
    if (missing.length > 0) {
      console.log(`   ⚠️  MISSING landmark laws: ${missing.join(", ")}`);
    } else if (landmark.length > 0) {
      console.log(`   ✅ All landmark laws present`);
    }
    
    // Show all law keys for the category
    if (lawKeys.length > 0) {
      console.log(`   Laws: ${lawKeys.sort().join(", ")}`);
    } else {
      console.log(`   ❌ NO LAWS FOUND in this category`);
    }

    // Check for laws in Supabase but not in Qdrant (data gap)
  }

  // 4. Spot-check: laws in Supabase not indexed in Qdrant at all
  console.log("\n=================================================================");
  console.log(" DATA CONSISTENCY: Laws in Supabase vs Qdrant");
  console.log("=================================================================\n");

  const { data: qSample } = await supabase
    .from("laws")
    .select("key, category")
    .limit(500);

  const qdrantMissing: string[] = [];
  for (const law of qSample ?? []) {
    try {
      const res = await qdrant.count(COLLECTION, {
        filter: { must: [{ key: "law_key", match: { value: law.key } }] },
        exact: false,
      });
      if (res.count === 0) {
        qdrantMissing.push(`${law.key} (${law.category})`);
      }
    } catch {
      // skip
    }
  }

  if (qdrantMissing.length === 0) {
    console.log("✅ All spot-checked laws have at least 1 norm indexed in Qdrant.");
  } else {
    console.log(`⚠️  ${qdrantMissing.length} laws found in Supabase but NOT indexed in Qdrant:`);
    qdrantMissing.forEach(k => console.log(`   - ${k}`));
  }

  console.log("\n=================================================================\n");
}

getCategorySummary();
