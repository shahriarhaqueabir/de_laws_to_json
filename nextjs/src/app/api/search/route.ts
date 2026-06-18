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
    let allResults: any[] = [];

    if (query.trim()) {
      // 1. Semantic Search via Qdrant
      allResults = await searchNorms(query, category, 50);
    } else if (category) {
      // 2. Browse Category via Supabase
      const cookieStore = await cookies();
      const supabase = getServerClient(cookieStore);
      const { data: laws } = await supabase
        .from('laws')
        .select('*')
        .eq('category', category)
        .limit(20);

      allResults = (laws || []).map(l => ({
        law_key: l.key,
        law_title: l.title,
        category: l.category,
        norm_id: '', // Browse mode doesn't highlight specific norms
        norm_title: '',
        content: '',
        score: 1.0
      }));
    }

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
