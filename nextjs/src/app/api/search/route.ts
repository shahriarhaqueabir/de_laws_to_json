import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { searchNorms } from "../../../lib/qdrant";
import { getServerClient } from "../../../lib/supabase-server";
import { errorResponse } from "../../../lib/api-utils";

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

  const parsed = SearchParamsSchema.safeParse({
    q: rawQ,
    category: rawCategory,
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

  const { q: query, category, page } = parsed.data;
  const safeQuery = (query || "").trim();

  try {
    let allResults: SearchResult[] = [];

    if (safeQuery) {
      console.log(`[API Search] Executing Qdrant query: "${safeQuery}" (category: ${category || 'none'})`);
      // 1. Semantic Search via Qdrant
      const offset = (page - 1) * PAGE_SIZE;
      allResults = await searchNorms(safeQuery, category, 50, offset);
      console.log(`[API Search] Qdrant returned ${allResults.length} points.`);
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

    const lawResults = Array.from(lawMap.entries())
      .map(([key, data]) => ({
        key,
        title: data.norms[0]?.law_title || key,
        category: data.norms[0]?.category || "other",
        relevance: Math.round(data.topScore * 100),
        normHits: data.hits,
        contextSummary:
          data.hits > 1
            ? `Found ${data.hits} relevant sections in this law.`
            : "",
        relevantNorms: data.norms.map((n) => ({
          normId: n.norm_id || "",
          title: n.norm_title || "",
          content: n.content?.slice(0, 300) || "Read full text for details.",
        })),
      }))
      .sort((a, b) => b.relevance - a.relevance);

    console.log(`[API Search] Success: Returning ${lawResults.length} unique laws.`);

    return NextResponse.json({
      results: lawResults,
      total: allResults.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API Search] Fatal error:", message);
    return errorResponse(
      "SEARCH_FAILED",
      `Search failed: ${message}`,
      500,
    );
  }
}
