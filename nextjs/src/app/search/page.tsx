"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "../../components/search-bar";
import LawCard from "../../components/law-card";
import { LawSearchResult } from "../../lib/types";
import { Scale } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { SkeletonList } from "../../components/ui/skeleton";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const { t } = useLanguage();
  const fetchIdRef = useRef(0);

  const [results, setResults] = useState<LawSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query && !category) return;

    const fetchId = ++fetchIdRef.current;

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&lang=en`;
        const res = await fetch(url);
        // Ignore stale responses from previous fetches
        if (fetchId !== fetchIdRef.current) return;
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        if (fetchId === fetchIdRef.current) {
          setError(t("search.error"));
        }
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
        }
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
        <div role="status" aria-live="polite" aria-label="Searching">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
              {t("search.loading")}
            </h2>
            <div className="h-px w-full bg-zinc-800/50" />
          </div>
          <div className="space-y-12">
            <SkeletonList count={3} />
          </div>
        </div>
      ) : error ? (
        <div className="p-8 bg-red-950/20 border border-red-900/30 text-red-400 font-bold uppercase tracking-widest text-xs text-center">
          ⚠️ Error: {error}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
              {t("search.results_count", { n: results.length })}
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
            {t("search.empty")}
          </p>
        </div>
      ) : (
        <div className="text-center py-32 opacity-20">
          <Scale className="w-16 h-16 mx-auto mb-6 text-accent-gold" />
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40">
            {t("search.awaiting")}
          </p>
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
          <div className="py-40 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest animate-pulse opacity-40">
            Loading...
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </main>
  );
}
