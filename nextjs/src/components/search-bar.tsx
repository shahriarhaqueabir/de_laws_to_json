import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Brain, Loader2, FileText } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";

export default function SearchBar({
  initialValue = "",
}: {
  initialValue?: string;
}) {
  const [query, setQuery] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"search" | "chat">("search");
  const router = useRouter();
  const { t } = useLanguage();

  const handleSearch = useCallback(
    (e: React.FormEvent, forceMode?: "search" | "chat") => {
      if (e) e.preventDefault();
      if (!query.trim() || submitting) return;

      setSubmitting(true);
      const activeMode = forceMode || mode;

      if (activeMode === "chat") {
        router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router, submitting, mode],
  );

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {/* ── Mode Toggle ── */}
      <div className="flex justify-center mb-2">
        <div className="inline-flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
          <button
            onClick={() => setMode("search")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
              mode === "search"
                ? "bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/20 shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t("search_bar.mode_search")}
          </button>
          <button
            onClick={() => setMode("chat")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
              mode === "chat"
                ? "bg-accent-neon/10 text-accent-neon border border-accent-neon/20 shadow-[0_0_15px_rgba(168,255,144,0.1)]"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            {t("search_bar.mode_analyze")}
          </button>
        </div>
      </div>

      <form onSubmit={(e) => handleSearch(e)} className="group w-full">
        <div className="relative">
          <div className="absolute inset-0 bg-brushed-metal opacity-[0.08] pointer-events-none" />
          <div
            className={`absolute inset-0 blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 ${
              mode === "chat" ? "bg-accent-neon/5" : "bg-accent-gold/5"
            }`}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search laws"
            placeholder={
              mode === "chat"
                ? "Describe your legal situation for AI analysis..."
                : "Search statutes by keyword or section number..."
            }
            className={`w-full px-6 sm:px-8 py-6 pr-20 sm:pr-24 text-base sm:text-xl glass-panel-heavy border-white/5 rounded-xl
                                            focus:outline-none focus-visible:ring-1 focus-visible:border-white/10 focus:bg-white/[0.04]
                                            text-white placeholder:text-zinc-600 transition-all duration-500 font-bold tracking-widest uppercase ${
                                              mode === "chat"
                                                ? "focus-visible:ring-accent-neon/50 focus-neon"
                                                : "focus-visible:ring-accent-gold/50 focus-gold"
                                            }`}
          />
          <div className="absolute right-2 top-2 bottom-2 flex gap-1 sm:gap-1.5">
            <button
              type="submit"
              disabled={submitting}
              aria-label="Submit"
              className={`w-12 sm:w-16 h-full transition-all duration-500 transition-transform duration-300 active:scale-95 flex items-center justify-center border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
                mode === "chat"
                  ? "bg-accent-neon/10 border-accent-neon/20 text-accent-neon hover:bg-accent-neon/20"
                  : "bg-accent-gold/10 border-accent-gold/20 text-accent-gold-bright hover:bg-accent-gold/20"
              }`}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : mode === "chat" ? (
                <Brain className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>
        </div>
      </form>

      {!query && (
        <p className="text-xs text-zinc-500 font-medium text-center animate-fade-in leading-relaxed">
          {mode === "chat"
            ? "Describe your situation in detail — specific facts help identify the most relevant laws."
            : "Use law keys (e.g., 'BGB'), section numbers (§), or keywords for direct results."}
        </p>
      )}

      {query.length > 3 && (
        <p
          className="text-xs text-zinc-600 font-black uppercase tracking-[0.4em] text-center animate-fade-in"
          role="status"
          aria-live="polite"
        >
          {mode === "chat" ? "AI Analysis Mode Active" : "Searching Statutes..."}
        </p>
      )}
    </div>
  );
}
