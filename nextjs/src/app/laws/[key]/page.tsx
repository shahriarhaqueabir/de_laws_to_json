'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import NormViewer from '../../../components/norm-viewer';
import { Law, Norm } from '../../../lib/types';
import { Loader2, ArrowLeft, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import Link from 'next/link';
import { isBookmarked, addBookmark, removeBookmark } from '../../../lib/bookmarks';
import { useToast } from '../../../components/toast';

export default function LawDetailPage() {
  const { key } = useParams();
  const [data, setData] = useState<(Law & { norms: Norm[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!key) return;

    const fetchLaw = async () => {
      try {
        const res = await fetch(`/api/laws/${key}`);
        if (!res.ok) throw new Error('Failed to load law details');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError('Law not found or could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchLaw();
  }, [key]);

  useEffect(() => {
    if (data) setBookmarked(isBookmarked(data.key));
  }, [data]);

  const toggleBookmark = () => {
    if (!data) return;
    if (bookmarked) {
      removeBookmark(data.key);
      setBookmarked(false);
      toast('Bookmark removed', 'info');
    } else {
      addBookmark({
        law_key: data.key,
        law_title: data.title,
        category: data.category,
        added_at: new Date().toISOString().split('T')[0],
      });
      setBookmarked(true);
      toast('Law bookmarked', 'success');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-[#777777] animate-spin" />
        <p className="mt-4 text-[#888888]">Loading law and paragraphs...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">{error || 'Law not found'}</h2>
        <Link href="/" className="text-[#777777] hover:underline flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#888888] hover:text-[#999999] mb-8 transition-all duration-100 active:translate-y-[1px]">
        <ArrowLeft className="w-4 h-4" /> Back to search
      </Link>

      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 text-sm font-bold bg-[#777777] text-[#070707] rounded-none">
            {data.key}
          </span>
          <span className="text-sm font-medium text-[#888888] uppercase tracking-widest">
            {data.category}
          </span>
          <button
            onClick={toggleBookmark}
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-none border transition-all duration-100 active:translate-y-[1px] ${
              bookmarked
                ? 'bg-[#777777] text-[#070707] border-[#777777]'
                : 'bg-transparent text-[#888888] border-[#1a1a1a] hover:border-[#777777] hover:text-[#777777]'
            }`}
          >
            {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            {bookmarked ? 'Bookmarked' : 'Bookmark This Law'}
          </button>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#cccccc] mb-4 leading-tight">
          {data.title}
        </h1>
        {data.alt_title && (
          <p className="text-xl text-[#888888] italic mb-6">
            ({data.alt_title})
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-b border-[#1a1a1a] py-6 my-8">
          <div>
            <span className="block text-[#888888] mb-1">Status</span>
            <span className="font-semibold text-[#cccccc]">{data.status}</span>
          </div>
          <div>
            <span className="block text-[#888888] mb-1">Authority</span>
            <span className="font-semibold text-[#cccccc]">{data.authority}</span>
          </div>
          <div>
            <span className="block text-[#888888] mb-1">Last Changed</span>
            <span className="font-semibold text-[#cccccc]">{data.last_changed || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-[#888888] mb-1">Paragraphs</span>
            <span className="font-semibold text-[#cccccc]">{data.total_norms}</span>
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-[#cccccc] mb-6">
          Paragraphs (Normen)
        </h2>
        <div className="space-y-4">
          {data.norms && data.norms.length > 0 ? (
            data.norms.map((norm, idx) => (
              <NormViewer
                key={idx}
                normId={norm.norm_id}
                lawKey={data.key}
                title={norm.norm_title}
                content={norm.content}
              />
            ))
          ) : (
            <div className="text-center py-10 bg-[#0e0e0e] rounded-none">
              <p className="text-[#888888] italic">No paragraphs available for this law in the vector store.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
