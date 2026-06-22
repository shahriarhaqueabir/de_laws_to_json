"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Brain, Loader2 } from "lucide-react";

export default function SearchBar({
  initialValue = "",
}: {
  initialValue?: string;
}) {
  const [query, setQuery] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const handleSearch = useCallback(
    (e: React.FormEvent, forceChat = false) => {
      if (e) e.preventDefault();
      if (!query.trim() || submitting) return;

      setSubmitting(true);

      const isQuestion =
        query.length > 20 ||
        /\?$/.test(query) ||
        /how|what|why|who|where|when|my|I|increase|landlord|rent/i.test(query);

      if (forceChat || isQuestion) {
        router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router, submitting],
  );

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <form onSubmit={(e) => handleSearch(e)} className="group w-full">
        <div className="relative">
          <div className="absolute inset-0 bg-accent-gold/5 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search laws"
            placeholder="Search German laws... (e.g., Mietrecht, BGB § 823)"
            className="w-full px-8 py-6 pr-40 text-xl glass-panel-heavy border-white/5
                                focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-gold/30 focus:bg-white/[0.04]
                                text-white placeholder:text-zinc-600 transition-all duration-500 font-bold tracking-widest uppercase"
          />
          <div className="absolute right-2 top-2 bottom-2 flex gap-1">
            <button
              type="submit"
              disabled={submitting}
              aria-label="Search"
              className="aspect-square bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all duration-500 active:scale-95 flex items-center justify-center border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {submitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Search className="w-6 h-6" />
              )}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={(e) =>
                handleSearch(e as unknown as React.FormEvent, true)
              }
              className="px-6 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold-bright transition-all duration-500 active:scale-95 flex items-center gap-3 border border-accent-gold/20 font-black uppercase tracking-widest text-[10px] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Brain className="w-4 h-4" />
              Analyze via AI
            </button>
          </div>
        </div>
      </form>

      {query.length > 5 && (
        <p
          className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em] text-center animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {/how|what|why|my|landlord|rent/i.test(query)
            ? "AI analysis available"
            : "Searching statutes..."}
        </p>
      )}
    </div>
  );
}
