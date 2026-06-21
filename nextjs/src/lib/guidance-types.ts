/**
 * Shared types and constants for the Guidance Engine
 *
 * Extracted to allow Client Components to import types/constants
 * without pulling in server-only dependencies (next/headers).
 */

import type { AppLanguage, CitedLaw } from "./types";

// ── Folder Properties (Uniform — 8 fields) ─────────────────────────────────

export interface FolderContext {
  id: string;
  name: string;
  category: string;
  incident_date: string | null;
  dispute_value: number;
  status: FolderStatus;
  opposing_party: string;
  deadline_date: string | null;
  court_name: string;
  case_number: string;
  notes: string;
}

export type FolderStatus =
  | "pre_action"
  | "consulting"
  | "filed"
  | "in_progress"
  | "resolved";

export const FOLDER_STATUS_LABELS: Record<FolderStatus, string> = {
  pre_action: "Pre-Action",
  consulting: "Consulting",
  filed: "Filed",
  in_progress: "In Progress",
  resolved: "Resolved",
};

// ── Guidance Types ──────────────────────────────────────────────────────────

export interface GuidancePath {
  path_number: number; // 1-5
  title: string;
  summary: string;
  detailed_analysis: string;
  laws_cited: CitedLaw[];
  risk_level: "low" | "medium" | "high";
  risk_reason: string;
  cost_estimate: number | null;
  cost_breakdown: {
    court_fees: number;
    lawyer_fees: number;
    total_risk: number;
  } | null;
  recommended_actions: string[];
  estimated_timeline: string;
  success_probability: number; // 0-1
}

export interface GuidanceResult {
  session_id: string;
  paths: GuidancePath[];
  folder_context: FolderContext | null;
  generated_at: string;
  language: AppLanguage;
}
