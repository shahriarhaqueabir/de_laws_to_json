import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse } from "../../../../lib/api-utils";
import { COLLECTION } from "../../../../lib/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

function getQdrant(): QdrantClient {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    throw new Error("Qdrant not configured");
  }
  return new QdrantClient({ url, apiKey });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  const keySchema = z.string().min(1, "Law key is required");
  const keyResult = keySchema.safeParse(key);
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

  // Get law metadata
  const { data: law, error } = await supabase
    .from("laws")
    .select("*")
    .eq("key", key)
    .single();

  if (error)
    return NextResponse.json({ error: "Law not found" }, { status: 404 });

  // Get norms from Qdrant by law_key filter (using scroll to get up to 1000)
  try {
    const norms = await getQdrant().scroll(COLLECTION, {
      filter: {
        must: [{ key: "law_key", match: { value: key } }],
      },
      limit: 1000,
      with_payload: true,
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
    return NextResponse.json(
      { error: "Could not fetch norms from vector store", law: law },
      { status: 502 },
    );
  }
}
