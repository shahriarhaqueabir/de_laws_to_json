import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../../lib/supabase-server";
import { errorResponse } from "../../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../../lib/sanitize";
import { decryptApiKey } from "../../../../../lib/encryption";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../../../lib/rate-limiter";

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
      .from("user_api_keys")
      .select("provider, encrypted_key")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    // Attempt decryption to detect key rotation
    let keyDecryptable = false;
    if (data?.encrypted_key) {
      try {
        await decryptApiKey(data.encrypted_key);
        keyDecryptable = true;
      } catch {
        // Encryption key has changed — stored ciphertext is no longer usable
        keyDecryptable = false;
      }
    }

    return NextResponse.json({
      hasKey: data !== null,
      keyDecryptable,
      provider: data?.provider ?? null,
    });
  } catch (err: unknown) {
    return errorResponse("DB_ERROR", sanitizeErrorMessage(err), 500);
  }
}
