'use client';

import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { Languages, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from './toast';

interface NormViewerProps {
  normId: string;
  title: string;
  content: string;
}

export default function NormViewer({ normId, title, content }: NormViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const { translate, translating } = useTranslation();
  const { toast } = useToast();

  const handleTranslate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (translation) return;
    try {
      const result = await translate(content);
      setTranslation(result);
    } catch {
      toast('Translation failed. The model might still be loading (~300MB).', 'error');
    }
  };

  return (
    <div className="border border-[#2a2a2a] rounded-none overflow-hidden bg-[#1a1a1a] mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-[#2a2a2a] transition-all duration-100 active:translate-y-[1px]"
          >
            <div className="flex-1">
              <span className="font-bold text-[#c4a86a] mr-2">{normId}</span>
              <span className="font-medium text-[#e8e6e3]">{title}</span>
            </div>
            {expanded ? <ChevronUp className="w-5 h-5 text-[#6b6a66]" /> : <ChevronDown className="w-5 h-5 text-[#6b6a66]" />}
      </button>

      {expanded && (
        <div className="p-4 border-t border-[#2a2a2a]">
                  <div className="prose dark:prose-invert max-w-none text-[#e8e6e3] whitespace-pre-wrap leading-relaxed">
            {content}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {!translation ? (
              <button
                onClick={handleTranslate}
                disabled={translating}
                className="flex items-center gap-2 text-sm font-medium text-[#c4a86a] hover:text-[#d4b87a] disabled:text-[#6b6a66] transition-all duration-100 active:translate-y-[1px]"
              >
                {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                {translating ? 'Downloading translation model...' : 'Translate to English (Offline AI)'}
              </button>
            ) : (
              <div className="p-4 bg-[#2a2a2a] rounded-none border border-[#2a2a2a]">
                              <div className="flex items-center gap-2 text-xs font-bold text-[#c4a86a] uppercase tracking-wider mb-2">
                                <Languages className="w-3 h-3" />
                                English Translation
                              </div>
                              <p className="text-[#e8e6e3] leading-relaxed italic">
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
