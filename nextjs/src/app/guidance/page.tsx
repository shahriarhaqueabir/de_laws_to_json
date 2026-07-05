"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Compass,
  AlertTriangle,
  Clock,
  Check,
  Loader2,
  Bookmark,
  ArrowRight,
  Scale,
  Euro,
  Gavel,
} from "lucide-react";
import GuidancePathsDisplay from "../../components/guidance-paths-display";
import FolderModal from "../../components/folder-modal";
import { SkeletonList } from "../../components/ui/skeleton";
import type { FolderFormData } from "../../components/folder-modal";
import type { GuidancePath, FolderContext } from "../../lib/guidance-types";
import { FOLDER_STATUS_LABELS } from "../../lib/guidance-types";
import { getFolders, createFolder } from "../../lib/bookmarks-v2";
import { useLanguage } from "../../hooks/useLanguage";
import { useAuth } from "../../components/auth-context";
import { useChat } from "../../components/chat-context";
import { FeatureGate } from "../../components/feature-gate";

// ── Page Component ─────────────────────────────────────────────────────────

export default function GuidancePage() {
  const [situation, setSituation] = useState("");
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const { settings } = useChat();
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [paths, setPaths] = useState<GuidancePath[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folders, setFolders] = useState<FolderContext[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const pathsRef = useRef<HTMLDivElement>(null);

  const selectedFolderData =
    folders.find((f) => f.id === selectedFolder) || null;

  // ── SEO: Set page title ──
  useEffect(() => {
    document.title = "Legal Guidance — German Law Vault";
  }, []);

  // Load folders from localStorage and Supabase
  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const localFolders = getFolders();
      setFolders(
        localFolders.map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          incident_date: f.incident_date,
          dispute_value: f.dispute_value,
          status: f.status,
          opposing_party: f.opposing_party,
          deadline_date: f.deadline_date,
          court_name: f.court_name,
          case_number: f.case_number,
          notes: f.notes,
        })),
      );
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFolders();
  }, [loadFolders]);

  const handleGetGuidance = async () => {
    if (!situation.trim()) return;

    setLoading(true);
    setError(null);
    setPaths(null);

    try {
      const body: Record<string, unknown> = {
        situation: situation.trim(),
        language,
        provider: "openai",
        model: "gpt-4o-mini",
      };

      // Add folder context if selected
      if (selectedFolderData) {
        body.folder_id = selectedFolderData.id;
        body.folder_context = {
          id: selectedFolderData.id,
          name: selectedFolderData.name,
          category: selectedFolderData.category,
          incident_date: selectedFolderData.incident_date,
          dispute_value: selectedFolderData.dispute_value,
          status: selectedFolderData.status,
          opposing_party: selectedFolderData.opposing_party,
          deadline_date: selectedFolderData.deadline_date,
          court_name: selectedFolderData.court_name,
          case_number: selectedFolderData.case_number,
          notes: selectedFolderData.notes,
        };
      }

      const res = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.message ||
          `Guidance generation failed (${res.status}). Please try again.`,
        );
      }

      const data = await res.json();
      setPaths(data.data?.paths || []);

      // Scroll to results
      setTimeout(() => {
        pathsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFolder = async (data: FolderFormData) => {
    await createFolder({
      name: data.name,
      description: data.description,
      category: data.category,
      incident_date: data.incident_date || undefined,
      dispute_value: data.dispute_value,
      status: data.status,
      opposing_party: data.opposing_party,
      deadline_date: data.deadline_date || undefined,
      court_name: data.court_name,
      case_number: data.case_number,
      notes: data.notes,
    });
    await loadFolders();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pre_action":
        return "bg-accent-amber/10 text-accent-amber border-accent-amber/20";
      case "consulting":
        return "bg-accent-electric/10 text-accent-electric border-accent-electric/20";
      case "filed":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "in_progress":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "resolved":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      default:
        return "bg-white/5 text-zinc-500 border-white/10";
    }
  };

  return (
    <div className="min-h-screen bg-transparent max-w-5xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-16 pb-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-accent-electric/20 bg-accent-electric/5">
            <Compass className="w-6 h-6 text-accent-electric" />
          </div>
          <div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40 mb-1">
              {t("guidance.page_title")}
            </p>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">
              {t("guidance.page_subtitle")}
            </h1>
          </div>
          <Link
            href="/guidance/history"
            className="flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 hover:text-accent-gold transition-colors border border-white/5 hover:border-accent-gold/20"
          >
            <Clock className="w-3.5 h-3.5" />
            History
          </Link>
        </div>
      </div>

      {/* Input Section */}
      <div className="glass-panel p-8 border-white/5 mb-12 relative overflow-hidden edge-glow-electric">
        <div className="absolute inset-0 bg-coin-pattern opacity-[0.08] pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent-electric/20 to-transparent" />
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Folder Selector */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">
              <Bookmark className="w-3.5 h-3.5" />
              {t("guidance.folder_label")}
            </label>
            <div className="flex gap-2">
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="flex-1 px-4 py-3 bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-electric/50 transition-colors appearance-none disabled:opacity-50"
                disabled={foldersLoading}
              >
                <option value="">
                  {foldersLoading
                    ? t("guidance.loading_folder")
                    : t("guidance.no_folder")}
                </option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({FOLDER_STATUS_LABELS[f.status]})
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowFolderModal(true)}
                className="px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] bg-accent-electric/20 text-accent-electric hover:bg-accent-electric/30 transition-colors border border-accent-electric/20"
                title="Create new folder"
              >
                + New
              </button>
            </div>
            {selectedFolderData && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFolderData.dispute_value > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/5 text-zinc-400 tabular-nums">
                    <Euro className="w-2.5 h-2.5" />€
                    {selectedFolderData.dispute_value.toLocaleString()}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 border ${getStatusBadgeClass(
                    selectedFolderData.status,
                  )}`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  {FOLDER_STATUS_LABELS[selectedFolderData.status]}
                </span>
                {selectedFolderData.opposing_party && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/5 text-zinc-400">
                    <Gavel className="w-2.5 h-2.5" />
                    {selectedFolderData.opposing_party}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Situation Input */}
        <div className="mb-8">
          <label className="block text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">
            {t("guidance.situation_label")}
          </label>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Describe your legal situation in detail. Include relevant facts, dates, parties involved, and any actions you've already taken. You can write in any language — German, English, Turkish, Arabic, French, Spanish, Polish, Ukrainian, or Russian."
            rows={6}
            className="w-full px-5 py-4 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-electric/50 transition-colors resize-vertical"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-zinc-700">
              The AI cross-references German federal laws with your bookmarks
              and folder context.
            </p>
            <span className="text-xs text-zinc-700">
              {situation.length} characters
            </span>
          </div>
        </div>

        {/* Submit */}
        <FeatureGate
          requirement="ai-mode"
          message="Sign in and configure AI in Settings for legal guidance"
          met={!!user && settings.mode !== "basic"}
        >
          <button
            onClick={handleGetGuidance}
            disabled={loading || !situation.trim()}
            className="flex items-center gap-3 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] bg-accent-electric text-white hover:bg-accent-electric/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:translate-y-[1px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Your Situation...
              </>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                Get Guidance
                <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </>
            )}
          </button>
        </FeatureGate>
      </div>

      {/* Error State */}
      {error && (
        <div className="glass-panel p-8 border-red-900/30 mb-12">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white mb-2">
                Guidance Generation Failed
              </h3>
              <p className="text-zinc-400 text-sm">{error}</p>
              <FeatureGate
                requirement="ai-mode"
                message="Sign in and configure AI in Settings for legal guidance"
                met={!!user && settings.mode !== "basic"}
              >
                <button
                  onClick={handleGetGuidance}
                  className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-accent-electric hover:text-white transition-colors"
                >
                  Retry
                </button>
              </FeatureGate>
            </div>
          </div>
        </div>
      )}

      {/* Loading State — skeleton */}
      {loading && !paths && (
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-50 shrink-0">
              Analyzing Your Situation
            </h2>
            <div className="h-px w-full bg-zinc-800/50" />
          </div>
          <div className="space-y-12">
            <SkeletonList count={3} />
          </div>
        </div>
      )}

      {/* Results */}
      {paths && !loading && (
        <div ref={pathsRef}>
          <GuidancePathsDisplay
            paths={paths}
            folderContext={selectedFolderData}
            language={language}
            situation={situation}
          />
        </div>
      )}

      {/* Empty State */}
      {!paths && !loading && !error && (
        <div className="text-center py-20 max-w-2xl mx-auto">
          <div className="w-20 h-20 border border-white/5 bg-white/[0.02] flex items-center justify-center mx-auto mb-10">
            <Compass className="w-8 h-8 text-zinc-600" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-white mb-4">
            Legal Guidance
          </h2>
          <p className="text-zinc-500 leading-relaxed mb-6">
            Describe your situation above and the AI will analyze all 6,000+
            German federal laws, cross-reference with your bookmarks and case
            folders, and return{" "}
            <span className="text-accent-electric font-bold">3-5</span> concrete
            outcome paths with risk assessment, cost estimates, and step-by-step
            next steps.
          </p>
          <div className="flex justify-center gap-6 text-xs text-zinc-700 uppercase tracking-[0.2em] font-bold">
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3 text-accent-electric" />
              Risk Badges
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3 text-accent-electric" />
              Cost Estimates
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3 text-accent-electric" />
              Cited Laws
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-3 h-3 text-accent-electric" />
              Document Generation
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation Modal */}
      <FolderModal
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onSave={handleSaveFolder}
      />
    </div>
  );
}
