/**
 * German Law Abbreviation Matching — shared between search and chat routes.
 *
 * Common German law abbreviations matched against laws.key in Supabase.
 * This provides exact-match lookup BEFORE vector search, so queries
 * like "StVG" or "car accident StVO" immediately find the right law.
 *
 * Extended list covers all major German federal law abbreviations.
 */

export const KNOWN_LAW_KEYS = new Set([
  "StVG",
  "StVO",
  "StVZO",
  "FeV",
  "FZV",
  "BGB",
  "StGB",
  "KSchG",
  "BetrVG",
  "TzBfG",
  "MuSchG",
  "BUrlG",
  "EntgFG",
  "SGB_I",
  "SGB_III",
  "SGB_V",
  "SGB_VI",
  "SGB_IX",
  "SGB_XI",
  "GG",
  "VwVfG",
  "VwGO",
  "OWiG",
  "StPO",
  "ZPO",
  "GVG",
  "FamFG",
  "GKG",
  "RVG",
  "JGG",
  "BVerfGG",
  "BVerwG",
  "BGH",
  "AGBG",
  "UKlaG",
  "ProdHaftG",
  "StraBG",
  "EStG",
  "KStG",
  "GewStG",
  "UStG",
  "AO",
  "InsO",
  "EGInsO",
  "ZVG",
  "EnEV",
  "BImSchG",
  "KrWG",
  "WHG",
  "BNatSchG",
  "BauGB",
  "BauNVO",
  "HOAI",
  "BGB_InfoV",
  "PflVG",
  "VVG",
  "EGBGB",
  "BGBL",
  "BGBl",
  "HGB",
  "AktG",
  "GmbHG",
  "GenG",
  "PatG",
  "MarkenG",
  "UrhG",
  "GeschmMG",
  "UWG",
  "GWB",
  "WpHG",
  "KWG",
  "VAG",
  "FMAB",
  "PAngV",
  "BDSG",
  "DSGVO",
  "TTDSG",
  "TKG",
  "MStVG",
  "LuftVG",
  "PBefG",
  "AEG",
  "GüKG",
  "SeeArbG",
  "FlagGR",
  "BinSchVG",
  "AufenthG",
  "AsylG",
  "StAG",
  "FreizügG/EU",
  "BEEG",
  "Elterngeld",
  "SGB_II",
  "SGB_XII",
  "WoGG",
  "WEG",
  "MietR",
  "HeizkostenV",
  "BetrKV",
  "IStGH",
  "ZAG",
  "AWG",
  "KrWaffKontrG",
]);

/**
 * Extract potential law keys from a query string.
 * Matches uppercase abbreviations like StVG, StVO, BGB, etc.
 */
export function extractLawKeys(query: string): string[] {
  // Match patterns: standalone uppercase abbreviations with 2-8 chars
  // Optionally with hyphen, slash, or underscore
  const pattern =
    /\b([A-Z][A-Za-z0-9]{1,7}(?:[-/][A-Z][A-Za-z0-9]*)?(?:_[A-Z]+)?)\b/g;
  const found: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(query)) !== null) {
    const candidate = match[1];
    if (KNOWN_LAW_KEYS.has(candidate) && !seen.has(candidate)) {
      found.push(candidate);
      seen.add(candidate);
    }
  }
  return found;
}
