import { QdrantClient } from '@qdrant/js-client-rest';

const qdrantUrl = process.env.QDRANT_URL!;
const qdrantKey = process.env.QDRANT_API_KEY!;

export const qdrant = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantKey,
});

export const COLLECTION = 'german_norms';

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
): Promise<SearchResult[]> {
  const filter: any = { must: [] };

  if (category) {
    filter.must.push({ key: 'category', match: { value: category } });
  }

  // Using query() to support managed text inference
  const results = await qdrant.query(COLLECTION, {
    query: { text: query },
    limit: topK,
    filter: filter.must.length > 0 ? filter : undefined,
  });

  return results.points.map((r) => ({
    law_key:      r.payload!.law_key as string,
    law_title:    r.payload!.law_title as string,
    category:     r.payload!.category as string,
    norm_id:      r.payload!.norm_id as string,
    norm_title:   r.payload!.norm_title as string,
    content:      r.payload!.content as string,
    score:        r.score ?? 0,
  }));
}
