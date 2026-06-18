'use client';

import { Bookmark, ShieldAlert } from 'lucide-react';

export default function BookmarksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <div className="bg-pink-100 dark:bg-pink-900/30 w-16 h-16 rounded-2xl flex items-center justify-center text-pink-600 mx-auto mb-6 shadow-lg shadow-pink-500/20">
        <Bookmark className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Saved Bookmarks</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto">
        Keep track of the legal sections most relevant to you.
      </p>

      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-12 text-center max-w-2xl mx-auto">
        <p className="text-gray-500 dark:text-gray-400">
          You have not saved any laws yet. Browse the vault and click the bookmark icon to save a section.
        </p>
      </div>
    </div>
  );
}
