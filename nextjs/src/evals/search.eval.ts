import { describe, it, expect } from "vitest";
import { searchNorms } from "../lib/qdrant";
import fs from "fs";
import path from "path";

// Load test cases
const testCasesPath = path.resolve(__dirname, "test-cases.json");
const testCases = JSON.parse(fs.readFileSync(testCasesPath, "utf-8"));

describe("Search Accuracy Evaluations", () => {
  it("should have loaded test cases", () => {
    expect(testCases.length).toBeGreaterThan(0);
  });

  for (const tc of testCases) {
    it(`evaluates query: "${tc.query}"`, async () => {
      // Direct call to the Qdrant search library function.
      // Note: This tests the semantic/vector search + BM25 reranking accuracy.
      // It bypasses the API rate limits and Next.js routing overhead.
      const results = await searchNorms(tc.query, tc.expected_category, 10, 0);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Extract the top 3 law keys returned
      const top3Keys = results.slice(0, 3).map((r) => r.law_key.trim());
      
      // Ensure the expected law key is in the top 3 results
      if (Array.isArray(tc.expected_law_key)) {
        const found = tc.expected_law_key.some((key: string) => top3Keys.includes(key));
        expect(found, `Expected top 3 to contain one of ${tc.expected_law_key.join(', ')} but got ${top3Keys}`).toBe(true);
      } else {
        expect(top3Keys).toContain(tc.expected_law_key);
      }

      // If a specific norm id was expected, verify it appears in the results
      if (tc.expected_norm_id) {
        const matchingNorm = results.find(
          (r) =>
            r.law_key.trim() === tc.expected_law_key &&
            r.norm_id.trim() === tc.expected_norm_id
        );
        expect(matchingNorm).toBeDefined();
      }
    });
  }
});
