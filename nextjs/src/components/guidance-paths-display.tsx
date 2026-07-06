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
import type { GuidancePath, FolderContext } from "../lib/guidance-types";
import type { AppLanguage } from "../lib/types";
import { toast } from "sonner";
import { useLanguage } from "../hooks/useLanguage";

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

const TIMELINE_KEYS: Record<string, string> = {
  "2-6 weeks": "guidance.timeline_2_6_weeks",
  "3-12 months": "guidance.timeline_3_12_months",
  "1-4 weeks": "guidance.timeline_1_4_weeks",
};

function getTimelineHint(timeline: string, t: (key: string) => string): string {
  for (const [key, tKey] of Object.entries(TIMELINE_KEYS)) {
    if (timeline.includes(key)) return t(tKey);
  }
  return t("guidance.timeline_fallback");
}

function getProbabilityLabel(p: number, t: (key: string) => string): string {
  if (p >= 0.8) return t("guidance.prob_very_promising");
  if (p >= 0.6) return t("guidance.prob_promising");
  if (p >= 0.4) return t("guidance.prob_uncertain");
  if (p >= 0.2) return t("guidance.prob_difficult");
  return t("guidance.prob_very_difficult");
}

// ── Props ──────────────────────────────────────────────────────────────────

interface GuidancePathsDisplayProps {
  paths: GuidancePath[];
  folderContext: FolderContext | null;
  language: AppLanguage;
  situation: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GuidancePathsDisplay({
  paths,
  folderContext,
  language,
  situation,
}: GuidancePathsDisplayProps) {
  const { t } = useLanguage();
  const [expandedPath, setExpandedPath] = useState<number | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);

  const toggleExpand = (num: number) => {
    setExpandedPath(expandedPath === num ? null : num);
  };

  const TEMPLATE_MAP: Record<string, string> = {
    labor: "widerspruch",
    housing: "mahnung",
    consumer: "kuendigung",
    traffic: "einspruch",
    family: "klage",
    public: "widerspruch",
    other: "mahnung",
  };

  const handleGenerateDoc = async (pathNumber: number) => {
    const path = paths.find((p) => p.path_number === pathNumber);
    if (!path) return;

    // Require a folder context — the API needs a valid folder_id
    if (!folderContext || !folderContext.id) {
      toast.error("Create a case folder first to generate documents.", {
        description:
          "Select or create a folder from the dropdown above, then try again.",
      });
      return;
    }

    setGeneratingDoc(`path-${pathNumber}`);
    try {
      const template_slug = TEMPLATE_MAP[folderContext.category] || "mahnung";

      const res = await fetch("/api/guidance/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_slug,
          folder_id: folderContext.id,
          situation: situation || path.summary,
          provider: "openai",
          model: "gpt-4o-mini",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.message || `Document generation failed (${res.status})`,
        );
      }

      const data = await res.json();
      const doc = data.data || data;

      if (doc.content) {
        // Create a Blob and trigger download
        const blob = new Blob([doc.content], {
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `${template_slug}-${path.title.replace(/\s+/g, "-").toLowerCase().slice(0, 40)}.txt`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Document generated and downloaded");
      } else {
        toast.success("Document generated");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate document";
      toast.error(message);
    } finally {
      setGeneratingDoc(null);
    }
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
          <Sparkles className="w-6 h-6 text-accent-electric" />
          <h2 className="font-serif font-bold text-2xl text-white">
            {t("guidance.your_paths")}
          </h2>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600">
          {t("guidance.paths_shown", { n: paths.length })}
        </span>
      </div>

      {/* Tip Strip */}
      <div className="flex items-start gap-3 p-4 bg-accent-electric/5 border border-accent-electric/10">
        <Lightbulb className="w-4 h-4 text-accent-electric flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span className="text-white font-bold">
            {t("guidance.quick_tip")}:
          </span>{" "}
          {t("guidance.success_hint")}
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
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600">
                              {t("guidance.est_cost")}
                            </div>
                            <div className="text-sm font-bold text-white flex items-center gap-1 tabular-nums">
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
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] border ${colors.badge}`}
                      >
                        <RiskIcon className="w-3 h-3" />
                        {t("guidance.risk_" + path.risk_level)}
                      </span>

                      {/* Timeline */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] bg-white/5 text-zinc-400 border border-white/10">
                        <Clock className="w-3 h-3" />
                        {path.estimated_timeline}
                      </span>

                      {/* Success Probability */}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] bg-white/5 text-zinc-400 border border-white/10">
                        <CheckCircle2 className="w-3 h-3" />
                        {getProbabilityLabel(path.success_probability, t)} (
                        <span className="tabular-nums">
                          {Math.round(path.success_probability * 100)}%
                        </span>
                        )
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
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 mb-3">
                          {t("guidance.detailed_analysis")}
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
                            {t("guidance.risk_hint_" + path.risk_level)}
                          </p>
                          {path.risk_reason && (
                            <p className="text-xs text-zinc-500 mt-2 italic">
                              {t("guidance.risk_hint", {
                                reason: path.risk_reason,
                              })}
                            </p>
                          )}
                        </div>
                      </section>

                      {/* Step-by-Step Actions */}
                      <section>
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 mb-3">
                          {t("guidance.step_plan")}
                        </h4>
                        <div className="space-y-3">
                          {path.recommended_actions.map((action, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/5"
                            >
                              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold bg-accent-electric/20 text-accent-electric border border-accent-electric/20">
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
                      <section className="flex items-start gap-3 p-4 bg-accent-neon/5 border border-accent-neon/10">
                        <Lightbulb className="w-4 h-4 text-accent-neon flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-zinc-400">
                            <span className="text-white font-bold">
                              {t("guidance.quick_tip")}:
                            </span>{" "}
                            {getTimelineHint(path.estimated_timeline, t)}
                          </p>
                        </div>
                      </section>
                    </div>

                    {/* Sidebar — takes 1 column */}
                    <div className="space-y-6">
                      {/* Cost Breakdown */}
                      {path.cost_breakdown && (
                        <section className="p-5 bg-black/40 border border-white/5">
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">
                            {t("guidance.cost_breakdown")}
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">
                                {t("guidance.cost_court_fees")}
                              </span>
                              <span className="text-white font-bold tabular-nums">
                                €
                                {path.cost_breakdown.court_fees.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">
                                {t("guidance.cost_lawyer_fees")}
                              </span>
                              <span className="text-white font-bold tabular-nums">
                                €
                                {path.cost_breakdown.lawyer_fees.toLocaleString()}
                              </span>
                            </div>
                            <div className="border-t border-white/5 pt-3 flex justify-between text-sm">
                              <span className="text-zinc-500">
                                {t("guidance.cost_total_risk")}
                              </span>
                              <span className="text-accent-amber font-bold tabular-nums">
                                €
                                {path.cost_breakdown.total_risk.toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-700 mt-3">
                            {t("guidance.cost_basis", {
                              n:
                                folderContext?.dispute_value?.toLocaleString() ||
                                "?",
                            })}
                          </p>
                        </section>
                      )}

                      {/* Cited Laws */}
                      {path.laws_cited.length > 0 && (
                        <section className="p-5 bg-black/40 border border-white/5">
                          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">
                            {t("guidance.cited_laws")}
                          </h4>
                          <div className="space-y-2">
                            {path.laws_cited.map((law, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 text-xs"
                              >
                                <Gavel className="w-3 h-3 text-accent-gold flex-shrink-0 mt-0.5" />
                                <div>
                                  <a
                                    href={`/laws/${encodeURIComponent(law.law_key)}`}
                                    className="text-accent-gold-bright hover:text-white transition-colors font-bold"
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
                          <p className="text-xs text-zinc-700 mt-3 flex items-center gap-1">
                            <Search className="w-2.5 h-2.5" />
                            {t("guidance.cited_click")}
                          </p>
                        </section>
                      )}

                      {/* Generate Document */}
                      <button
                        onClick={() => handleGenerateDoc(path.path_number)}
                        disabled={generatingDoc === `path-${path.path_number}`}
                        className="w-full flex items-center justify-center gap-2 p-4 text-xs font-bold uppercase tracking-[0.2em] bg-accent-electric/10 text-accent-electric border border-accent-electric/20 hover:bg-accent-electric/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingDoc === `path-${path.path_number}` ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            {t("guidance.gen_doc_progress")}
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            {t("guidance.gen_doc")}
                          </>
                        )}
                      </button>

                      <div className="flex items-start gap-2 p-3 bg-amber-900/10 border border-amber-900/20">
                        <AlertTriangle className="w-3 h-3 text-accent-amber flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-zinc-500">
                          {t("guidance.gen_doc_disclaimer")}
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
          <span className="text-white font-bold">Remember:</span>{" "}
          {t("guidance.remember")}
          <a
            href="/bookmarks"
            className="text-accent-electric hover:text-white transition-colors"
          >
            {t("guidance.save_archives")}
          </a>
        </p>
      </div>
    </div>
  );
}
