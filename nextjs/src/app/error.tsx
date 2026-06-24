"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Scale, RotateCcw } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 border border-white/10 bg-white/5 flex items-center justify-center">
            <Scale className="w-8 h-8 text-accent-gold" />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-bold text-white">
          Unexpected Error
        </h1>

        <p className="text-zinc-400 text-sm leading-relaxed">
          An unexpected error occurred. This has been logged. Please try again.
        </p>

        {error.digest && (
          <p className="text-xs font-mono text-zinc-700">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={reset}
            className="flex items-center gap-3 px-6 py-3 border border-white/10 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white/5 hover:border-accent-gold/50 transition-all duration-300 active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            Retry
          </button>
          <Link
            href="/"
            className="px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors duration-300"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
