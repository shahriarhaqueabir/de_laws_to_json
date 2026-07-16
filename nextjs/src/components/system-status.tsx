"use client";

import { useEffect, useState } from "react";
import { useSystemStatus, type ServiceStatus } from "../hooks/useSystemStatus";
import { useChat } from "./chat-context";

// ── Status colour helpers ───────────────────────────────────────────────────

function statusColor(status: ServiceStatus["status"]): string {
  switch (status) {
    case "ok":
      return "text-emerald-400";
    case "warn":
      return "text-yellow-400";
    case "error":
      return "text-red-400";
    default:
      return "text-zinc-500";
  }
}

function statusDot(status: ServiceStatus["status"]): string {
  switch (status) {
    case "ok":
      return "bg-emerald-400";
    case "warn":
      return "bg-yellow-400";
    case "error":
      return "bg-red-400";
    default:
      return "bg-zinc-600";
  }
}

// ── Mode label map ──────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  local: "Local AI (Ollama)",
  cloud: "Cloud AI (BYO API Key)",
  browser: "Browser AI (Transformers.js)",
  basic: "Basic Search",
};

// ── Component Variants ──────────────────────────────────────────────────────

interface SystemStatusProps {
  /** Show compact dot-only version (for nav/header) */
  compact?: boolean;
  /** Show as a panel in settings/guidance pages */
  panel?: boolean;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function SystemStatus({ compact = false, panel = false }: SystemStatusProps) {
  const status = useSystemStatus();
  const { settings } = useChat();
  const [expanded, setExpanded] = useState(false);

  // Auto-collapse on compact mode
  useEffect(() => {
    if (compact) setExpanded(false);
  }, [compact]);

  // ── Compact: single dot with tooltip ──
  if (compact) {
    return (
      <div
        className="relative group cursor-help"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        title={`System: ${status.overall.toUpperCase()} | Mode: ${MODE_LABELS[status.mode] || status.mode}`}
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${statusDot(status.overall)}`}
        />
        {expanded && (
          <div className="absolute top-full right-0 mt-2 z-50 min-w-[240px] bg-zinc-900 border border-white/10 shadow-xl p-3 animate-fade-in">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              System Status
            </p>
            {status.services.map((s) => (
              <div key={s.label} className="flex items-center gap-2 py-1">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDot(s.status)} shrink-0`} />
                <span className="text-xs text-zinc-300 truncate">{s.label}</span>
              </div>
            ))}
            <p className="text-[10px] text-zinc-600 mt-2 border-t border-white/5 pt-2">
              Mode: {MODE_LABELS[status.mode] || status.mode}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Panel: full status display ──
  return (
    <div className={`${panel ? "border border-white/5 bg-white/[0.01]" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full animate-pulse ${statusDot(status.overall)}`}
          />
          <span className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
            System
          </span>
        </div>
        <span className="text-[10px] text-zinc-600">
          {status.mode && MODE_LABELS[status.mode]
            ? MODE_LABELS[status.mode]
            : status.mode}
        </span>
      </div>

      {/* Service rows */}
      <div className="space-y-1">
        {status.services.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between py-1.5 px-2 hover:bg-white/[0.02] transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(s.status)}`}
              />
              <span className="text-xs text-zinc-400 truncate group-hover:text-zinc-300 transition-colors">
                {s.label}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider ml-2 shrink-0 ${statusColor(s.status)}`}
            >
              {s.status === "ok"
                ? "✓"
                : s.status === "warn"
                  ? "△"
                  : s.status === "error"
                    ? "✗"
                    : "?"}
            </span>
          </div>
        ))}
      </div>

      {/* Expandable detail */}
      {!compact && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 w-full text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-bold uppercase tracking-widest"
        >
          {expanded ? "Hide Details" : "Show Details"}
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-2">
          {status.services.map((s) => (
            <p key={s.label} className="text-[10px] text-zinc-600 leading-relaxed">
              <span className="font-bold text-zinc-500">{s.label}:</span>{" "}
              {s.message}
            </p>
          ))}
          <p className="text-[10px] text-zinc-700 mt-1">
            Last checked: {new Date(status.lastChecked).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}
