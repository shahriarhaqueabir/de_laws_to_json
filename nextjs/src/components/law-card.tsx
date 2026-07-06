"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LawSearchResult } from "../lib/types";
import { ChevronRight, BookmarkPlus, BookmarkCheck, LogIn } from "lucide-react";
import { isBookmarked, addBookmark, removeBookmark } from "../lib/bookmarks-v2";
import { toast } from "sonner";
import { useAuth } from "./auth-context";

export default function LawCard({ law }: { law: LawSearchResult }) {
  const { user } = useAuth();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(law.key));

  const [showSignInTip, setShowSignInTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (bookmarked) {
      await removeBookmark(law.key);
      setBookmarked(false);
      toast.info("Bookmark removed");
    } else {
      await addBookmark({
        law_key: law.key,
        law_title: law.title,
        category: law.category,
        added_at: new Date().toISOString().split("T")[0],
      });
      setBookmarked(true);
      if (!user) {
        setShowSignInTip(true);
        toast.info("Saved locally. Sign in to sync bookmarks.");
        timerRef.current = setTimeout(() => setShowSignInTip(false), 8000);
      } else {
        toast.success("Bookmark added");
      }
    }
  };

  const navigateToDetail = useCallback(() => {
    router.push(`/laws/${encodeURIComponent(law.key)}`);
  }, [router, law.key]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="premium-card p-10 group relative border-white/5 bg-zinc-900/20 transition-all duration-500 hover:border-accent-gold/40 edge-glow-electric overflow-hidden">
      {/* ── Stretched Link for the whole card ── */}
      <Link
        href={`/laws/${encodeURIComponent(law.key)}`}
        className="absolute inset-0 z-0"
        aria-label={`View details for ${law.title}`}
      />

      {/* ── Bookmark Button (on top) ── */}
      <button
        onClick={toggleBookmark}
        className={`absolute top-8 right-10 p-2 transition-all duration-500 active:scale-90 z-20 ${
          bookmarked
            ? "text-accent-gold-bright drop-shadow-[0_0_6px_var(--accent-gold-glow)]"
            : "text-zinc-700 hover:text-accent-gold"
        }`}
        title={bookmarked ? "Remove bookmark" : "Add bookmark"}
      >
        {bookmarked ? (
          <BookmarkCheck className="w-6 h-6" />
        ) : (
          <BookmarkPlus className="w-6 h-6" />
        )}
      </button>

      {/* ── Content (clicks pass through to link) ── */}
      <div className="relative z-10 pointer-events-none">
        <div className="flex justify-between items-start mb-10">
          <div className="max-w-[80%]">
            <span className="monumental-type mb-4 block opacity-60">
              {law.category}
            </span>
            <h3 className="text-3xl font-serif font-bold text-white leading-tight">
              <span className="text-accent-gold/40 mr-3">{law.key}</span>
              {law.title}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xs text-accent-gold-bright font-black tracking-widest uppercase mb-1 tabular-nums">
              {law.relevance}% Match
            </div>
            <div className="text-xs text-muted font-bold uppercase tracking-tighter tabular-nums">
              {law.normHits} Relevant Sections
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {law.relevantNorms.map((norm, idx) => (
            <div
              key={idx}
              className="bg-white/[0.02] p-6 border border-white/5 relative overflow-hidden bg-coin-pattern"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-accent-gold/20" />
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-accent-gold/60 mb-3">
                Section {norm.normId} — {norm.title}
              </h4>
              <p className="legal-text italic text-zinc-400 line-clamp-3 text-sm leading-relaxed">
                {norm.content}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
          <span className="monumental-type opacity-40 group-hover:opacity-100 group-hover:text-accent-gold transition-all flex items-center gap-3">
            Detailed Examination <ChevronRight className="w-4 h-4" />
          </span>
          <span className="text-xs font-bold text-muted italic font-serif">
            Source: Bundesamt für Justiz
          </span>
        </div>
      </div>

      {/* ── Sign-in Tip (on top) ── */}
      {showSignInTip && !user && (
        <div
          className="mt-6 p-4 border border-accent-gold/20 bg-accent-gold/5 animate-fade-in relative z-20 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href="/auth"
            className="flex items-center justify-between group"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent-gold-body mb-1">
                Saved to Local Vault
              </p>
              <p className="text-xs text-zinc-400">
                Sign in to sync bookmarks across devices and access folder
                organization.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent-gold-bright group-hover:underline">
              <LogIn className="w-4 h-4" />
              Sign In
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
