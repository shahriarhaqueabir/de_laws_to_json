'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchBar from '../../components/search-bar';
import LawCard from '../../components/law-card';
import { LawSearchResult } from '../../lib/types';
import { Loader2 } from 'lucide-react';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';

  const [results, setResults] = useState<LawSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query && !category) return;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        setError('Failed to fetch search results.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, category]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10">
        <SearchBar initialValue={query} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-[#c4a86a] animate-spin mb-4" />
                    <p className="text-[#a09e9a]">Searching German laws...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-[#2a2a2a] text-red-400 rounded-none border border-[#2a2a2a]">
                  {error}
                </div>
      ) : results.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-[#e8e6e3]">
                      Found {results.length} relevant laws
                    </h2>
          {results.map((law) => (
            <LawCard key={law.key} law={law} />
          ))}
        </div>
      ) : query || category ? (
        <div className="text-center py-20">
          <p className="text-[#a09e9a] text-lg">No laws found matching your criteria.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-[#0d0d0d]">
      <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
        <SearchResults />
      </Suspense>
    </main>
  );
}
