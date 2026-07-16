import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse } from "../../../../lib/api-utils";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../../lib/rate-limiter";

export const dynamic = "force-dynamic";


export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
      ip,
      DEFAULT_SEARCH_RATE_LIMIT,
    );
    if (!allowed) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429, headers: rateLimitHeaders },
      );
    }

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    // Fetch ALL categories — PostgREST caps at ~1k without explicit limit
    const { data, error } = await supabase
      .from("laws")
      .select("category")
      .limit(100000);

    if (error) throw error;

    // Count per category
    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.category] = (counts[row.category] || 0) + 1;
    }

    const categories = Object.entries(counts)
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      categories,
      total: data?.length || 0,
    });
  } catch (err) {
    console.error("[Laws Stats API] Error:", err);
    return errorResponse("STATS_ERROR", "Failed to fetch law statistics", 500);
  }
}
