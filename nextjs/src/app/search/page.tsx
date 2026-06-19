"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "../../components/search-bar";
import LawCard from "../../components/law-card";
import { LawSearchResult } from "../../lib/types";
import { Loader2, Scale } from "lucide-react";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";

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
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        setError("Failed to fetch search results.");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, category]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <div className="mb-20">
        <SearchBar initialValue={query} />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 animate-pulse">
          <div className="relative w-12 h-12 mb-8">
            <Loader2 className="absolute inset-0 w-12 h-12 text-accent-gold animate-spin" />
            <Loader2 className="absolute inset-0 w-12 h-12 text-accent-gold animate-ping opacity-20" />
          </div>
          <p className="monumental-type opacity-60">Scanning Archives...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-950/20 border border-red-900/30 text-red-400 font-bold uppercase tracking-widest text-[10px] text-center">
          ⚠️ Operational Error: {error}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="monumental-type opacity-50 shrink-0">
              {results.length} Statutes Retrieved
            </h2>
            <div className="h-px w-full bg-zinc-800/50" />
          </div>
          {results.map((law) => (
            <LawCard key={law.key} law={law} />
          ))}
        </div>
      ) : query || category ? (
        <div className="text-center py-32">
          <p className="text-zinc-500 font-serif italic text-xl">
            No statutes found matching the inquiry parameters.
          </p>
        </div>
      ) : (
        <div className="text-center py-32 opacity-20">
          <Scale className="w-16 h-16 mx-auto mb-6 text-accent-gold" />
          <p className="monumental-type">Awaiting Inquiry</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-transparent">
      <Suspense
        fallback={
          <div className="py-40 text-center monumental-type animate-pulse opacity-40">
            Initializing Search Environment...
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </main>
  );
}
