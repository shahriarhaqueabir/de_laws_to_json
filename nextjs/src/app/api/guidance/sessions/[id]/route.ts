import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "@/lib/rate-limiter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    // Get the case file
    const { data: caseFile, error: cfError } = await supabase
      .from("case_files")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (cfError || !caseFile) {
      return errorResponse("NOT_FOUND", "Guidance session not found", 404);
    }

    // Get the guidance paths
    const { data: paths, error: pError } = await supabase
      .from("guidance_paths")
      .select("*")
      .eq("case_file_id", id)
      .order("path_number", { ascending: true });

    if (pError) throw pError;

    return successResponse({
      session: caseFile,
      paths: paths || [],
    });
  } catch (err: unknown) {
    return errorResponse("DB_ERROR", sanitizeErrorMessage(err), 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const { error } = await supabase
      .from("case_files")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err: unknown) {
    return errorResponse("DB_ERROR", sanitizeErrorMessage(err), 500);
  }
}
