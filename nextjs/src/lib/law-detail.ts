import { cookies } from "next/headers";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getServerClient } from "../lib/supabase-server";
import { COLLECTION } from "../lib/qdrant";

function getQdrant(): QdrantClient | null {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) return null;
  return new QdrantClient({ url, apiKey });
}

export type LawDetailResult = Record<string, unknown> & {
  norms: Record<string, unknown>[];
  qdrant_error: string | null;
};

/**
 * Fetch a law and its norms from Supabase + Qdrant by law key.
 * Returns null if the law key doesn't exist.
 * Designed for use in server components.
 */
export async function getLawDetail(
  key: string,
): Promise<LawDetailResult | null> {
  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);

  const { data: law, error } = await supabase
    .from("laws")
    .select("*")
    .eq("key", key)
    .single();

  if (error || !law) return null;

  const qdrant = getQdrant();
  let norms: Record<string, unknown>[] = [];
  let qdrantError: string | null = null;

  if (!qdrant) {
    qdrantError =
      "Norms unavailable — Qdrant not configured in this environment.";
  } else {
    try {
      const result = await qdrant.scroll(COLLECTION, {
        filter: {
          must: [{ key: "law_key", match: { value: key } }],
        },
        limit: 1000,
        with_payload: true,
        with_vector: false,
      });
      norms = result.points
        .map((p) => p.payload)
        .filter((p): p is Record<string, unknown> => p !== null);
    } catch {
      qdrantError = "Norms temporarily unavailable. Law metadata is shown.";
    }
  }

  return { ...law, norms, qdrant_error: qdrantError };
}
