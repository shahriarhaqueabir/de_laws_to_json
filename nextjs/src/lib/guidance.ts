/**
 * Guidance Engine — AI-powered legal path generation
 *
 * Core workflow:
 * 1. User describes situation in any of 9 languages
 * 2. Engine searches Qdrant for relevant laws
 * 3. Cross-references with user's bookmark folders and bookmarked laws
 * 4. Builds AI prompt with folder context, bookmarks, and search results
 * 5. AI returns 3-5 structured outcome paths with risk + cost estimates
 * 6. Engine parses, enriches with fee calculations, returns to UI
 */

import type { AppLanguage, CloudProvider, CitedLaw } from "./types";
import { calculateTotalLegalRisk } from "./fees";
import { calculateDeadline } from "./diagnosis";

// ── Remediation Playbook Types ──────────────────────────────────────────────

interface PlaybookStep {
  step: number;
  title: string;
  description: string;
  deadline_days: number | null;
  type: string;
  statute?: string;
}

interface RemediationPlaybook {
  category: string;
  issue_type: string;
  steps: PlaybookStep[];
}

export const CATEGORY_PLAYBOOK_MAP: Record<string, string[]> = {
  labor: ["wrongful_dismissal"],
  housing: ["rent_reduction"],
  consumer: ["deposit_retention", "withdrawal", "warranty"],
  traffic: ["fine_contest"],
  family: ["custody"],
  public: ["defense_strategy"],
  other: [],
};

// ── Types ──────────────────────────────────────────────────────────────────

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

export interface GenerateGuidanceParams {
  situation: string;
  language: AppLanguage;
  folderContext: FolderContext | null;
  bookmarkedLaws: CitedLaw[];
  qdrantResults: CitedLaw[];
  qdrantContext: string;
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export interface DocumentGenerationParams {
  templateSlug: string;
  folderContext: FolderContext;
  situation: string;
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export interface GeneratedDocument {
  title: string;
  content: string;
  template_slug: string;
  placeholders_filled: Record<string, string>;
}

// ── Prompt Building ─────────────────────────────────────────────────────────

const GUIDANCE_SYSTEM_PROMPT = `You are a precise German legal guidance AI ("Rechtsexperte") specializing in the entire German federal legal code (Bundesrecht).

## Your Task
Analyze the user's legal situation and generate 3 to 5 distinct possible outcome paths. Each path must be a realistic legal strategy with concrete steps, risk assessment, and estimated timeline.

## Output Format
Return ONLY valid JSON with this exact structure — no markdown, no code fences, no extra text:

{
  "paths": [
    {
      "title": "Short path title",
      "summary": "One-paragraph summary of this approach",
      "detailed_analysis": "Full legal analysis with reasoning",
      "laws_cited": [{"law_key": "BGB", "norm_id": "§ 433", "law_title": "Bürgerliches Gesetzbuch"}],
      "risk_level": "low|medium|high",
      "risk_reason": "Why this path carries this risk level",
      "recommended_actions": ["Step 1", "Step 2", "Step 3"],
      "estimated_timeline": "2-4 weeks",
      "success_probability": 0.75
    }
  ]
}

## Rules
1. Base your analysis strictly on German law as provided in the context.
2. Each path must cite specific section numbers (§, Artikel, Abs., S., Nr.).
3. Risk levels: low = likely favorable outcome; medium = uncertain; high = significant obstacles.
4. Success probability must be between 0 and 1.
5. Recommended actions must be concrete, ordered, and actionable.
6. Estimated timeline should be realistic based on German court/procedure timelines.
7. Include at least one pre-litigation path (e.g., negotiation, mediation) where applicable.
8. Never fabricate section numbers. Only reference what is provided or well-known German law.
9. The user's language preference MUST be respected. Respond in the user's language.
10. Include a disclaimer about RDG (Rechtsdienstleistungsgesetz) compliance.
11. If a Remediation Playbook is provided, use its structured steps as a template for your recommended actions in each path. Align your strategies with the playbook's approach where applicable.
12. Reference any deadlines or statutes mentioned in the playbook steps (e.g., "§ 4 KSchG: 3 weeks to file") to give precise guidance.`;

/**
 * Build a structured remediation playbook section for the AI prompt.
 * Matches the folder's category to available playbooks and formats their steps.
 */
function buildPlaybookContext(
  category: string,
  playbookCache: RemediationPlaybook[],
): string {
  const issueTypes = CATEGORY_PLAYBOOK_MAP[category] || [];
  const matched = playbookCache.filter((p) =>
    issueTypes.includes(p.issue_type),
  );

  if (matched.length === 0) return "";

  const parts: string[] = ["## Remediation Playbooks"];
  for (const playbook of matched) {
    parts.push(
      `\n### ${playbook.issue_type.replace(/_/g, " ").replace(/\\b\\w/g, (c) => c.toUpperCase())}`,
    );
    for (const step of playbook.steps) {
      parts.push(
        `${step.step}. **${step.title}** — ${step.description}` +
          (step.deadline_days
            ? ` (Deadline: ${step.deadline_days} days)`
            : "") +
          (step.statute ? ` [${step.statute}]` : ""),
      );
    }
  }
  parts.push("");
  return parts.join("\n");
}

async function loadPlaybooks(): Promise<RemediationPlaybook[]> {
  try {
    const { getServerClient } = await import("./supabase-server");
    const { cookies } = await import("next/headers");
    const supabase = getServerClient(await cookies());
    const { data } = await supabase
      .from("remediation_playbooks")
      .select("*")
      .limit(20);
    return (data || []) as RemediationPlaybook[];
  } catch {
    return [];
  }
}

function buildGuidancePrompt(
  params: GenerateGuidanceParams,
  playbookCache: RemediationPlaybook[],
): string {
  const { situation, language, folderContext, bookmarkedLaws, qdrantContext } =
    params;

  const parts: string[] = [];

  // User's situation
  parts.push(`## User's Situation\n${situation}\n`);

  // Folder context (if available)
  if (folderContext) {
    parts.push(`## User's Case Context`);
    parts.push(`Category: ${folderContext.category}`);
    if (folderContext.incident_date)
      parts.push(`Incident Date: ${folderContext.incident_date}`);
    if (folderContext.dispute_value > 0)
      parts.push(`Dispute Value (Streitwert): €${folderContext.dispute_value}`);
    parts.push(`Status: ${folderContext.status}`);
    if (folderContext.opposing_party)
      parts.push(`Opposing Party: ${folderContext.opposing_party}`);
    if (folderContext.deadline_date)
      parts.push(`Deadline: ${folderContext.deadline_date}`);
    if (folderContext.court_name)
      parts.push(`Court: ${folderContext.court_name}`);
    if (folderContext.case_number)
      parts.push(`Case Number: ${folderContext.case_number}`);
    if (folderContext.notes) parts.push(`Notes: ${folderContext.notes}`);
    parts.push("");
  }

  // Bookmarked laws (user's saved references)
  if (bookmarkedLaws.length > 0) {
    parts.push("## User's Bookmarked Laws");
    bookmarkedLaws.forEach((l) => {
      parts.push(`- ${l.law_key} ${l.norm_id || ""} — ${l.law_title}`);
    });
    parts.push("");
  }

  // Qdrant search context
  if (qdrantContext) {
    parts.push("## Relevant German Laws (from search)");
    parts.push(qdrantContext);
    parts.push("");
  }

  // Remediation playbook context (if folder category matches)
  const playbookCtx = buildPlaybookContext(
    folderContext?.category || "other",
    playbookCache,
  );
  if (playbookCtx) {
    parts.push(playbookCtx);
  }

  parts.push(
    `## Instructions\nGenerate 3-5 possible legal outcome paths in ${params.language === "de" ? "German" : params.language === "en" ? "English" : params.language}. Each path must include the structured JSON fields described in the system prompt. Consider both amicable and judicial approaches.`,
  );

  return parts.join("\n");
}

// ── Response Parsing ────────────────────────────────────────────────────────

interface RawGuidanceResponse {
  paths: Array<{
    title: string;
    summary: string;
    detailed_analysis: string;
    laws_cited: Array<{
      law_key: string;
      norm_id: string;
      law_title: string;
    }>;
    risk_level: string;
    risk_reason: string;
    recommended_actions: string[];
    estimated_timeline: string;
    success_probability: number;
  }>;
}

export function parseGuidanceResponse(raw: string): GuidancePath[] {
  // Strip markdown code fences if present
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: RawGuidanceResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback: try to find JSON object in the response
    const jsonMatch = jsonStr.match(/\{[\s\S]*"paths"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error("Failed to parse AI guidance response as JSON");
      }
    } else {
      throw new Error("Failed to parse AI guidance response as JSON");
    }
  }

  if (!parsed.paths || !Array.isArray(parsed.paths)) {
    throw new Error("AI response missing 'paths' array");
  }

  return parsed.paths.map((p, i) => {
    const risk = validateRiskLevel(p.risk_level);
    return {
      path_number: i + 1,
      title: p.title || `Path ${i + 1}`,
      summary: p.summary || "",
      detailed_analysis: p.detailed_analysis || "",
      laws_cited: (p.laws_cited || []).map((l) => ({
        law_key: l.law_key || "",
        norm_id: l.norm_id || "",
        law_title: l.law_title || "",
      })),
      risk_level: risk,
      risk_reason: p.risk_reason || "",
      cost_estimate: null, // Attached separately
      cost_breakdown: null, // Attached separately
      recommended_actions: Array.isArray(p.recommended_actions)
        ? p.recommended_actions
        : [],
      estimated_timeline: p.estimated_timeline || "Varies",
      success_probability: clampProbability(p.success_probability),
    };
  });
}

function validateRiskLevel(level: string): "low" | "medium" | "high" {
  if (level === "low" || level === "medium" || level === "high") return level;
  return "medium";
}

function clampProbability(p: number): number {
  if (typeof p !== "number" || isNaN(p)) return 0.5;
  return Math.max(0, Math.min(1, p));
}

// ── Cost Estimation ────────────────────────────────────────────────────────

export function attachCostEstimates(
  paths: GuidancePath[],
  disputeValue: number,
): GuidancePath[] {
  return paths.map((path) => {
    if (disputeValue <= 0) return path;

    const costs = calculateTotalLegalRisk(disputeValue);
    return {
      ...path,
      cost_estimate: costs.totalRisk,
      cost_breakdown: {
        court_fees: costs.courtFees,
        lawyer_fees: costs.lawyerFees,
        total_risk: costs.totalRisk,
      },
    };
  });
}

// ── Deadline Warnings ───────────────────────────────────────────────────────

export interface DeadlineWarning {
  label: string;
  deadline_date: string;
  days_remaining: number;
  is_urgent: boolean;
  statute: string;
}

export function calculateDeadlineWarnings(
  incidentDate: string | null,
  folderDeadline: string | null,
): DeadlineWarning[] {
  const warnings: DeadlineWarning[] = [];
  const now = new Date();

  if (folderDeadline) {
    const deadline = new Date(folderDeadline);
    const daysRemaining = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    warnings.push({
      label: "Folder deadline",
      deadline_date: folderDeadline,
      days_remaining: daysRemaining,
      is_urgent: daysRemaining <= 14,
      statute: "User-set deadline",
    });
  }

  if (incidentDate) {
    const incident = new Date(incidentDate);

    // Kündigungsschutzklage: 3 weeks from notice (§ 4 KSchG)
    const kSchgDeadline = calculateDeadline(incident, 21);
    const kSchgDays = Math.ceil(
      (kSchgDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    warnings.push({
      label: "Kündigungsschutzklage (wrongful dismissal suit)",
      deadline_date: kSchgDeadline.toISOString().split("T")[0],
      days_remaining: kSchgDays,
      is_urgent: kSchgDays <= 14,
      statute: "§ 4 KSchG",
    });

    // Mietminderung: 6 months from overpayment (§ 548 BGB)
    const bgbDeadline = calculateDeadline(incident, 180);
    const bgbDays = Math.ceil(
      (bgbDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    warnings.push({
      label: "Verjährung Mietminderung (rent reduction claim)",
      deadline_date: bgbDeadline.toISOString().split("T")[0],
      days_remaining: bgbDays,
      is_urgent: bgbDays <= 30,
      statute: "§ 548 BGB",
    });
  }

  return warnings;
}

// ── AI Provider Calls ──────────────────────────────────────────────────────

async function callAI(
  provider: CloudProvider,
  apiKey: string,
  model: string,
  customEndpoint: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  switch (provider) {
    case "openai": {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
      if (!res.ok)
        throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }

    case "anthropic": {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          max_tokens: 4096,
          temperature: 0.3,
        }),
      });
      if (!res.ok)
        throw new Error(
          `Anthropic API error: ${res.status} ${await res.text()}`,
        );
      const data = await res.json();
      return data.content?.[0]?.text?.trim() || "";
    }

    case "openai-compatible": {
      const base = customEndpoint.replace(/\/$/, "");
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });
      if (!res.ok)
        throw new Error(
          `Provider API error: ${res.status} ${await res.text()}`,
        );
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() || "";
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── Main Orchestrator ───────────────────────────────────────────────────────

const LEGAL_DISCLAIMER = `\n\n---\n*Disclaimer: This guidance is provided for informational purposes only and does not constitute legal advice (Rechtsdienstleistung) under the German Legal Services Act (RDG). Consult a licensed German attorney (Rechtsanwalt) for advice specific to your situation.*`;

export async function generateGuidancePaths(
  params: GenerateGuidanceParams,
): Promise<GuidancePath[]> {
  // Load remediation playbooks (for matching folder category to playbook steps)
  const playbookCache = await loadPlaybooks();
  const userPrompt = buildGuidancePrompt(params, playbookCache);

  // Update system prompt to include playbook reference
  const systemPrompt = params.folderContext?.category
    ? `${GUIDANCE_SYSTEM_PROMPT}\n\n## Playbook Reference\nThe user is in the "${params.folderContext.category}" category. If a remediation playbook is available above, use its steps to inform your recommended actions. Align your path strategies with the playbook's structured approach where applicable.`
    : GUIDANCE_SYSTEM_PROMPT;

  const raw = await callAI(
    params.provider,
    params.apiKey,
    params.model,
    params.customEndpoint,
    GUIDANCE_SYSTEM_PROMPT,
    userPrompt,
  );

  const paths = parseGuidanceResponse(raw);

  const disputeValue = params.folderContext?.dispute_value ?? 0;
  const pathsWithCosts = attachCostEstimates(paths, disputeValue);

  return pathsWithCosts;
}

// ── Document Generation ─────────────────────────────────────────────────────

const DOCUMENT_SYSTEM_PROMPT = `You are a German legal document generator. Your task is to fill a German legal document template with the user's case details.

Return ONLY the filled document as plain text. Do not include JSON, markdown code fences, or extra commentary.

Replace any handlebars-style placeholders ({{placeholder_name}}) with the corresponding value from the context provided. If a value is missing, leave the placeholder as-is but add [FEHLT] after it.`;

export async function generateDocument(
  params: DocumentGenerationParams,
): Promise<GeneratedDocument> {
  const { templateSlug, folderContext, situation } = params;

  const contextSummary = `
Template: ${templateSlug}
Incident Date: ${folderContext.incident_date || "N/A"}
Dispute Value: €${folderContext.dispute_value}
Status: ${folderContext.status}
Opposing Party: ${folderContext.opposing_party || "N/A"}
Deadline: ${folderContext.deadline_date || "N/A"}
Court: ${folderContext.court_name || "N/A"}
Case Number: ${folderContext.case_number || "N/A"}
User's Notes: ${folderContext.notes || "N/A"}

User's Situation Description:
${situation}
`;

  const userPrompt = `Fill the document template "${templateSlug}" with the following case context:\n\n${contextSummary}\n\nOutput the complete filled document in German legal format.`;

  const content = await callAI(
    params.provider,
    params.apiKey,
    params.model,
    params.customEndpoint,
    DOCUMENT_SYSTEM_PROMPT,
    userPrompt,
  );

  const placeholders: Record<string, string> = {
    incident_date: folderContext.incident_date || "",
    dispute_value: String(folderContext.dispute_value),
    status: folderContext.status,
    opposing_party: folderContext.opposing_party,
    deadline_date: folderContext.deadline_date || "",
    court_name: folderContext.court_name,
    case_number: folderContext.case_number,
    notes: folderContext.notes,
    situation,
  };

  return {
    title: `Document — ${templateSlug}`,
    content,
    template_slug: templateSlug,
    placeholders_filled: placeholders,
  };
}

// ── Language Helpers ────────────────────────────────────────────────────────

export function getLanguagePrompt(language: AppLanguage): string {
  const languageMap: Record<AppLanguage, string> = {
    de: "German",
    en: "English",
    tr: "Turkish",
    ar: "Arabic",
    fr: "French",
    es: "Spanish",
    pl: "Polish",
    uk: "Ukrainian",
    ru: "Russian",
  };
  return languageMap[language] || "English";
}

export { GUIDANCE_SYSTEM_PROMPT, buildGuidancePrompt, LEGAL_DISCLAIMER };
