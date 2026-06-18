"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LawSearchResult } from "../lib/types";
import { ChevronRight, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { isBookmarked, addBookmark, removeBookmark } from "../lib/bookmarks";
import { useToast } from "./toast";

export default function LawCard({ law }: { law: LawSearchResult }) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(law.key));
  const { toast } = useToast();

  useEffect(() => {
    setBookmarked(isBookmarked(law.key));
  }, [law.key]);

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(law.key);
      setBookmarked(false);
      toast("Bookmark removed", "info");
    } else {
      addBookmark({
        law_key: law.key,
        law_title: law.title,
        category: law.category,
        added_at: new Date().toISOString().split("T")[0],
      });
      setBookmarked(true);
      toast("Bookmark added", "success");
    }
  };

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.7),0_2px_4px_rgba(0,0,0,0.5)] hover:border-[#888888] transition-shadow relative">
      <button
        onClick={toggleBookmark}
        className={`absolute top-4 right-4 p-1.5 transition-colors duration-100 active:translate-y-[1px] ${
          bookmarked ? "text-[#888888]" : "text-[#6b6b6b] hover:text-[#888888]"
        }`}
        title={bookmarked ? "Remove bookmark" : "Add bookmark"}
      >
        {bookmarked ? (
          <BookmarkCheck className="w-5 h-5" />
        ) : (
          <BookmarkPlus className="w-5 h-5" />
        )}
      </button>

      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="inline-block px-2 py-1 text-xs font-semibold bg-[#888888] text-[#e8e8e8] mb-2 capitalize">
            {law.category}
          </span>
          <h3 className="text-xl font-bold text-[#e8e8e8]">
            <Link
              href={`/laws/${law.key}`}
              className="hover:text-[#888888] transition-colors duration-100 active:translate-y-[1px]"
            >
              {law.key} — {law.title}
            </Link>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-sm text-[#888888] font-semibold">
            {law.relevance}% relevant
          </div>
          <div className="text-xs text-[#a3a3a3]">{law.normHits} matches</div>
        </div>
      </div>

      <div className="space-y-3">
        {law.relevantNorms.map((norm, idx) => (
          <div key={idx} className="bg-[#1a1a1a] p-3 border border-[#2a2a2a]">
            <h4 className="text-sm font-semibold text-[#e8e8e8] mb-1">
              {norm.normId} {norm.title}
            </h4>
            <p className="text-sm text-[#a3a3a3] line-clamp-2">
              {norm.content}
            </p>
          </div>
        ))}
      </div>

      <Link
        href={`/laws/${law.key}`}
        className="mt-4 flex items-center text-sm font-medium text-[#888888] hover:text-[#aaaaaa] transition-colors duration-100 active:translate-y-[1px]"
      >
        View full law <ChevronRight className="w-4 h-4 ml-1" />
      </Link>
    </div>
  );
}
