import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { searchNorms } from "../../../lib/qdrant";
import { getServerClient } from "../../../lib/supabase-server";
import { errorResponse } from "../../../lib/api-utils";
import {
  translateQueryToGerman,
  translateFromGerman,
} from "../../../lib/translate-server";
import { detectCategory } from "../../../lib/category-detect";
import { type AppLanguage, LANGUAGE_NAMES } from "../../../lib/types";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../lib/rate-limiter";

// ── German Law Abbreviation Matching ──
// Common German law abbreviations matched against laws.key in Supabase.
// This provides exact-match lookup BEFORE the vector search, so queries
// like "StVG" or "car accident StVO" immediately find the right law.
// Extended list covers all major German federal law abbreviations.
const KNOWN_LAW_KEYS = new Set([
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
function extractLawKeys(query: string): string[] {
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

interface SearchResult {
  law_key: string;
  law_title: string;
  category: string;
  norm_id?: string;
  norm_title?: string;
  content?: string;
  score?: number;
}

const SearchParamsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  lang: z.string().optional().default("de"),
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v || "1", 10);
      if (isNaN(n) || n < 1 || n > 100) return 1;
      return n;
    }),
});

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const rawQ = req.nextUrl.searchParams.get("q") || undefined;
  const rawCategory = req.nextUrl.searchParams.get("category") || undefined;
  const rawPage = req.nextUrl.searchParams.get("page") || undefined;
  const rawLang = req.nextUrl.searchParams.get("lang") || "de";

  const parsed = SearchParamsSchema.safeParse({
    q: rawQ,
    category: rawCategory,
    lang: rawLang,
    page: rawPage,
  });

  if (!parsed.success) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    );
  }

  const { q: query, category, lang, page } = parsed.data;
  const safeQuery = (query || "").trim();

  // Rate limiting
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
    ip,
    DEFAULT_SEARCH_RATE_LIMIT,
  );
  if (!allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please wait before trying again.",
        },
      },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  try {
    let allResults: SearchResult[] = [];

    if (safeQuery) {
      // ── PHASE 0: Law Abbreviation Pre-Search ──
      // Before hitting Qdrant, check if the query mentions known German law
      // abbreviations (StVG, StVO, BGB, etc.) via exact key match.
      // This catches the most common short queries and ensures exact law hits.
      const cookieStore = await cookies();
      const supabase = getServerClient(cookieStore);
      const matchedLawKeys = extractLawKeys(safeQuery);

      if (matchedLawKeys.length > 0) {
        console.log(
          `[API Search] Found law abbreviation(s) in query: ${matchedLawKeys.join(", ")}`,
        );
        try {
          const { data: laws, error: dbError } = await supabase
            .from("laws")
            .select("*")
            .in("key", matchedLawKeys)
            .limit(20);

          if (!dbError && laws && laws.length > 0) {
            const exactMatches = laws.map((l) => ({
              law_key: l.key,
              law_title: l.title,
              category: l.category,
              norm_id: "",
              norm_title: "",
              content: `${l.title} — ${l.alt_title || ""}`.trim(),
              score: 0.95, // High score ensures these appear above vector results
            }));
            allResults.push(...exactMatches);
            console.log(
              `[API Search] Keyword pre-search returned ${exactMatches.length} exact law matches.`,
            );
          }
        } catch (kwErr) {
          console.warn(`[API Search] Keyword pre-search failed:`, kwErr);
        }
      }

      // Translate non-German queries to German for E5-small compatibility
      const searchQuery = await translateQueryToGerman(safeQuery);

      // Auto-detect category if not explicitly specified
      const effectiveCategory = category || detectCategory(safeQuery);

      // Only skip semantic search if we already have strong keyword matches
      // and user explicitly searched for a specific law abbreviation
      if (matchedLawKeys.length === 0 || safeQuery.length > 20) {
        console.log(
          `[API Search] Executing semantic and full-text search: "${searchQuery}" (original: "${safeQuery}", category: ${effectiveCategory || "none"})`,
        );
        const offset = (page - 1) * PAGE_SIZE;

        const qdrantResults = await searchNorms(
          searchQuery,
          effectiveCategory,
          50,
          offset,
        );

        console.log(
          `[API Search] Qdrant returned ${qdrantResults.length} points.`,
        );
        allResults.push(...qdrantResults);

        // Full-text search via Supabase (non-fatal — skipped if unavailable)
        try {
          const ftResponse = await (supabase
            .from("laws")
            .select("key, title, category")
            .textSearch("search_vector", searchQuery, {
              type: "websearch",
              config: "german",
            })
            .limit(10) as unknown as Promise<{
            data: { key: string; title: string; category: string }[] | null;
            error: any;
          }>);

          if (ftResponse.data && ftResponse.data.length > 0) {
            console.log(
              `[API Search] Full-text returned ${ftResponse.data.length} law matches.`,
            );
            const ftLawResults: SearchResult[] = ftResponse.data.map(
              (l: { key: string; title: string; category: string }) => ({
                law_key: l.key,
                law_title: l.title,
                category: l.category,
                norm_id: "",
                norm_title: "",
                content: `Full-text match: ${l.title}`,
                score: 0.9,
              }),
            );
            allResults.push(...ftLawResults);
          }
        } catch {
          console.warn(`[API Search] Full-text search unavailable — skipping.`);
        }
      } else {
        console.log(
          `[API Search] Skipping Qdrant — keyword pre-search sufficient for abbreviation query.`,
        );
      }

      // 2. Fallback: if both searches returned empty, try Supabase text search
      if (allResults.length === 0) {
        console.log(
          `[API Search] All searches returned 0 results — falling back to Supabase ilike text search.`,
        );
        try {
          const { data: laws, error: dbError } = await supabase
            .from("laws")
            .select("*")
            .or(
              `title.ilike.%${searchQuery}%,alt_title.ilike.%${searchQuery}%,key.ilike.%${searchQuery}%`,
            )
            .limit(20);

          if (!dbError && laws && laws.length > 0) {
            const fallbackResults = laws.map((l) => ({
              law_key: l.key,
              law_title: l.title,
              category: l.category,
              norm_id: "",
              norm_title: "",
              content: `Fallback match: ${l.title} — ${l.alt_title || l.key}`,
              score: 0.5,
            }));
            allResults.push(...fallbackResults);
            console.log(
              `[API Search] Supabase fallback returned ${fallbackResults.length} laws.`,
            );
          }
        } catch (fallbackErr) {
          console.warn(`[API Search] Supabase fallback also failed.`);
        }
      }
    } else if (category) {
      // 2. Browse Category via Supabase
      console.log(`[API Search] Browsing category: "${category}"`);
      const cookieStore = await cookies();
      const supabase = getServerClient(cookieStore);
      const { data: laws, error: dbError } = await supabase
        .from("laws")
        .select("*")
        .eq("category", category)
        .limit(20);

      if (dbError) throw dbError;

      allResults = (laws || []).map((l) => ({
        law_key: l.key,
        law_title: l.title,
        category: l.category,
        norm_id: "",
        norm_title: "",
        content: `Search focused on ${l.title}`,
        score: 1.0,
      }));
      console.log(`[API Search] Supabase returned ${allResults.length} laws.`);
    }

    // Group by law_key for law-level results
    const lawMap = new Map<
      string,
      { hits: number; topScore: number; norms: SearchResult[] }
    >();
    for (const r of allResults) {
      if (!lawMap.has(r.law_key)) {
        lawMap.set(r.law_key, { hits: 0, topScore: 0, norms: [] });
      }
      const entry = lawMap.get(r.law_key)!;
      entry.hits++;
      entry.topScore = Math.max(entry.topScore, r.score ?? 0);
      if (entry.norms.length < 3) entry.norms.push(r);
    }

    // Build results, translating to target language if needed
    const needsTranslation = lang !== "de" && lang !== undefined;

    const lawResults = [];
    for (const [key, data] of lawMap.entries()) {
      const lawTitle = data.norms[0]?.law_title || key;
      const categoryName = data.norms[0]?.category || "other";

      // Translate title and category once per law
      const [translatedTitle, translatedCategory] = needsTranslation
        ? await Promise.all([
            translateFromGerman(lawTitle, lang as AppLanguage),
            translateFromGerman(categoryName, lang as AppLanguage),
          ])
        : [lawTitle, categoryName];

      // Translate norm content (up to 3 per law)
      const translatedNorms = await Promise.all(
        data.norms.map(async (n) => {
          const [translatedNormTitle, translatedContent] = needsTranslation
            ? await Promise.all([
                translateFromGerman(n.norm_title || "", lang as AppLanguage),
                translateFromGerman(
                  (n.content || "Read full text for details.").slice(0, 300),
                  lang as AppLanguage,
                ),
              ])
            : [
                n.norm_title || "",
                n.content?.slice(0, 300) || "Read full text for details.",
              ];

          return {
            normId: n.norm_id || "",
            title: translatedNormTitle,
            content: translatedContent,
          };
        }),
      );

      // Translate context summary
      const contextSummary =
        data.hits > 1
          ? needsTranslation
            ? await translateFromGerman(
                `Found ${data.hits} relevant sections in this law.`,
                lang as AppLanguage,
              )
            : `Found ${data.hits} relevant sections in this law.`
          : "";

      lawResults.push({
        key,
        title: translatedTitle,
        category: translatedCategory,
        relevance: Math.round(data.topScore * 100),
        normHits: data.hits,
        contextSummary,
        relevantNorms: translatedNorms,
      });
    }

    lawResults.sort((a, b) => b.relevance - a.relevance);

    console.log(
      `[API Search] Success: Returning ${lawResults.length} unique laws (lang: ${lang}).`,
    );

    return NextResponse.json({
      results: lawResults,
      total: allResults.length,
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    console.error("[API Search] Fatal error:", err);
    return errorResponse("SEARCH_FAILED", `Search failed: ${message}`, 500);
  }
}
