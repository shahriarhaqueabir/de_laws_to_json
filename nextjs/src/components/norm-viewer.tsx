'use client';

import { useState, useEffect } from 'react';
import { Languages, Loader2, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { AppLanguage, LANGUAGE_NAMES, NormExplanation, ChatSettings, DEFAULT_CHAT_SETTINGS } from '../lib/types';
import { useToast } from './toast';

const STORAGE_KEY = 'glv_chat_settings';

interface NormViewerProps {
  normId: string;
  lawKey: string;
  title: string;
  content: string;
}

export default function NormViewer({ normId, lawKey, title, content }: NormViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState<NormExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const { toast } = useToast();

  // Load settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings({ ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) });
      }
    } catch {}
  }, []);

  const handleExplain = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (explanation) return;
    setExplaining(true);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          normId,
          lawKey,
          lawTitle: title,
          content,
          lang: settings.language,
          mode: settings.mode === 'basic' ? 'cloud' : settings.mode,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          customEndpoint: settings.customEndpoint,
          brokerUrl: settings.brokerUrl,
          ollamaModel: settings.ollamaModel,
          ollamaParams: settings.ollamaParams,
        }),
      });
      if (!res.ok) throw new Error('Explanation failed');
      const data = (await res.json()) as NormExplanation;
      setExplanation(data);
    } catch {
      toast('Failed to generate explanation. Check your AI settings.', 'error');
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="border border-[#1a1a1a] rounded-none overflow-hidden bg-[#0e0e0e] mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1a1a1a] transition-all duration-100 active:translate-y-[1px]"
      >
        <div className="flex-1">
          <span className="font-bold text-[#777777] mr-2">{normId}</span>
          <span className="font-medium text-[#cccccc]">{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-[#555555]" /> : <ChevronDown className="w-5 h-5 text-[#555555]" />}
      </button>

      {expanded && (
        <div className="p-4 border-t border-[#1a1a1a]">
          <div className="prose dark:prose-invert max-w-none text-[#cccccc] whitespace-pre-wrap leading-relaxed">
            {content}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {!explanation ? (
              <button
                onClick={handleExplain}
                disabled={explaining}
                className="flex items-center gap-2 text-sm font-medium text-[#777777] hover:text-[#999999] disabled:text-[#555555] transition-all duration-100 active:translate-y-[1px]"
              >
                {explaining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                {explaining ? 'Generating explanation...' : `Explain in ${LANGUAGE_NAMES[settings.language]}`}
              </button>
            ) : (
              <div className="space-y-4">
                {/* Translation */}
                <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] rounded-none">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#777777] uppercase tracking-wider mb-2">
                    <Languages className="w-3 h-3" />
                    Translation
                  </div>
                  <p className="text-[#cccccc] leading-relaxed">{explanation.translation}</p>
                </div>

                {/* Summary */}
                <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] rounded-none">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#777777] uppercase tracking-wider mb-2">
                    <Scale className="w-3 h-3" />
                    Summary
                  </div>
                  <p className="text-[#cccccc] leading-relaxed">{explanation.summary}</p>
                </div>

                {/* Implications */}
                <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] rounded-none">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#777777] uppercase tracking-wider mb-2">
                    <Scale className="w-3 h-3" />
                    Implications
                  </div>
                  <p className="text-[#cccccc] leading-relaxed">{explanation.implications}</p>
                </div>

                {/* Next Steps */}
                <div className="p-4 bg-[#0e0e0e] border border-[#1a1a1a] rounded-none">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#777777] uppercase tracking-wider mb-2">
                    <Scale className="w-3 h-3" />
                    Next Steps
                  </div>
                  <p className="text-[#cccccc] leading-relaxed">{explanation.next_steps}</p>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-[#555555] italic mt-2">
                  {explanation.disclaimer || 'AI-generated legal guidance is not a substitute for professional legal advice.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
