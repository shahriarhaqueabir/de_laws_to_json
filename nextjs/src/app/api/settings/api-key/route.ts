import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse } from "../../../../lib/api-utils";
import { encryptApiKey } from "../../../../lib/encryption";

const VALID_PROVIDERS = ["openai", "anthropic", "openai-compatible"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

function isValidProvider(value: string): value is Provider {
  return VALID_PROVIDERS.includes(value as Provider);
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, provider } = await req.json();

    if (!apiKey || typeof apiKey !== "string") {
      return errorResponse(
        "VALIDATION_ERROR",
        "apiKey is required and must be a string",
        400,
      );
    }

    if (
      !provider ||
      typeof provider !== "string" ||
      !isValidProvider(provider)
    ) {
      return errorResponse(
        "VALIDATION_ERROR",
        `provider must be one of: ${VALID_PROVIDERS.join(", ")}`,
        400,
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const { error } = await supabase
      .from("user_api_keys")
      .delete()
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    return errorResponse("NOT_FOUND", "Endpoint not found", 404);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}
