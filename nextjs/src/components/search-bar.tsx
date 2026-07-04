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
          <div className="absolute inset-0 bg-brushed-metal opacity-[0.08] pointer-events-none" />
          <div className="absolute inset-0 bg-accent-gold/5 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search laws"
            placeholder="Describe your legal situation in detail... (e.g., 'my landlord won\'t return my deposit')"
            className="w-full px-6 sm:px-8 py-6 pr-36 sm:pr-80 text-base sm:text-xl glass-panel-heavy border-white/5 rounded-xl
                                            focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-electric focus:border-accent-electric/30 focus:bg-white/[0.04]
                                            text-white placeholder:text-zinc-600 transition-colors duration-500 font-bold tracking-widest uppercase focus-electric"
          />
          <div className="absolute right-1.5 top-1.5 bottom-1.5 flex gap-1 sm:gap-1.5">
            <button
              type="submit"
              disabled={submitting}
              aria-label="Search"
              className="w-10 sm:w-14 aspect-square bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-colors duration-500 transition-transform duration-300 active:scale-95 flex items-center justify-center border border-white/5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <Search className="w-4 h-4 sm:w-6 sm:h-6" />
              )}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={(e) =>
                handleSearch(e as unknown as React.FormEvent, true)
              }
              className="hidden sm:flex px-5 bg-accent-neon/10 hover:bg-accent-neon/20 text-accent-neon transition-colors duration-500 transition-transform duration-300 active:scale-95 items-center gap-2 border border-accent-neon/20 rounded-lg font-black uppercase tracking-wider text-[11px] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Brain className="w-4 h-4" />
              Analyze via AI
            </button>
          </div>
        </div>
      </form>

      {!query && (
        <p className="text-xs text-zinc-500 font-medium text-center animate-fade-in leading-relaxed">
          Describe your situation in detail — specific facts help identify the
          most relevant laws.
        </p>
      )}

      {query.length > 5 && (
        <p
          className="text-xs text-zinc-600 font-black uppercase tracking-[0.4em] text-center animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {/how|what|why|my|landlord|rent/i.test(query)
            ? "AI analysis available — more details = better results"
            : "Searching statutes..."}
        </p>
      )}
    </div>
  );
}
