import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse } from "../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../lib/sanitize";
import { COLLECTION } from "../../../../lib/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

function getQdrant(): QdrantClient | null {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    return null;
  }
  return new QdrantClient({ url, apiKey });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const { key } = await params;

    // Trim law keys — database may have trailing spaces from legacy data
    const trimmedKey = key.trim();

    const keySchema = z.string().min(1, "Law key is required");
    const keyResult = keySchema.safeParse(trimmedKey);
    if (!keyResult.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid law key",
        400,
        keyResult.error.issues.map((i) => ({
          field: "key",
          message: i.message,
        })),
      );
    }

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const { data: law, error } = await supabase
      .from("laws")
      .select("*")
      .eq("key", trimmedKey)
      .single();

    if (error) return errorResponse("NOT_FOUND", "Law not found", 404);

    const qdrant = getQdrant();

    if (!qdrant) {
      console.warn(
        `[Law Detail] Qdrant not configured — returning law metadata only.`,
      );
      return NextResponse.json({
        ...law,
        norms: [],
        qdrant_error:
          "Norms unavailable — Qdrant not configured in this environment.",
      });
    }

    try {
      // Scroll all norms for this law
      // with_vector: false — we only need payload for display, not the embedding
      const norms = await qdrant.scroll(COLLECTION, {
        filter: {
          must: [{ key: "law_key", match: { value: trimmedKey } }],
        },
        limit: 1000,
        with_payload: true,
        with_vector: false,
      });

      return NextResponse.json({
        ...law,
        norms: norms.points
          .map((p) => p.payload)
          .filter(
            (p): p is Record<string, unknown> => p !== null && p !== undefined,
          ),
      });
    } catch (err) {
      console.error("Qdrant scroll error:", err);
      return NextResponse.json({
        ...law,
        norms: [],
        qdrant_error: "Norms temporarily unavailable. Law metadata is shown.",
      });
    }
  } catch (err: unknown) {
    console.error("Law Detail API Error:", err);
    const message = sanitizeErrorMessage(err);
    return errorResponse("LAW_ERROR", message, 500);
  }
}
