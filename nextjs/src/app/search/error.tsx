"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Scale, RotateCcw } from "lucide-react";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Search error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 border border-white/10 bg-white/5 flex items-center justify-center">
            <Scale className="w-8 h-8 text-accent-gold" />
          </div>
        </div>

        <h1 className="font-serif text-2xl font-bold text-white">
          Search Interruption
        </h1>

        <p className="text-zinc-400 text-sm leading-relaxed">
          The search engine encountered an error. Please try again or refine
          your inquiry.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={reset}
            className="flex items-center gap-3 px-6 py-3 border border-white/10 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/5 hover:border-accent-gold/50 transition-all duration-300 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
          <Link
            href="/search"
            className="px-6 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors duration-300"
          >
            New Search
          </Link>
        </div>
      </div>
    </div>
  );
}
