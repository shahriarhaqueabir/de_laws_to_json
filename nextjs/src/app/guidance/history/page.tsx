"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  ChevronRight,
  AlertTriangle,
  Clock,
  Euro,
  ArrowLeft,
  Trash2,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface GuidancePathSummary {
  id: string;
  path_number: number;
  title: string;
  risk_level: "low" | "medium" | "high";
  cost_estimate: number | null;
}

interface GuidanceSession {
  id: string;
  title: string;
  category: string;
  status: string;
  situation_data: Record<string, unknown>;
  incident_date: string | null;
  dispute_value: number;
  created_at: string;
  guidance_paths: GuidancePathSummary[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  archived: "Archived",
  completed: "Completed",
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-400 bg-green-900/20 border-green-900/30",
  medium: "text-yellow-400 bg-yellow-900/20 border-yellow-900/30",
  high: "text-red-400 bg-red-900/20 border-red-900/30",
};

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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function GuidanceHistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GuidanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guidance/sessions?page=${page}&limit=20`);
      if (!res.ok) {
        if (res.status === 401) {
          setError("Please sign in to view your guidance history.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      setSessions(json.data.sessions);
      setPagination(json.data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, [loadSessions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this guidance session and all its outcome paths?"))
      return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/guidance/sessions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setSessions((prev) => prev.filter((s) => s.id !== id));
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const base =
      "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 border";
    switch (status) {
      case "active":
        return `${base} text-accent-gold border-accent-gold/20 bg-accent-gold/10`;
      case "completed":
        return `${base} text-green-400 border-green-400/20 bg-green-900/10`;
      case "archived":
        return `${base} text-zinc-500 border-zinc-600/20 bg-zinc-700/10`;
      default:
        return `${base} text-zinc-500 border-zinc-600/20 bg-zinc-700/10`;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-transparent max-w-4xl mx-auto px-6 py-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-16 pb-8 border-b border-white/5">
        <Link
          href="/guidance"
          className="p-2 text-muted hover:text-white transition-colors"
          aria-label="Back to guidance"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
          <Scale className="w-6 h-6 text-accent-gold" />
        </div>
        <div>
          <p className="text-muted text-xs font-bold uppercase tracking-widest opacity-40 mb-1">
            Case Analysis
          </p>
          <h1 className="text-4xl font-serif font-bold text-white tracking-tight">
            Guidance History
          </h1>
        </div>
        {pagination && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-[0.3em] text-muted">
            {pagination.total} Sessions
          </span>
        )}
      </div>

      {/* Not signed in */}
      {!user && !loading && (
        <div className="glass-panel p-16 text-center border-white/5">
          <AlertTriangle className="w-12 h-12 text-accent-gold/40 mx-auto mb-6" />
          <h2 className="text-2xl font-serif font-bold text-white mb-4">
            Sign In Required
          </h2>
          <p className="text-muted max-w-md mx-auto">
            Sign in to view your guidance history. Sessions are automatically
            saved when you run case analysis while signed in.
          </p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors border border-accent-gold/20"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-32">
          <Loader2 className="w-8 h-8 text-accent-gold/60 animate-spin mx-auto mb-6" />
          <p className="text-muted text-sm">Loading sessions...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="glass-panel p-8 border-red-900/20">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={loadSessions}
            className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-gold hover:text-accent-gold-bright transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && user && sessions.length === 0 && (
        <div className="glass-panel p-16 text-center border-white/5">
          <Scale className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
          <h2 className="text-2xl font-serif font-bold text-white mb-4">
            No Guidance Sessions Yet
          </h2>
          <p className="text-muted max-w-md mx-auto mb-8">
            Describe your legal situation and the AI will generate 3-5 outcome
            paths. Sessions are saved automatically when you are signed in.
          </p>
          <Link
            href="/guidance"
            className="inline-flex items-center gap-2 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-accent-gold/20 text-accent-gold hover:bg-accent-gold/30 transition-colors border border-accent-gold/20"
          >
            Analyze a Situation
          </Link>
        </div>
      )}

      {/* Session List */}
      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="glass-panel border border-white/5 overflow-hidden hover:border-accent-gold/20 transition-colors"
            >
              <Link
                href={`/guidance/sessions/${session.id}`}
                className="block p-6"
              >
                {/* Session Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={getStatusBadgeClass(session.status)}>
                        {STATUS_LABELS[session.status] || session.status}
                      </span>
                      <span className="text-[9px] font-mono font-black text-muted uppercase">
                        {session.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-serif font-bold text-white truncate">
                      {session.title || "Untitled Session"}
                    </h3>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 mt-2" />
                </div>

                {/* Session Meta */}
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {formatDate(session.created_at)}
                  </span>
                  {session.dispute_value > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Euro className="w-3 h-3" />
                      {session.dispute_value.toLocaleString("de-DE")} €
                    </span>
                  )}
                  {session.incident_date && (
                    <span className="flex items-center gap-1.5">
                      Incident: {session.incident_date}
                    </span>
                  )}
                </div>

                {/* Path Summaries */}
                {session.guidance_paths.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {session.guidance_paths.map((path) => (
                      <span
                        key={path.id}
                        className={`text-[9px] font-bold px-2 py-1 border ${RISK_COLORS[path.risk_level] || "text-zinc-400 border-zinc-700"}`}
                      >
                        Path {path.path_number}: {truncate(path.title, 40)}
                      </span>
                    ))}
                  </div>
                )}
              </Link>

              {/* Delete Button */}
              <div className="px-6 pb-4 flex justify-end">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(session.id);
                  }}
                  disabled={deleting === session.id}
                  className="text-[9px] font-black uppercase tracking-[0.2em] text-muted hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {deleting === session.id ? "Deleting..." : "Delete Session"}
                </button>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-[10px] font-mono text-muted">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (pagination?.totalPages || 1)}
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
