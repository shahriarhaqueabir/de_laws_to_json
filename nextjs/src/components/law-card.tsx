import Link from 'next/link';
import { LawSearchResult } from '../lib/types';
import { ChevronRight } from 'lucide-react';

export default function LawCard({ law }: { law: LawSearchResult }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mb-2 capitalize">
            {law.category}
          </span>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            <Link href={`/laws/${law.key}`} className="hover:text-blue-600 transition-colors">
              {law.key} — {law.title}
            </Link>
          </h3>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-green-600 dark:text-green-400">
            {law.relevance}% relevant
          </div>
          <div className="text-xs text-gray-500">
            {law.normHits} matches
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {law.relevantNorms.map((norm, idx) => (
          <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              {norm.normId} {norm.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {norm.content}
            </p>
          </div>
        ))}
      </div>

      <Link
        href={`/laws/${law.key}`}
        className="mt-4 flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        View full law <ChevronRight className="w-4 h-4 ml-1" />
      </Link>
    </div>
  );
}
