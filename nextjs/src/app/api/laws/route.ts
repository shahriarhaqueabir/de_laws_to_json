import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { errorResponse, successResponse } from "../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../lib/sanitize";

export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category") || "";
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
    const limit = 50;
    const offset = (page - 1) * limit;

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    let query = supabase
      .from("laws")
      .select("*", { count: "exact" })
      .order("key")
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error, count } = await query;
    if (error) return errorResponse("DB_ERROR", "Failed to fetch laws", 500);

    return successResponse({ results: data, total: count });
  } catch (err: unknown) {
    console.error("Laws API Error:", err);
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}
