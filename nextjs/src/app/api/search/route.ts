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
import { type AppLanguage, LANGUAGE_NAMES } from "../../../lib/types";

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

  try {
    let allResults: SearchResult[] = [];

    if (safeQuery) {
      // Translate non-German queries to German for E5-small compatibility
      const searchQuery = await translateQueryToGerman(safeQuery);
      console.log(
        `[API Search] Executing Qdrant query: "${searchQuery}" (original: "${safeQuery}", category: ${category || "none"})`,
      );
      // 1. Semantic Search via Qdrant
      const offset = (page - 1) * PAGE_SIZE;
      allResults = await searchNorms(searchQuery, category, 50, offset);
      console.log(`[API Search] Qdrant returned ${allResults.length} points.`);

      // 2. Fallback: if Qdrant returned empty, try Supabase text search
      if (allResults.length === 0) {
        console.log(
          `[API Search] Qdrant returned 0 results — falling back to Supabase text search.`,
        );
        try {
          const cookieStore = await cookies();
          const supabase = getServerClient(cookieStore);
          const { data: laws, error: dbError } = await supabase
            .from("laws")
            .select("*")
            .or(
              `title.ilike.%${searchQuery}%,alt_title.ilike.%${searchQuery}%,key.ilike.%${searchQuery}%`,
            )
            .limit(20);

          if (!dbError && laws && laws.length > 0) {
            allResults = laws.map((l) => ({
              law_key: l.key,
              law_title: l.title,
              category: l.category,
              norm_id: "",
              norm_title: "",
              content: `Fallback match: ${l.title} — ${l.alt_title || l.key}`,
              score: 0.5,
            }));
            console.log(
              `[API Search] Supabase fallback returned ${allResults.length} laws.`,
            );
          }
        } catch (fallbackErr) {
          // Fallback failed silently — return what we have
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API Search] Fatal error:", message);
    return errorResponse("SEARCH_FAILED", `Search failed: ${message}`, 500);
  }
}
