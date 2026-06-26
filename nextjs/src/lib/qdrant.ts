import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION = "german_norms";
export const INFERENCE_MODEL = "intfloat/multilingual-e5-small";

let qdrantClient: QdrantClient | null = null;

/**
 * Get the Qdrant client, or return null if not configured.
 * This allows callers to gracefully degrade instead of crashing.
 */
function getQdrant(): QdrantClient | null {
  if (qdrantClient) return qdrantClient;
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    console.warn(
      "[Qdrant] QDRANT_URL/QDRANT_API_KEY not configured. Qdrant search unavailable.",
    );
    return null;
  }
  qdrantClient = new QdrantClient({ url, apiKey });
  return qdrantClient;
}

export interface SearchResult {
  law_key: string;
  law_title: string;
  category: string;
  norm_id: string;
  norm_title: string;
  content: string;
  score: number;
}

/**
 * Extract significant keywords from a query for reranking purposes.
 * Strips common stop words and short terms, returns unique lowercase terms.
 */
function extractQueryKeywords(query: string): Set<string> {
  const STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "may",
    "might",
    "must",
    "can",
    "could",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "it",
    "they",
    "them",
    "their",
    "this",
    "that",
    "these",
    "those",
    "in",
    "on",
    "at",
    "by",
    "to",
    "for",
    "of",
    "with",
    "from",
    "into",
    "about",
    "and",
    "or",
    "but",
    "not",
    "what",
    "which",
    "who",
    "whom",
    "how",
    "when",
    "where",
    "why",
    "if",
    "then",
    "else",
    "so",
    "no",
    "off",
    "out",
    "up",
    "down",
    "just",
    "very",
    "too",
    "really",
    "already",
    "also",
    "get",
    "got",
    "need",
    "want",
    "ask",
    "tell",
    "know",
    "think",
    "oh",
    "hi",
    "hello",
    "hey",
    // German stop words
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "eines",
    "und",
    "oder",
    "aber",
    "nicht",
    "ist",
    "sind",
    "war",
    "waren",
    "hat",
    "haben",
    "hatte",
    "wird",
    "werden",
    "wurde",
    "kann",
    "können",
    "muss",
    "müssen",
    "bei",
    "mit",
    "nach",
    "vor",
    "zu",
    "auf",
    "aus",
    "in",
    "über",
    "unter",
    "für",
    "gegen",
    "ohne",
    "um",
    "durch",
  ]);
  const keywords = new Set<string>();
  for (const word of query.toLowerCase().split(/\s+/)) {
    const clean = word.replace(/^[^a-zA-ZäöüßÄÖÜ]+|[^a-zA-ZäöüßÄÖÜ]+$/g, "");
    if (clean.length >= 3 && !STOP_WORDS.has(clean)) {
      keywords.add(clean);
    }
  }
  return keywords;
}

/**
 * Rerank search results by boosting results whose norm_title or law_title
 * contains keywords from the search query, and preferring laws with
 * multiple matching norms.
 */
function rerankByKeywords(
  results: SearchResult[],
  query: string,
): SearchResult[] {
  if (results.length === 0 || !query.trim()) return results;

  const keywords = extractQueryKeywords(query);
  if (keywords.size === 0) return results;

  // For each result, compute a keyword boost factor (0.0 to 0.5)
  const boosted = results.map((r) => {
    let boost = 0;
    const searchText = (
      (r.law_title || "") +
      " " +
      (r.norm_title || "") +
      " " +
      (r.law_key || "") +
      " " +
      (r.norm_id || "")
    ).toLowerCase();

    for (const kw of keywords) {
      if (searchText.includes(kw)) {
        boost += 0.1;
      }
    }

    // Cap boost and apply
    boost = Math.min(boost, 0.5);
    return { ...r, score: r.score * (1 + boost) };
  });

  // Re-sort by boosted score
  boosted.sort((a, b) => b.score - a.score);
  return boosted;
}

/**
 * Group results by law_key and prefer laws with multiple norm hits.
 * Returns up to topK results, with a diversity bonus for laws that
 * have multiple matching norms (suggests broad relevance).
 */
function boostLawDiversity(
  results: SearchResult[],
  topK: number,
): SearchResult[] {
  if (results.length === 0) return results;

  // Count norms per law
  const lawCounts = new Map<string, number>();
  for (const r of results) {
    lawCounts.set(r.law_key, (lawCounts.get(r.law_key) || 0) + 1);
  }

  // Apply diversity boost: laws with multiple norms get a bonus
  // But also cap per-law representation to prevent one law from dominating
  // (e.g., ArbGG with 20 procedural norms drowning out KSchG/BGB)
  const MAX_PER_LAW = Math.max(3, Math.ceil(topK * 0.25)); // max 25% from one law, min 3
  let perLawCount = new Map<string, number>();

  const boosted = results
    .map((r) => {
      const count = lawCounts.get(r.law_key) || 1;
      // Bonus: +2% per additional norm hit (capped at +20%)
      const diversityBoost = 1 + Math.min(0.2, (count - 1) * 0.02);
      return { ...r, score: r.score * diversityBoost };
    })
    .filter((r) => {
      // Enforce per-law cap after diversity boost
      const current = perLawCount.get(r.law_key) || 0;
      if (current >= MAX_PER_LAW) return false;
      perLawCount.set(r.law_key, current + 1);
      return true;
    });

  // Re-sort after diversity boost and filtering
  boosted.sort((a, b) => b.score - a.score);
  return boosted.slice(0, topK);
}

/**
 * Expand a short/poor query with category context to improve vector search.
 * When no category is detected, this helps guide the embedding toward
 * relevant legal domains.
 */
function expandQuery(query: string, category?: string): string {
  if (!query.trim()) return query;

  // If we have a category, prepend a German domain term to help E5-small
  // focus on the right legal area
  const DOMAIN_TERMS: Record<string, string> = {
    labor:
      "Arbeitsrecht Kündigung Arbeitnehmer Arbeitgeber Kündigungsschutz BGB KSchG BetrVG TzBfG Arbeitsvertrag",
    traffic:
      "Verkehrsrecht Straßenverkehr Unfall Kfz StVG StVO Fahrerlaubnis Haftung Schadensersatz Kraftfahrzeug",
    housing:
      "Mietrecht Wohnung Miete Vermieter Mieter BGB Mietvertrag Nebenkosten",
    consumer: "Verbraucherschutz Kauf Vertrag Widerruf BGB Gewährleistung",
    criminal: "Strafrecht Straftat StGB Ordnungswidrigkeit OWiG",
    family: "Familienrecht Scheidung Sorgerecht Unterhalt BGB Sorgeerklärung",
    social: "Sozialrecht Krankenversicherung Rente SGB Sozialgesetzbuch",
    finance: "Steuerrecht Einkommensteuer Finanzen AO EStG",
    public: "Verwaltungsrecht Grundgesetz GG Behörde VwVfG",
    tech: "Umweltrecht Energie Digitalisierung BImSchG EEG",
    berlin: "Berlin Landesrecht",
  };

  if (category && DOMAIN_TERMS[category]) {
    // Prepend domain terms so the embedding captures the legal domain
    return `${DOMAIN_TERMS[category]} ${query}`;
  }

  return query;
}

export async function searchNorms(
  query: string,
  category?: string,
  topK: number = 50,
  offset: number = 0,
): Promise<SearchResult[]> {
  const filter: { must: Array<Record<string, unknown>> } = { must: [] };

  if (category) {
    filter.must.push({ key: "category", match: { value: category } });
  }

  const queryFilter = filter.must.length > 0 ? filter : undefined;

  // Expand query with domain terms for better vector focus
  const expandedQuery = expandQuery(query, category);

  console.log(
    `[Qdrant lib] Searching${
      category ? ` (category: ${category})` : ""
    }: "${expandedQuery}" → topK: ${topK}`,
  );

  const client = getQdrant();

  // Graceful fallback: if Qdrant is not configured, return empty results
  // The API route will handle the fallback to Supabase text search
  if (!client) {
    console.warn(
      "[Qdrant lib] Qdrant not configured — returning empty results for fallback.",
    );
    return [];
  }

  // Qdrant Universal Query API with Managed Inference
  // E5-small requires "query: " prefix on search queries
  // The indexed documents use "passage: " prefix
  // Without this prefix, embeddings don't match — results are random
  const prefixedQuery = `query: ${expandedQuery}`;

  try {
    const results = await client.query(COLLECTION, {
      query: {
        text: prefixedQuery,
        model: INFERENCE_MODEL,
      },
      limit: topK,
      offset,
      filter: queryFilter,
      with_payload: true,
    });

    console.log(
      `[Qdrant lib] Search success. Points found: ${results.points.length}`,
    );

    let parsed = results.points
      .map((r) => {
        const payload = r.payload as Record<string, unknown> | undefined;
        return {
          law_key: (payload?.law_key as string) ?? "",
          law_title:
            ((payload?.law_title as string) || (payload?.law_key as string)) ??
            "",
          category: (payload?.category as string) ?? "other",
          norm_id: (payload?.norm_id as string) ?? "",
          norm_title: (payload?.norm_title as string) ?? "",
          content: (payload?.content as string) ?? "",
          score: r.score ?? 0,
        };
      })
      .filter(
        (r) =>
          r.content.trim() &&
          r.content !== "(weggefallen)" &&
          !r.norm_title.includes("(weggefallen)"),
      );

    // Apply keyword-based reranking to boost results whose title matches the query
    if (parsed.length > 0) {
      parsed = rerankByKeywords(parsed, query);
      // Apply law-level diversity boost
      parsed = boostLawDiversity(parsed, topK);
    }

    return parsed;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Qdrant lib] Search error: ${message}`);
    // Return empty instead of throwing — API route will degrade gracefully
    return [];
  }
}
