"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Scale,
  AlertTriangle,
  Clock,
  Euro,
  Loader2,
  FileText,
} from "lucide-react";
import GuidancePathsDisplay from "@/components/guidance-paths-display";
import type { GuidancePath } from "@/lib/guidance";

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionData {
  id: string;
  title: string;
  category: string;
  status: string;
  situation_data: {
    situation?: string;
    language?: string;
    folder_id?: string;
  };
  incident_date: string | null;
  dispute_value: number;
  created_at: string;
}

interface SessionResponse {
  session: SessionData;
  paths: GuidancePath[];
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/guidance/sessions/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Session not found");
            return;
          }
          if (res.status === 401) {
            setError("Please sign in to view this session");
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        setData(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-transparent max-w-4xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10 pb-8 border-b border-white/5">
        <Link
          href="/guidance/history"
          className="p-2 text-zinc-600 hover:text-white transition-colors"
          aria-label="Back to history"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
          <Scale className="w-6 h-6 text-accent-gold" />
        </div>
        <div>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40 mb-1">
            Case Analysis
          </p>
          <h1 className="text-3xl font-serif font-bold text-white tracking-tight">
            Session Details
          </h1>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-32">
          <Loader2 className="w-8 h-8 text-accent-gold/60 animate-spin mx-auto mb-6" />
          <p className="text-zinc-500 text-sm">Loading session...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="glass-panel p-8 border-red-900/20">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <Link
            href="/guidance/history"
            className="inline-block mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-gold hover:text-accent-gold-bright transition-colors"
          >
            Back to History
          </Link>
        </div>
      )}

      {/* Session Detail */}
      {data && !loading && (
        <div className="space-y-8">
          {/* Session Info */}
          <div className="glass-panel border border-white/5 p-6">
            <h2 className="font-serif font-bold text-xl text-white mb-4">
              {data.session.title || "Untitled Session"}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {formatDate(data.session.created_at)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {data.session.category}
              </span>
              {data.session.dispute_value > 0 && (
                <span className="flex items-center gap-1.5">
                  <Euro className="w-3 h-3" />
                  {data.session.dispute_value.toLocaleString("de-DE")} €
                </span>
              )}
              {data.session.incident_date && (
                <span>Incident: {data.session.incident_date}</span>
              )}
            </div>

            {/* Situation */}
            {data.session.situation_data?.situation && (
              <div className="mt-6 p-4 bg-white/[0.02] border-l-2 border-accent-gold/20">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-gold/60 mb-2">
                  Your Situation
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                  {data.session.situation_data.situation}
                </p>
              </div>
            )}
          </div>

          {/* Guidance Paths */}
          {data.paths.length > 0 ? (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold/60 mb-6">
                AI-Generated Outcome Paths ({data.paths.length})
              </h3>
              <GuidancePathsDisplay
                paths={data.paths}
                folderContext={null}
                language="en"
              />
            </div>
          ) : (
            <div className="glass-panel p-8 text-center border-white/5">
              <FileText className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-500 text-sm">
                No guidance paths were generated for this session.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
