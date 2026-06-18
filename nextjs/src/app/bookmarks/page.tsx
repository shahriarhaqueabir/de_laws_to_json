'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, Trash2 } from 'lucide-react';
import { getBookmarks, removeBookmark, type Bookmark as BookmarkType } from '../../lib/bookmarks';

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);

  useEffect(() => {
    setBookmarks(getBookmarks());
  }, []);

  const handleRemove = (lawKey: string, normId?: string) => {
    removeBookmark(lawKey, normId);
    setBookmarks(getBookmarks());
  };

  if (bookmarks.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="bg-[#2a2a2a] w-16 h-16 flex items-center justify-center text-pink-600 mx-auto mb-6 rounded-none">
          <Bookmark className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-[#e8e6e3] mb-4">Saved Bookmarks</h1>
        <p className="text-xl text-[#a09e9a] mb-10 max-w-2xl mx-auto">
          Keep track of the legal sections most relevant to you.
        </p>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-12 text-center max-w-2xl mx-auto rounded-none">
          <p className="text-[#a09e9a]">
            You have not saved any laws yet. Browse the vault and click the bookmark icon to save a section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-[#2a2a2a] w-10 h-10 flex items-center justify-center rounded-none">
          <Bookmark className="w-5 h-5 text-[#c4a86a]" />
        </div>
        <h1 className="text-3xl font-bold text-[#e8e6e3]">Saved Bookmarks</h1>
        <span className="text-sm text-[#6b6a66] ml-2">({bookmarks.length})</span>
      </div>

      <div className="grid gap-4">
        {bookmarks.map((bm, idx) => (
          <div
            key={`${bm.law_key}-${bm.norm_id || ''}-${idx}`}
            className="bg-[#1a1a1a] border border-[#2a2a2a] p-6 flex items-start justify-between gap-4 rounded-none"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-[#c4a86a] text-[#0d0d0d] capitalize rounded-none">
                  {bm.category}
                </span>
                {bm.norm_id && (
                  <span className="text-xs font-mono text-[#6b6a66] bg-[#2a2a2a] px-2 py-0.5 rounded-none">
                    {bm.norm_id}
                  </span>
                )}
              </div>

              <Link
                href={`/laws/${bm.law_key}`}
                className="text-lg font-bold text-[#e8e6e3] hover:text-[#c4a86a] transition-all duration-100 active:translate-y-[1px]"
              >
                {bm.law_key} — {bm.law_title}
              </Link>

              {bm.norm_title && (
                <p className="text-sm text-[#a09e9a] mt-1">{bm.norm_title}</p>
              )}

              {bm.snippet && (
                <p className="text-sm text-[#6b6a66] mt-2 line-clamp-2 italic">
                  {bm.snippet}
                </p>
              )}

              <p className="text-xs text-[#6b6a66] mt-2">
                Added {bm.added_at}
              </p>
            </div>

            <button
              onClick={() => handleRemove(bm.law_key, bm.norm_id)}
              className="p-2 text-[#6b6a66] hover:text-red-500 transition-all duration-100 active:translate-y-[1px] shrink-0"
              title="Remove bookmark"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
