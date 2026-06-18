import { QdrantClient } from "@qdrant/js-client-rest";

export const COLLECTION = "german_norms";

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

  // Using query() to support managed text inference
  const results = await getQdrant().query(COLLECTION, {
    query: { text: query },
    limit: topK,
    offset,
    filter: filter.must.length > 0 ? filter : undefined,
  });

  return results.points.map((r) => ({
    law_key: r.payload!.law_key as string,
    law_title: r.payload!.law_title as string,
    category: r.payload!.category as string,
    norm_id: r.payload!.norm_id as string,
    norm_title: r.payload!.norm_title as string,
    content: r.payload!.content as string,
    score: r.score ?? 0,
  }));
}
