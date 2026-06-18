'use client';

import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Languages, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface NormViewerProps {
  normId: string;
  title: string;
  content: string;
}

export default function NormViewer({ normId, title, content }: NormViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const { translate, translating } = useTranslation();

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (translation) return;
    try {
      const result = await translate(content);
      setTranslation(result);
    } catch {
      alert('Translation failed. The model might still be loading (~600MB).');
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 mb-3 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex-1">
          <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">{normId}</span>
          <span className="font-medium text-gray-900 dark:text-white">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {expanded && (
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {!translation ? (
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition-colors"
              >
                {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                {translating ? 'Downloading translation model...' : 'Translate to English (Offline AI)'}
              </button>
            ) : (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                  <Languages className="w-3 h-3" />
                  English Translation
                </div>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed italic">
                  {translation}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
