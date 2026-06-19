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
  const filter: any = { must: [] };

  if (category) {
    filter.must.push({ key: "category", match: { value: category } });
  }

  const queryFilter = filter.must.length > 0 ? filter : undefined;

  console.log(`[Qdrant lib] Searching for: "${query}" in collection: ${COLLECTION}`);

  try {
    const client = getQdrant();

    // Qdrant Universal Query API with Managed Inference
    // We use the direct inference object structure (text + model) as required by Qdrant Cloud
    const results = await client.query(COLLECTION, {
      query: {
        text: query,
        model: INFERENCE_MODEL,
      },
      limit: topK,
      offset,
      filter: queryFilter,
    });

    console.log(`[Qdrant lib] Search success. Points found: ${results.points.length}`);

    return results.points.map((r) => ({
      law_key: r.payload!.law_key as string,
      law_title: (r.payload!.law_title || r.payload!.law_key) as string,
      category: r.payload!.category as string,
      norm_id: r.payload!.norm_id as string,
      norm_title: r.payload!.norm_title as string,
      content: r.payload!.content as string,
      score: r.score ?? 0,
    }));
  } catch (err: any) {
    console.error(`[Qdrant lib] Search error: ${err.message}`);
    // Re-throw to be caught by the API route
    throw err;
  }
}
