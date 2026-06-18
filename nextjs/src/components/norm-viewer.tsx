"use client";

import { useState } from "react";
import {
  Languages,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scale,
} from "lucide-react";
import {
  AppLanguage,
  LANGUAGE_NAMES,
  NormExplanation,
  ChatSettings,
  DEFAULT_CHAT_SETTINGS,
} from "../lib/types";
import { useToast } from "./toast";

const STORAGE_KEY = "glv_chat_settings";

interface NormViewerProps {
  normId: string;
  lawKey: string;
  title: string;
  content: string;
}

export default function NormViewer({
  normId,
  lawKey,
  title,
  content,
}: NormViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState<NormExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {}
    return DEFAULT_CHAT_SETTINGS;
  });
  const { toast } = useToast();

  const handleExplain = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (explanation) return;
    setExplaining(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          normId,
          lawKey,
          lawTitle: title,
          content,
          lang: settings.language,
          mode: settings.mode === "basic" ? "cloud" : settings.mode,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          customEndpoint: settings.customEndpoint,
          brokerUrl: settings.brokerUrl,
          ollamaModel: settings.ollamaModel,
          ollamaParams: settings.ollamaParams,
        }),
      });
      if (!res.ok) throw new Error("Explanation failed");
      const data = (await res.json()) as NormExplanation;
      setExplanation(data);
    } catch {
      toast("Failed to generate explanation. Check your AI settings.", "error");
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="premium-card overflow-hidden mb-4 group/norm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#1a1a1a]/50 transition-colors duration-200"
      >
        <div className="flex-1">
          <span className="text-accent-cobalt font-bold mr-3 text-sm tracking-wider uppercase">{normId}</span>
          <span className="font-serif font-semibold text-[#f0f0f0] text-lg">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          {!explanation && !expanded && (
             <div
               className="hidden group-hover/norm:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b6b6b] animate-pulse"
               onClick={handleExplain}
             >
               <div className="w-2 h-2 rounded-full bg-accent-cobalt shadow-[0_0_8px_rgba(46,91,255,0.8)]" />
               AI Aura Active
             </div>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-[#6b6b6b]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#6b6b6b]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-6 border-t border-white/5 bg-[#0d0d0d]/30">
          <div className="legal-text text-[#a3a3a3] whitespace-pre-wrap">
            {content}
          </div>

          <div className="mt-8 flex flex-col gap-4">
            {!explanation ? (
              <button
                onClick={handleExplain}
                disabled={explaining}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#888888] hover:text-white disabled:text-[#2a2a2a] transition-all duration-300 group/btn"
              >
                {explaining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <div className="relative">
                    <Languages className="w-4 h-4" />
                    <div className="absolute inset-0 bg-accent-cobalt blur-md opacity-0 group-hover/btn:opacity-40 transition-opacity" />
                  </div>
                )}
                {explaining
                  ? "Distilling Knowledge..."
                  : `Reveal Insights in ${LANGUAGE_NAMES[settings.language]}`}
              </button>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-700">
                {/* Translation */}
                <div className="p-5 glass-panel border-l-2 border-l-accent-cobalt">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-accent-cobalt uppercase tracking-[0.2em] mb-3">
                    <Languages className="w-3 h-3" />
                    Official Interpretation
                  </div>
                  <p className="legal-text text-[#e8e8e8]">
                    {explanation.translation}
                  </p>
                </div>

                {/* Grid for other insights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/5 border border-white/5">
                    <div className="text-[9px] font-bold text-[#6b6b6b] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Scale className="w-3 h-3" /> Summary
                    </div>
                    <p className="text-sm text-[#a3a3a3] leading-relaxed italic">
                      {explanation.summary}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/5">
                    <div className="text-[9px] font-bold text-[#6b6b6b] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Scale className="w-3 h-3" /> Implications
                    </div>
                    <p className="text-sm text-[#a3a3a3] leading-relaxed">
                      {explanation.implications}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/5">
                    <div className="text-[9px] font-bold text-[#6b6b6b] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Scale className="w-3 h-3" /> Next Steps
                    </div>
                    <p className="text-sm text-[#a3a3a3] leading-relaxed font-medium text-[#e8e8e8]">
                      {explanation.next_steps}
                    </p>
                  </div>
                </div>

                {/* Disclaimer */}
                <p className="text-xs text-[#6b6b6b] italic mt-2">
                  {explanation.disclaimer ||
                    "AI-generated legal guidance is not a substitute for professional legal advice."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
