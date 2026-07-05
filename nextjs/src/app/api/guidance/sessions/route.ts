import { NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "@/lib/rate-limiter";

const SessionsQuerySchema = z.object({
  page: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.number().int().default(1),
  ).transform((v) => Math.max(1, v)),
  limit: z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.number().int().default(20),
  ).transform((v) => Math.max(1, Math.min(50, v))),
});

/**
 * GET /api/guidance/sessions
 * List all guidance sessions (case_files) for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
      ip,
      DEFAULT_SEARCH_RATE_LIMIT,
    );
    if (!allowed) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests. Please wait before trying again.",
        429,
        undefined,
        rateLimitHeaders,
      );
    }

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse(
        "UNAUTHORIZED",
        "User must be signed in",
        401,
        undefined,
        rateLimitHeaders,
      );
    }

    // Pagination with Zod validation
    const url = new URL(req.url);
    const parsed = SessionsQuerySchema.safeParse({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    });
    // Fall back to defaults on validation failure
    const { page, limit } = parsed.success
      ? parsed.data
      : { page: 1, limit: 20 };
    const offset = (page - 1) * limit;

    // Get total count
    const { count: total } = await supabase
      .from("case_files")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Get case files with path summaries
    const { data: sessions, error } = await supabase
      .from("case_files")
      .select(
        `
        *,
        guidance_paths (
          id,
          path_number,
          title,
          risk_level,
          cost_estimate
        )
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return successResponse({
      sessions: sessions || [],
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (err: unknown) {
    return errorResponse("DB_ERROR", sanitizeErrorMessage(err), 500);
  }
}
