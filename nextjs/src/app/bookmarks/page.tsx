"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import {
  getBookmarks,
  removeBookmark,
  type Bookmark as BookmarkType,
} from "../../lib/bookmarks";

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>(() =>
    getBookmarks(),
  );

  const handleRemove = (lawKey: string, normId?: string) => {
    removeBookmark(lawKey, normId);
    setBookmarks(getBookmarks());
  };

  if (bookmarks.length === 0) {
    return (
      <div className="min-h-screen bg-transparent max-w-4xl mx-auto px-6 py-40 text-center">
        <div className="w-20 h-20 border border-white/5 bg-white/[0.02] flex items-center justify-center mx-auto mb-10 group">
          <Bookmark className="w-8 h-8 text-zinc-600 group-hover:text-accent-gold transition-colors duration-500" />
        </div>
        <p className="monumental-type opacity-40 mb-4">Registry Inactive</p>
        <h1 className="text-5xl font-serif font-bold text-white mb-8 tracking-tight">
          Archives Empty
        </h1>
        <p className="text-xl text-zinc-500 mb-16 max-w-xl mx-auto legal-text italic font-serif">
          No statutory sections have been prioritized for the permanent registry yet.
        </p>

        <div className="glass-panel p-16 border-white/5 max-w-2xl mx-auto">
          <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">
            Browse the vault and use the archive trigger to populate this registry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent max-w-5xl mx-auto px-6 py-24">
      <div className="flex items-center justify-between mb-16 pb-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
            <Bookmark className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <p className="monumental-type opacity-40 mb-1">Archived Statutes</p>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">Personal Registry</h1>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
            {bookmarks.length} Entries
        </span>
      </div>

      <div className="grid gap-6">
        {bookmarks.map((bm, idx) => (
          <div
            key={`${bm.law_key}-${bm.norm_id || ""}-${idx}`}
            className="premium-card p-10 flex items-start justify-between gap-10 group/item bg-zinc-950/20 border-white/5"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-6 mb-6">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold/60">
                  {bm.category}
                </span>
                {bm.norm_id && (
                  <span className="text-[10px] font-mono font-black bg-white/5 text-zinc-400 border border-white/10 px-3 py-1">
                    Section {bm.norm_id}
                  </span>
                )}
              </div>

              <Link
                href={`/laws/${bm.law_key}`}
                className="text-2xl font-serif font-bold text-white hover:text-accent-gold-bright transition-colors duration-500 block leading-tight"
              >
                <span className="text-accent-gold/40 mr-3">{bm.law_key}</span>
                {bm.law_title}
              </Link>

              {bm.norm_title && (
                <p className="text-lg text-zinc-500 font-serif italic mt-3 opacity-60">{bm.norm_title}</p>
              )}

              {bm.snippet && (
                <p className="legal-text text-zinc-400 mt-6 line-clamp-2 italic bg-white/[0.02] p-4 border-l border-accent-gold/20">
                  {bm.snippet}
                </p>
              )}

              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-700 mt-8">
                Authenticated Registry Entry — {bm.added_at}
              </p>
            </div>

            <button
              onClick={() => handleRemove(bm.law_key, bm.norm_id)}
              className="p-3 text-zinc-800 hover:text-red-900 transition-all duration-500 active:scale-90 group-hover/item:text-zinc-600"
              title="Remove from Archives"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
