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
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-none p-6 hover:border-[#c4a86a] transition-colors relative">
      <button
        onClick={toggleBookmark}
        className={`absolute top-4 right-4 p-1.5 transition-all duration-100 active:translate-y-[1px] ${
          bookmarked ? 'text-[#c4a86a]' : 'text-[#6b6a66] hover:text-[#c4a86a]'
        }`}
        title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        {bookmarked ? <BookmarkCheck className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
      </button>

      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="inline-block px-2 py-1 text-xs font-semibold bg-[#c4a86a] text-[#0d0d0d] mb-2 capitalize rounded-none">
            {law.category}
          </span>
          <h3 className="text-xl font-bold text-[#e8e6e3]">
            <Link href={`/laws/${law.key}`} className="hover:text-[#c4a86a] transition-all duration-100 active:translate-y-[1px]">
              {law.key} — {law.title}
            </Link>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-green-600 dark:text-green-400">
            {law.relevance}% relevant
          </div>
          <div className="text-xs text-[#a09e9a]">
            {law.normHits} matches
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {law.relevantNorms.map((norm, idx) => (
          <div key={idx} className="bg-[#0d0d0d] p-3 rounded-none border border-[#2a2a2a]">
                      <h4 className="text-sm font-semibold text-[#e8e6e3] mb-1">
                        {norm.normId} {norm.title}
                      </h4>
                      <p className="text-sm text-[#a09e9a] line-clamp-2">
              {norm.content}
            </p>
          </div>
        ))}
      </div>

      <Link
        href={`/laws/${law.key}`}
        className="mt-4 flex items-center text-sm font-medium text-[#c4a86a] hover:text-[#d4b87a] transition-all duration-100 active:translate-y-[1px]"
      >
        View full law <ChevronRight className="w-4 h-4 ml-1" />
      </Link>
    </div>
  );
}
