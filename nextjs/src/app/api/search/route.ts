import { NextRequest, NextResponse } from 'next/server';
import { searchNorms } from '@/lib/qdrant';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || '';
  const category = req.nextUrl.searchParams.get('category') || '';
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const pageSize = 20;

  if (!query.trim() && !category) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Get top 50 from Qdrant (managed E5-small)
    const allResults = await searchNorms(query, category, 50);

    // Group by law_key for law-level results
    const lawMap = new Map<string, { hits: number; topScore: number; norms: any[] }>();
    for (const r of allResults) {
      if (!lawMap.has(r.law_key)) {
        lawMap.set(r.law_key, { hits: 0, topScore: 0, norms: [] });
      }
      const entry = lawMap.get(r.law_key)!;
      entry.hits++;
      entry.topScore = Math.max(entry.topScore, r.score);
      if (entry.norms.length < 3) entry.norms.push(r);
    }

    const lawResults = Array.from(lawMap.entries())
      .map(([key, data]) => ({
        key,
        title: data.norms[0]?.law_title || '',
        category: data.norms[0]?.category || '',
        relevance: Math.round(data.topScore * 100),
        normHits: data.hits,
        relevantNorms: data.norms.map((n) => ({
          normId: n.norm_id,
          title: n.norm_title,
          content: n.content.slice(0, 300),
        })),
      }))
      .sort((a, b) => b.relevance - a.relevance);

    return NextResponse.json({
      results: lawResults,
      total: allResults.length,
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
