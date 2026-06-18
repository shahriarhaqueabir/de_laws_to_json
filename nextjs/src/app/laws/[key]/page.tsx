'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import NormViewer from '../../../components/norm-viewer';
import { Law, Norm } from '../../../lib/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LawDetailPage() {
  const { key } = useParams();
  const [data, setData] = useState<(Law & { norms: Norm[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="mt-4 text-gray-500">Loading law and paragraphs...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">{error || 'Law not found'}</h2>
        <Link href="/" className="text-blue-600 hover:underline flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-8 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to search
      </Link>

      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 text-sm font-bold bg-blue-600 text-white rounded-md">
            {data.key}
          </span>
          <span className="text-sm font-medium text-gray-500 uppercase tracking-widest">
            {data.category}
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight">
          {data.title}
        </h1>
        {data.alt_title && (
          <p className="text-xl text-gray-600 dark:text-gray-400 italic mb-6">
            ({data.alt_title})
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-b border-gray-200 dark:border-gray-800 py-6 my-8">
          <div>
            <span className="block text-gray-500 mb-1">Status</span>
            <span className="font-semibold text-gray-900 dark:text-white">{data.status}</span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Authority</span>
            <span className="font-semibold text-gray-900 dark:text-white">{data.authority}</span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Last Changed</span>
            <span className="font-semibold text-gray-900 dark:text-white">{data.last_changed || 'N/A'}</span>
          </div>
          <div>
            <span className="block text-gray-500 mb-1">Paragraphs</span>
            <span className="font-semibold text-gray-900 dark:text-white">{data.total_norms}</span>
          </div>
        </div>
      </header>

      <section>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Paragraphs (Normen)
        </h2>
        <div className="space-y-4">
          {data.norms && data.norms.length > 0 ? (
            data.norms.map((norm, idx) => (
              <NormViewer
                key={idx}
                normId={norm.norm_id}
                title={norm.norm_title}
                content={norm.content}
              />
            ))
          ) : (
            <div className="text-center py-10 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <p className="text-gray-500 italic">No paragraphs available for this law in the vector store.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
