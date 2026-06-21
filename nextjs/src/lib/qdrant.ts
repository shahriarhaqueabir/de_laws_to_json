import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION = "german_norms";
export const INFERENCE_MODEL = "intfloat/multilingual-e5-small";

let qdrantClient: QdrantClient | null = null;

function getQdrant(): QdrantClient {
  if (qdrantClient) return qdrantClient;
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "Qdrant environment variables not configured. " +
        "Set QDRANT_URL and QDRANT_API_KEY in Vercel project settings.",
    );
  }
  qdrantClient = new QdrantClient({ url, apiKey });
  return qdrantClient;
}

export interface SearchResult {
  law_key: string;
  law_title: string;
  category: string;
  norm_id: string;
  norm_title: string;
  content: string;
  score: number;
}

export async function searchNorms(
  query: string,
  category?: string,
  topK: number = 50,
  offset: number = 0,
): Promise<SearchResult[]> {
  const filter: { must: Array<Record<string, unknown>> } = { must: [] };

  if (category) {
    filter.must.push({ key: "category", match: { value: category } });
  }

  const queryFilter = filter.must.length > 0 ? filter : undefined;

  console.log(
    `[Qdrant lib] Searching for: "${query}" in collection: ${COLLECTION}`,
  );

  try {
    const client = getQdrant();

    // Qdrant Universal Query API with Managed Inference
    // We use the direct inference object structure (text + model) as required by Qdrant Cloud
    // E5-small requires "query: " prefix on search queries
    // The indexed documents use "passage: " prefix
    // Without this prefix, embeddings don't match — results are random
    const prefixedQuery = `query: ${query}`;

    const results = await client.query(COLLECTION, {
      query: {
        text: prefixedQuery,
        model: INFERENCE_MODEL,
      },
      limit: topK,
      offset,
      filter: queryFilter,
      with_payload: true,
    });

    console.log(
      `[Qdrant lib] Search success. Points found: ${results.points.length}`,
    );

    return results.points.map((r) => {
      const payload = r.payload as Record<string, unknown> | undefined;
      return {
        law_key: (payload?.law_key as string) ?? "",
        law_title:
          ((payload?.law_title as string) || (payload?.law_key as string)) ??
          "",
        category: (payload?.category as string) ?? "other",
        norm_id: (payload?.norm_id as string) ?? "",
        norm_title: (payload?.norm_title as string) ?? "",
        content: (payload?.content as string) ?? "",
        score: r.score ?? 0,
      };
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Qdrant lib] Search error: ${message}`);
    // Re-throw to be caught by the API route
    throw err;
  }
}
