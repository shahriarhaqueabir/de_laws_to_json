import { describe, it, expect } from "vitest";
import { detectCategory, getAllCategories, CATEGORIES } from "../category-detect";

describe("detectCategory", () => {
  // ── Basic Detection ──

  it("detects traffic category from German keywords", () => {
    expect(detectCategory("verkehrsunfall schaden")).toBe("traffic");
    expect(detectCategory("geschwindigkeitsüberschreitung bußgeld")).toBe("traffic");
    expect(detectCategory("führerschein entzug")).toBe("traffic");
  });

  it("detects traffic category from English keywords", () => {
    expect(detectCategory("car accident")).toBe("traffic");
    expect(detectCategory("speeding ticket")).toBe("traffic");
    expect(detectCategory("driving license suspension")).toBe("traffic");
  });

  it("detects labor category", () => {
    expect(detectCategory("kündigung arbeit")).toBe("labor");
    expect(detectCategory("unfair dismissal")).toBe("labor");
    expect(detectCategory("abfindung arbeitsvertrag")).toBe("labor");
  });

  it("detects housing category", () => {
    expect(detectCategory("mietvertrag kündigung wohnung")).toBe("housing");
    expect(detectCategory("rent reduction mold")).toBe("housing");
    expect(detectCategory("mieterhöhung")).toBe("housing");
  });

  it("detects family category", () => {
    expect(detectCategory("scheidung kindesunterhalt")).toBe("family");
    expect(detectCategory("child custody")).toBe("family");
    expect(detectCategory("sorgerecht")).toBe("family");
  });

  it("detects consumer category", () => {
    expect(detectCategory("widerruf kaufvertrag")).toBe("consumer");
    expect(detectCategory("product warranty return")).toBe("consumer");
    expect(detectCategory("gewährleistung")).toBe("consumer");
  });

  it("detects criminal category", () => {
    expect(detectCategory("strafrecht diebstahl anwalt")).toBe("criminal");
    expect(detectCategory("criminal defense lawyer")).toBe("criminal");
    expect(detectCategory("strafverteidiger")).toBe("criminal");
  });

  it("detects public category", () => {
    expect(detectCategory("widerspruch bescheid")).toBe("public");
    expect(detectCategory("verwaltungsakt anfechtung")).toBe("public");
  });

  it("detects social category", () => {
    expect(detectCategory("krankenkasse leistung")).toBe("social");
    expect(detectCategory("social benefits hartz4")).toBe("social");
  });

  it("detects finance category", () => {
    expect(detectCategory("steuererklärung finanzamt")).toBe("finance");
    expect(detectCategory("tax return")).toBe("finance");
  });

  it("detects tech category", () => {
    expect(detectCategory("umweltrecht klima")).toBe("tech");
    expect(detectCategory("renewable energy solar")).toBe("tech");
    expect(detectCategory("künstliche intelligenz digitalisierung")).toBe("tech");
  });

  it("detects berlin category", () => {
    expect(detectCategory("berliner gesetz")).toBe("berlin");
    expect(detectCategory("landesrecht berlin")).toBe("berlin");
  });

  // ── Long Query Handling ──

  it("detects category in long conversational queries", () => {
    const longQuery =
      "I was in a car accident in Berlin last week, the other driver ran a red light and hit my car. My car is damaged and I'm injured. What should I do?";
    expect(detectCategory(longQuery)).toBe("traffic");
  });

  it("detects labor in long German queries", () => {
    const longQuery =
      "Ich wurde nach 10 Jahren Betriebszugehörigkeit ohne Vorwarnung gekündigt. Mein Arbeitgeber sagt, es sei betriebsbedingt, aber ich glaube, die Kündigung war sozial ungerechtfertigt. Habe ich Anspruch auf Abfindung?";
    expect(detectCategory(longQuery)).toBe("labor");
  });

  // ── No Match / Low Score ──

  it("returns undefined for empty query", () => {
    expect(detectCategory("")).toBeUndefined();
  });

  it("returns undefined for very short query (below 3 chars)", () => {
    expect(detectCategory("ab")).toBeUndefined();
  });

  it("returns undefined for gibberish with no legal keywords", () => {
    expect(detectCategory("blue elephant moonwalk")).toBeUndefined();
  });

  it("returns undefined for threshold too high", () => {
    // Single keyword match has low score — high threshold should filter it
    const result = detectCategory("arbeit", 0.9);
    expect(result).toBeUndefined();
  });

  // ── Margin-Based Disambiguation ──

  it("disambiguates between close categories via margin boost", () => {
    // "Kündigung" matches both housing (Mietvertrag kündigung) and labor (kündigung arbeit)
    // Adding context words should push toward the correct one
    expect(detectCategory("kündigung arbeitnehmer arbeitgeber abfindung")).toBe("labor");
    expect(detectCategory("mietmangel schimmel wohnung mieterhöhung")).toBe("housing");
  });

  it("returns undefined for ambiguous input with no clear winner", () => {
    // Short ambiguous input that could match multiple categories weakly
    const result = detectCategory("recht");
    // "recht" is broad — may match several categories weakly, none above margin
    // This could be undefined or some category depending on scoring
    expect(typeof result).toBe("undefined");
  });

  // ── Custom Threshold ──

  it("uses custom threshold", () => {
    // With very high threshold, a weak match should fail
    expect(detectCategory("auto verkehr", 0.99)).toBeUndefined();
    // With very low threshold, the same query succeeds
    expect(detectCategory("auto verkehr", 0.01)).toBe("traffic");
  });

  // ── Edge Cases ──

  it("handles mixed case queries", () => {
    expect(detectCategory("VERKEHRSUNFALL SCHADEN")).toBe("traffic");
    expect(detectCategory("Kündigung Arbeit")).toBe("labor");
  });

  it("handles queries with special characters and punctuation", () => {
    expect(detectCategory("Kündigung! Was tun? Arbeitgeber hat gekündigt.")).toBe("labor");
  });

  it("handles whitespace-heavy queries", () => {
    expect(detectCategory("   verkehrsunfall   schaden   ")).toBe("traffic");
  });
});

describe("getAllCategories", () => {
  it("returns all category keys except 'other'", () => {
    const categories = getAllCategories();
    expect(categories).not.toContain("other");
    expect(categories.length).toBeGreaterThan(5);
  });

  it("every category has a matching entry in CATEGORIES", () => {
    const allCategories = getAllCategories();
    const categoryKeys = CATEGORIES.map((c) => c.key);
    for (const cat of allCategories) {
      expect(categoryKeys).toContain(cat);
    }
  });
});

describe("CATEGORIES", () => {
  it("has the expected structure", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(10);
    for (const cat of CATEGORIES) {
      expect(cat).toHaveProperty("key");
      expect(cat).toHaveProperty("label");
      expect(typeof cat.key).toBe("string");
      expect(typeof cat.label).toBe("string");
    }
  });
});
