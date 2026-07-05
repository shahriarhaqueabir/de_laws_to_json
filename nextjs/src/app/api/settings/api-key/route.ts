import { NextRequest } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse, successResponse } from "../../../../lib/api-utils";
import { encryptApiKey } from "../../../../lib/encryption";
import { sanitizeErrorMessage } from "../../../../lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../../lib/rate-limiter";

const SaveApiKeySchema = z.object({
  apiKey: z.string().min(1, "apiKey is required"),
  provider: z.enum(["openai", "anthropic", "openai-compatible"]),
});

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const parsed = SaveApiKeySchema.safeParse(body);

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

    const { apiKey, provider } = parsed.data;

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

    const encryptedKey = await encryptApiKey(apiKey);

    const { error } = await supabase.from("user_api_keys").upsert(
      {
        user_id: user.id,
        encrypted_key: encryptedKey,
        provider,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;

    return successResponse({ success: true });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}

export async function DELETE(req: NextRequest) {
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

    const { error } = await supabase
      .from("user_api_keys")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return successResponse({ success: true });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}

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

    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("provider, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    return successResponse({
      has_key: !!keyRow,
      provider: keyRow?.provider || null,
      updated_at: keyRow?.updated_at || null,
    });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}
