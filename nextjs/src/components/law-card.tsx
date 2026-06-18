'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LawSearchResult } from '../lib/types';
import { ChevronRight, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { isBookmarked, addBookmark, removeBookmark } from '../lib/bookmarks';
import { useToast } from './toast';

export default function LawCard({ law }: { law: LawSearchResult }) {
  const [bookmarked, setBookmarked] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setBookmarked(isBookmarked(law.key));
  }, []);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(law.key);
      setBookmarked(false);
      toast('Bookmark removed', 'info');
    } else {
      addBookmark({
        law_key: law.key,
        law_title: law.title,
        category: law.category,
        added_at: new Date().toISOString().split('T')[0],
      });
      setBookmarked(true);
      toast('Bookmark added', 'success');
    }
  };

  return (
    <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-none p-6 hover:border-[#777777] transition-colors relative">
      <button
        onClick={toggleBookmark}
        className={`absolute top-4 right-4 p-1.5 transition-all duration-100 active:translate-y-[1px] ${
          bookmarked ? 'text-[#777777]' : 'text-[#555555] hover:text-[#777777]'
        }`}
        title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        {bookmarked ? <BookmarkCheck className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
      </button>

      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="inline-block px-2 py-1 text-xs font-semibold bg-[#777777] text-[#070707] mb-2 capitalize rounded-none">
            {law.category}
          </span>
          <h3 className="text-xl font-bold text-[#cccccc]">
            <Link href={`/laws/${law.key}`} className="hover:text-[#999999] transition-all duration-100 active:translate-y-[1px]">
              {law.key} — {law.title}
            </Link>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-green-600 dark:text-green-400">
            {law.relevance}% relevant
          </div>
          <div className="text-xs text-[#888888]">
            {law.normHits} matches
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {law.relevantNorms.map((norm, idx) => (
          <div key={idx} className="bg-[#070707] p-3 rounded-none border border-[#1a1a1a]">
                      <h4 className="text-sm font-semibold text-[#cccccc] mb-1">
                        {norm.normId} {norm.title}
                      </h4>
                      <p className="text-sm text-[#888888] line-clamp-2">
              {norm.content}
            </p>
          </div>
        ))}
      </div>

      <Link
        href={`/laws/${law.key}`}
        className="mt-4 flex items-center text-sm font-medium text-[#777777] hover:text-[#999999] transition-all duration-100 active:translate-y-[1px]"
      >
        View full law <ChevronRight className="w-4 h-4 ml-1" />
      </Link>
    </div>
  );
}
