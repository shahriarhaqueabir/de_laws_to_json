import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') || '';
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);
  let query = supabase
    .from('laws')
    .select('*', { count: 'exact' })
    .order('key')
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data, total: count });
}
