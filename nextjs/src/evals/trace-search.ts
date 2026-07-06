import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { searchNorms } from "../lib/qdrant";

async function trace(query: string, category?: string) {
  console.log(`\n===========================================`);
  console.log(`Tracing Query: "${query}" (Category: ${category || "none"})`);
  console.log(`===========================================`);
  
  // We'll call the search function. Since we didn't add console.logs in qdrant.ts,
  // we'll just look at the final scores first. If we need intermediate scores,
  // we can modify qdrant.ts.
  const results = await searchNorms(query, category, 10, 0);
  
  if (results.length === 0) {
    console.log("0 results found.");
    return;
  }
  
  console.log(`Top 5 results:`);
  results.slice(0, 5).forEach((r, i) => {
    console.log(`[${i+1}] ${r.law_key.padEnd(10)} | Score: ${r.score.toFixed(4)} | Norm: ${r.norm_id} | Title: ${r.law_title?.substring(0,30)}`);
  });
}

async function run() {
  await trace("custody rights for my child");
  await trace("speeding ticket on highway", "traffic");
  await trace("termination of employment contract");
  await trace("Mord");
}

run();
