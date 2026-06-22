import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-utils";

/**
 * GET /api/guidance/sessions
 * List all guidance sessions (case_files) for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    // Pagination
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)),
    );
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
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}
