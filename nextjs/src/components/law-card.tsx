"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { LawSearchResult } from "../lib/types";
import { ChevronRight, BookmarkPlus, BookmarkCheck, LogIn } from "lucide-react";
import { isBookmarked, addBookmark, removeBookmark } from "../lib/bookmarks-v2";
import { toast } from "sonner";
import { useAuth } from "./auth-context";

export default function LawCard({ law }: { law: LawSearchResult }) {
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(law.key));

  const [showSignInTip, setShowSignInTip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleBookmark = async () => {
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
        // Auto-dismiss after 8 seconds
        timerRef.current = setTimeout(() => setShowSignInTip(false), 8000);
      } else {
        toast.success("Bookmark added");
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="premium-card p-10 group relative border-white/5 bg-zinc-900/20">
      <button
        onClick={toggleBookmark}
        className={`absolute top-8 right-10 p-2 transition-all duration-500 active:scale-90 ${
          bookmarked
            ? "text-accent-gold-bright"
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

      <div className="flex justify-between items-start mb-10">
        <div className="max-w-[80%]">
          <span className="monumental-type mb-4 block opacity-60">
            {law.category}
          </span>
          <h3 className="text-3xl font-serif font-bold text-white leading-tight">
            <Link
              href={`/laws/${law.key}`}
              className="hover:text-accent-gold-bright transition-colors duration-500"
            >
              <span className="text-accent-gold/40 mr-3">{law.key}</span>
              {law.title}
            </Link>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-accent-gold-bright font-black tracking-widest uppercase mb-1">
            {law.relevance}% Match
          </div>
          <div className="text-[10px] text-muted font-bold uppercase tracking-tighter">
            {law.normHits} Relevant Sections
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {law.relevantNorms.map((norm, idx) => (
          <div
            key={idx}
            className="bg-white/[0.02] p-6 border border-white/5 relative overflow-hidden group/norm"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-accent-gold/20 group-hover/norm:bg-accent-gold transition-colors duration-500" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-accent-gold/60 mb-3">
              Section {norm.normId} — {norm.title}
            </h4>
            <p className="legal-text italic text-zinc-400 line-clamp-3 text-sm leading-relaxed">
              {norm.content}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
        <Link
          href={`/laws/${law.key}`}
          className="monumental-type opacity-40 hover:opacity-100 hover:text-accent-gold transition-all flex items-center gap-3"
        >
          Detailed Examination <ChevronRight className="w-4 h-4" />
        </Link>
        <div className="text-[10px] font-bold text-muted italic font-serif">
          Source: Bundesamt für Justiz
        </div>
      </div>

      {/* Sign-in prompt for anonymous users who just bookmarked */}
      {showSignInTip && !user && (
        <div className="mt-6 p-4 border border-accent-gold/20 bg-accent-gold/5 animate-fade-in">
          <Link
            href="/auth"
            className="flex items-center justify-between group"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-accent-gold mb-1">
                Saved to Local Vault
              </p>
              <p className="text-xs text-zinc-400">
                Sign in to sync bookmarks across devices and access folder
                organization.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent-gold-bright group-hover:underline">
              <LogIn className="w-4 h-4" />
              Sign In
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
