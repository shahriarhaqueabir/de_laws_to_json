import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);

import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Supabase paginates at 1000 rows — fetch all pages
  let allLaws: { category: string; key: string }[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await sb
      .from("laws")
      .select("key, category")
      .range(from, from + PAGE - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allLaws = allLaws.concat(data as any);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Group by category
  const byCategory: Record<string, string[]> = {};
  for (const law of allLaws) {
    const cat = law.category || "null";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(law.key);
  }

  const cats = Object.keys(byCategory).sort();
  console.log(`\nTotal laws fetched: ${allLaws.length}`);
  console.log(`\nDistinct categories (${cats.length}):`);
  for (const cat of cats) {
    console.log(`  [${cat}] → ${byCategory[cat].length} laws`);
  }
  console.log("\nFull category list:", JSON.stringify(cats));
}

main();
