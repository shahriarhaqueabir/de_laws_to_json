import { NextRequest, NextResponse } from "next/server";
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

function handleError(err: unknown) {
  const message = sanitizeErrorMessage(err);
  return errorResponse("DB_ERROR", message, 500);
}

// ── Validation ─────────────────────────────────────────────────────────────

const FolderStatusEnum = z.enum([
  "pre_action",
  "consulting",
  "filed",
  "in_progress",
  "resolved",
]);

const CreateFolderSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(200),
  description: z.string().max(1000).optional().default(""),
  category: z.string().max(100).optional().default("other"),
  incident_date: z.string().nullable().optional(),
  dispute_value: z.number().min(0).optional().default(0),
  status: FolderStatusEnum.optional().default("pre_action"),
  opposing_party: z.string().max(500).optional().default(""),
  deadline_date: z.string().nullable().optional(),
  court_name: z.string().max(200).optional().default(""),
  case_number: z.string().max(200).optional().default(""),
  notes: z.string().max(5000).optional().default(""),
});

const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  incident_date: z.string().nullable().optional(),
  dispute_value: z.number().min(0).optional(),
  status: FolderStatusEnum.optional(),
  opposing_party: z.string().max(500).optional(),
  deadline_date: z.string().nullable().optional(),
  court_name: z.string().max(200).optional(),
  case_number: z.string().max(200).optional(),
  notes: z.string().max(5000).optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────

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

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const { data, error } = await supabase
      .from("bookmark_folders")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return successResponse(data);
  } catch (err: unknown) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
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

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const body = await req.json();
    const parsed = CreateFolderSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        422,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    }

    const { data, error } = await supabase
      .from("bookmark_folders")
      .insert({
        user_id: user.id,
        ...parsed.data,
        incident_date: parsed.data.incident_date || null,
        deadline_date: parsed.data.deadline_date || null,
      })
      .select()
      .single();

    if (error) throw error;

    return successResponse(data, 201);
  } catch (err: unknown) {
    return handleError(err);
  }
}

// ── [id] sub-routes ─────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
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

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const url = new URL(req.url);
    const idRaw = url.searchParams.get("id");
    const idResult = z.string().uuid().safeParse(idRaw);
    if (!idResult.success) {
      return errorResponse("VALIDATION_ERROR", "Valid folder id (UUID) is required", 422);
    }
    const id = idResult.data;

    const body = await req.json();
    const parsed = UpdateFolderSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        422,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    }

    const { data, error } = await supabase
      .from("bookmark_folders")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return errorResponse("NOT_FOUND", "Folder not found", 404);
    }

    return successResponse(data);
  } catch (err: unknown) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest) {
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

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const url = new URL(req.url);
    const idRaw = url.searchParams.get("id");
    const idResult = z.string().uuid().safeParse(idRaw);
    if (!idResult.success) {
      return errorResponse("VALIDATION_ERROR", "Valid folder id (UUID) is required", 422);
    }
    const id = idResult.data;

    const { error } = await supabase
      .from("bookmark_folders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err: unknown) {
    return handleError(err);
  }
}
