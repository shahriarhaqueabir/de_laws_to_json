import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getServerClient } from "../../../lib/supabase-server";
import { errorResponse } from "../../../lib/api-utils";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../lib/rate-limiter";

const QuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v || "1", 10);
      return isNaN(n) || n < 1 ? 1 : Math.min(n, 500);
    }),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = parseInt(v || "50", 10);
      return isNaN(n) || n < 1 ? 50 : Math.min(n, 1000);
    }),
  category: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
      ip,
      DEFAULT_SEARCH_RATE_LIMIT,
    );
    if (!allowed) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests",
        429,
undefined,
rateLimitHeaders,
      );
    }

    const rawParams = {
      page: req.nextUrl.searchParams.get("page") || undefined,
      limit: req.nextUrl.searchParams.get("limit") || undefined,
      category: req.nextUrl.searchParams.get("category") || undefined,
      search: req.nextUrl.searchParams.get("search") || undefined,
    };

    const parsed = QuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid query parameters", 400);
    }

    const { page, limit, category, search } = parsed.data;

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    // Build query
    let query = supabase.from("laws").select("*", { count: "exact" });

    if (category) {
      query = query.eq("category", category);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(`title.ilike.${term},key.ilike.${term},alt_title.ilike.${term}`);
    }

    // Paginate — Supabase range is inclusive
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await query
      .range(from, to)
      .order("key", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error("[Laws API] Error:", err);
    return errorResponse("LAWS_ERROR", "Failed to fetch laws", 500);
  }
}
