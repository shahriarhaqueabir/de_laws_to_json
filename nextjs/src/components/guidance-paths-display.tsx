"use client";

import { useState } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Euro,
  Gavel,
  BookOpen,
  Lightbulb,
  Sparkles,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { GuidancePath, FolderContext } from "../lib/guidance";
import type { AppLanguage } from "../lib/types";

// ── Helpers: explain legal concepts in plain language ──────────────────────

function getRiskIcon(level: "low" | "medium" | "high") {
  switch (level) {
    case "low":
      return ShieldCheck;
    case "medium":
      return ShieldAlert;
    case "high":
      return Shield;
  }
}

function getRiskColor(level: "low" | "medium" | "high") {
  switch (level) {
    case "low":
      return {
        badge: "bg-green-900/30 text-green-400 border-green-800/40",
        bg: "from-green-950/20 to-transparent",
        border: "border-green-800/20",
        glow: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
      };
    case "medium":
      return {
        badge: "bg-amber-900/30 text-amber-400 border-amber-800/40",
        bg: "from-amber-950/20 to-transparent",
        border: "border-amber-800/20",
        glow: "shadow-[0_0_15px_rgba(251,191,36,0.15)]",
      };
    case "high":
      return {
        badge: "bg-red-900/30 text-red-400 border-red-800/40",
        bg: "from-red-950/20 to-transparent",
        border: "border-red-800/20",
        glow: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
      };
  }
}

function getRiskLabel(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return "Likely Favorable — Low Risk";
    case "medium":
      return "Uncertain — Moderate Risk";
    case "high":
      return "Significant Obstacles — High Risk";
  }
}

function getRiskHint(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return "This path has a good chance of working out well for you. The law is on your side here, and the costs are manageable.";
    case "medium":
      return "This path could go either way. Think of it as a calculated gamble — there are good arguments on both sides. A lawyer can help you assess your actual chances.";
    case "high":
      return "This path is an uphill battle. The law or the facts make it difficult to win. Before going down this route, get professional legal advice to understand what you're up against.";
  }
}

// ── Probability Label ──────────────────────────────────────────────────────

function getProbabilityLabel(p: number): string {
  if (p >= 0.8) return "Very Promising";
  if (p >= 0.6) return "Promising";
  if (p >= 0.4) return "Uncertain";
  if (p >= 0.2) return "Difficult";
  return "Very Difficult";
}

// ── Plain-language Timeline Hints ──────────────────────────────────────────

const TIMELINE_HINTS: Record<string, string> = {
  "2-6 weeks":
    "This is fairly quick. In German law, out-of-court steps usually move at this pace.",
  "3-12 months":
    "Court cases take time in Germany. Don't worry — most cases settle before trial.",
  "1-4 weeks":
    "This is very fast. Courts move quickly only for urgent matters (Eilverfahren).",
};

function getTimelineHint(timeline: string): string {
  for (const [key, hint] of Object.entries(TIMELINE_HINTS)) {
    if (timeline.includes(key)) return hint;
  }
  return "Timelines in German legal proceedings vary. A lawyer can give you a more precise estimate for your specific case.";
}

// ── Props ──────────────────────────────────────────────────────────────────

interface GuidancePathsDisplayProps {
  paths: GuidancePath[];
  folderContext: FolderContext | null;
  language: AppLanguage;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GuidancePathsDisplay({
  paths,
  folderContext,
  language,
}: GuidancePathsDisplayProps) {
  const [expandedPath, setExpandedPath] = useState<number | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  const toggleExpand = (num: number) => {
    setExpandedPath(expandedPath === num ? null : num);
  };

  const handleGenerateDoc = async (pathNumber: number) => {
    setGeneratingDoc(`path-${pathNumber}`);
    // In production: POST /api/guidance/generate-doc
    await new Promise((r) => setTimeout(r, 2000));
    setGeneratingDoc(null);
  };

  if (paths.length === 0) {
    return (
      <div className="glass-panel p-12 border-white/5 text-center">
        <AlertTriangle className="w-8 h-8 text-accent-amber mx-auto mb-4" />
        <p className="text-zinc-400">
          No guidance paths could be generated. Try describing your situation in
          more detail.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-accent-cobalt" />
          <h2 className="font-serif font-bold text-2xl text-white">
            Your Possible Paths Forward
          </h2>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">
          {paths.length} of 5 paths shown
        </span>
      </div>

      {/* Tip Strip */}
      <div className="flex items-start gap-3 p-4 bg-accent-cobalt/5 border border-accent-cobalt/10">
        <Lightbulb className="w-4 h-4 text-accent-cobalt flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-white font-bold">Tip:</span> These are possible
          ways forward based on German law. Each path has different risks,
          costs, and timelines.{" "}
          <span className="text-accent-cobalt">
            Click on a path to expand it and see step-by-step instructions.
          </span>{" "}
          You&apos;re not locked into any choice — this is just to help you
          understand your options.
        </p>
      </div>

      {/* Paths */}
      <div className="space-y-6">
        {paths.map((path) => {
          const RiskIcon = getRiskIcon(path.risk_level);
          const colors = getRiskColor(path.risk_level);
          const isExpanded = expandedPath === path.path_number;

          return (
            <div
              key={path.path_number}
              className={`glass-panel border ${colors.border} ${colors.glow} transition-all duration-500 overflow-hidden`}
            >
              {/* Header — clickable to expand */}
              <button
                onClick={() => toggleExpand(path.path_number)}
                className="w-full text-left p-8 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Path Number */}
                  <div
                    className={`flex-shrink-0 w-10 h-10 flex items-center justify-center text-lg font-bold font-serif ${colors.badge.replace(
                      "text-green-400",
                      "text-white",
                    )} border ${colors.border}`}
                  >
                    {path.path_number}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="text-xl font-serif font-bold text-white leading-tight">
                        {path.title}
                      </h3>

                      {/* Cost Badge */}
                      {path.cost_estimate !== null &&
                        path.cost_estimate > 0 && (
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
                              Est. Cost
                            </div>
                            <div className="text-sm font-bold text-white flex items-center gap-1">
                              <Euro className="w-3 h-3 text-accent-amber" />€
                              {path.cost_estimate.toLocaleString()}
                            </div>
                          </div>
                        )}
                    </div>

                    <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                      {path.summary}
                    </p>

                    {/* Tags Row */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Risk Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.1em] border ${colors.badge}`}
                      >
                        <RiskIcon className="w-3 h-3" />
                        {getRiskLabel(path.risk_level)}
                      </span>

                      {/* Timeline */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.1em] bg-white/5 text-zinc-400 border border-white/10">
                        <Clock className="w-3 h-3" />
                        {path.estimated_timeline}
                      </span>

                      {/* Success Probability */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.1em] bg-white/5 text-zinc-400 border border-white/10">
                        <CheckCircle2 className="w-3 h-3" />
                        {getProbabilityLabel(path.success_probability)} (
                        {Math.round(path.success_probability * 100)}%)
                      </span>
                    </div>
                  </div>

                  {/* Expand Indicator */}
                  <div className="flex-shrink-0 text-zinc-600">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-8 pb-8 pt-2 border-t border-white/5 animate-fade-in">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content — takes 2 columns */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Detailed Analysis */}
                      <section>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3">
                          Detailed Analysis
                        </h4>
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                          {path.detailed_analysis}
                        </div>
                      </section>

                      {/* Risk Hint */}
                      <section className="flex items-start gap-3 p-4 bg-white/[0.02] border border-white/5">
                        <AlertTriangle className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-zinc-400 leading-relaxed">
                            {getRiskHint(path.risk_level)}
                          </p>
                          {path.risk_reason && (
                            <p className="text-xs text-zinc-500 mt-2 italic">
                              Why: {path.risk_reason}
                            </p>
                          )}
                        </div>
                      </section>

                      {/* Step-by-Step Actions */}
                      <section>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3">
                          Step-by-Step Plan
                        </h4>
                        <div className="space-y-3">
                          {path.recommended_actions.map((action, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/5"
                            >
                              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[9px] font-bold bg-accent-cobalt/20 text-accent-cobalt border border-accent-cobalt/20">
                                {i + 1}
                              </span>
                              <span className="text-sm text-zinc-300">
                                {action}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Quick Tip */}
                      <section className="flex items-start gap-3 p-4 bg-accent-cobalt/5 border border-accent-cobalt/10">
                        <Lightbulb className="w-4 h-4 text-accent-cobalt flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-zinc-400">
                            <span className="text-white font-bold">
                              Quick Tip:
                            </span>{" "}
                            {getTimelineHint(path.estimated_timeline)}
                          </p>
                        </div>
                      </section>
                    </div>

                    {/* Sidebar — takes 1 column */}
                    <div className="space-y-6">
                      {/* Cost Breakdown */}
                      {path.cost_breakdown && (
                        <section className="p-5 bg-black/40 border border-white/5">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">
                            Cost Breakdown
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">
                                Court Fees (GKG)
                              </span>
                              <span className="text-white font-bold">
                                €
                                {path.cost_breakdown.court_fees.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">
                                Lawyer Fees (RVG)
                              </span>
                              <span className="text-white font-bold">
                                €
                                {path.cost_breakdown.lawyer_fees.toLocaleString()}
                              </span>
                            </div>
                            <div className="border-t border-white/5 pt-3 flex justify-between text-sm">
                              <span className="text-zinc-500">
                                Total Risk (if you lose)
                              </span>
                              <span className="text-accent-amber font-bold">
                                €
                                {path.cost_breakdown.total_risk.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-[9px] text-zinc-700 mt-3">
                            Based on Streitwert of €
                            {folderContext?.dispute_value?.toLocaleString() ||
                              "?"}{" "}
                            (RVG/GKG simplified calculation). Actual costs may
                            vary.
                          </p>
                        </section>
                      )}

                      {/* Cited Laws */}
                      {path.laws_cited.length > 0 && (
                        <section className="p-5 bg-black/40 border border-white/5">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">
                            Relevant Laws Used
                          </h4>
                          <div className="space-y-2">
                            {path.laws_cited.map((law, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 text-xs"
                              >
                                <Gavel className="w-3 h-3 text-accent-cobalt flex-shrink-0 mt-0.5" />
                                <div>
                                  <a
                                    href={`/laws/${law.law_key}`}
                                    className="text-accent-cobalt hover:text-white transition-colors font-bold"
                                  >
                                    {law.law_key} {law.norm_id}
                                  </a>
                                  <p className="text-zinc-500">
                                    {law.law_title}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[9px] text-zinc-700 mt-3 flex items-center gap-1">
                            <Search className="w-2.5 h-2.5" />
                            Click a law to read its full text
                          </p>
                        </section>
                      )}

                      {/* Generate Document */}
                      <button
                        onClick={() => handleGenerateDoc(path.path_number)}
                        disabled={generatingDoc === `path-${path.path_number}`}
                        className="w-full flex items-center justify-center gap-2 p-4 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent-cobalt/10 text-accent-cobalt border border-accent-cobalt/20 hover:bg-accent-cobalt/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingDoc === `path-${path.path_number}` ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            Generating Document...
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            Generate Draft Document
                          </>
                        )}
                      </button>

                      <div className="flex items-start gap-2 p-3 bg-amber-900/10 border border-amber-900/20">
                        <AlertTriangle className="w-3 h-3 text-accent-amber flex-shrink-0 mt-0.5" />
                        <p className="text-[9px] text-zinc-500">
                          This is a draft based on your situation. Have a lawyer
                          (Rechtsanwalt) review it before using it officially.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Tip */}
      <div className="flex items-center justify-center gap-3 p-6 bg-white/[0.02] border border-white/5">
        <BookOpen className="w-4 h-4 text-zinc-600" />
        <p className="text-xs text-zinc-500 text-center">
          <span className="text-white font-bold">Remember:</span> This guidance
          is for informational purposes only. For specific legal advice, consult
          a licensed German attorney (Rechtsanwalt).{" "}
          <a
            href="/bookmarks"
            className="text-accent-cobalt hover:text-white transition-colors"
          >
            Save relevant laws to your Archives
          </a>{" "}
          to build your case folder.
        </p>
      </div>
    </div>
  );
}
