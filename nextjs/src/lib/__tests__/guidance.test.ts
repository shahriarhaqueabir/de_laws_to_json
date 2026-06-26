/**
 * Tests for guidance.ts — the core guidance engine
 *
 * Tests are structured into:
 * 1. Constants (CATEGORY_PLAYBOOK_MAP)
 * 2. Prompt building (buildPlaybookContext, buildGuidancePrompt)
 * 3. Response parsing (parseGuidanceResponse)
 * 4. Cost estimation (attachCostEstimates)
 * 5. Deadline warnings (calculateDeadlineWarnings)
 * 6. Language helper (getLanguagePrompt)
 * 7. Document generation (generateDocument)
 * 8. Main orchestrator (generateGuidancePaths)
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseGuidanceResponse,
  attachCostEstimates,
  calculateDeadlineWarnings,
  getLanguagePrompt,
  buildGuidancePrompt,
  buildPlaybookContext,
  generateDocument,
  generateGuidancePaths,
  CATEGORY_PLAYBOOK_MAP,
} from "@/lib/guidance";
import type {
  FolderContext,
  GuidancePath,
  GenerateGuidanceParams,
  DocumentGenerationParams,
} from "@/lib/guidance";
import type { AppLanguage } from "@/lib/types";

// Mocks for modules that have server-only dependencies
// These must be at top level since vi.mock is hoisted
vi.mock("@/lib/ai-provider", () => ({
  callOpenAI: vi.fn(),
  callAnthropic: vi.fn(),
  callOpenAICompatible: vi.fn(),
  LEGAL_DISCLAIMER: "This is not legal advice.",
}));

vi.mock("@/lib/supabase-server", () => ({
  getServerClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(new Map()),
}));

// Get mock references for per-test configuration
import { callOpenAI } from "@/lib/ai-provider";
import { getServerClient } from "@/lib/supabase-server";

// ── Mock Data ──────────────────────────────────────────────────────────────

const VALID_JSON_RESPONSE_RAW = {
  paths: [
    {
      title: "Out-of-Court Settlement",
      summary: "Negotiate directly to resolve this matter.",
      detailed_analysis:
        "An out-of-court settlement (außergerichtliche Einigung) is governed by § 779 BGB.",
      laws_cited: [
        {
          law_key: "BGB",
          norm_id: "§ 779",
          law_title: "Bürgerliches Gesetzbuch",
        },
      ],
      risk_level: "low",
      risk_reason: "No court exposure.",
      recommended_actions: ["Document facts", "Send demand letter"],
      estimated_timeline: "2-6 weeks",
      success_probability: 0.65,
    },
    {
      title: "Court Action",
      summary: "File a formal lawsuit.",
      detailed_analysis:
        "Filing a lawsuit (Klage) initiates formal proceedings.",
      laws_cited: [
        {
          law_key: "ZPO",
          norm_id: "§ 253",
          law_title: "Zivilprozessordnung",
        },
      ],
      risk_level: "medium",
      risk_reason: "Cost risk if losing.",
      recommended_actions: ["Engage lawyer", "Prepare evidence"],
      estimated_timeline: "3-12 months",
      success_probability: 0.55,
    },
    {
      title: "Preliminary Injunction",
      summary: "Seek temporary court order.",
      detailed_analysis:
        "Under §§ 935, 940 ZPO, a preliminary injunction (einstweilige Verfügung).",
      laws_cited: [
        {
          law_key: "ZPO",
          norm_id: "§ 935",
          law_title: "Zivilprozessordnung",
        },
      ],
      risk_level: "high",
      risk_reason: "Damages liability if wrongfully obtained.",
      recommended_actions: ["Document urgency", "File application"],
      estimated_timeline: "1-4 weeks",
      success_probability: 0.4,
    },
  ],
};

const VALID_JSON_RESPONSE = JSON.stringify(VALID_JSON_RESPONSE_RAW);

const CODED_RESPONSE = `\`\`\`json
${VALID_JSON_RESPONSE}
\`\`\``;

const INVALID_RESPONSE = "I cannot provide legal advice at this time.";
const PARTIAL_RESPONSE = `Here are some options: ${VALID_JSON_RESPONSE}`;

const mockFolder: FolderContext = {
  id: "folder-1",
  name: "Test Case",
  category: "labor",
  incident_date: "2026-05-01",
  dispute_value: 15000,
  status: "pre_action",
  opposing_party: "Employer GmbH",
  deadline_date: "2026-06-15",
  court_name: "Arbeitsgericht Berlin",
  case_number: "5 Ca 1234/24",
  notes: "Wrongful dismissal after 5 years of employment",
};

const basePaths: GuidancePath[] = [
  {
    path_number: 1,
    title: "Test",
    summary: "Test",
    detailed_analysis: "Test",
    laws_cited: [],
    risk_level: "medium",
    risk_reason: "Test",
    cost_estimate: null,
    cost_breakdown: null,
    recommended_actions: ["Step 1"],
    estimated_timeline: "1 week",
    success_probability: 0.5,
  },
];

const mockPlaybooks = [
  {
    category: "labor",
    issue_type: "wrongful_dismissal",
    steps: [
      {
        step: 1,
        title: "Check probation period",
        description: "Verify if the employee was still on probation",
        deadline_days: 21,
        type: "review",
        statute: "§ 1 KSchG",
      },
      {
        step: 2,
        title: "File dismissal protection suit",
        description: "Submit to the labor court",
        deadline_days: 21,
        type: "legal",
        statute: "§ 4 KSchG",
      },
    ],
  },
  {
    category: "labor",
    issue_type: "severance_negotiation",
    steps: [
      {
        step: 1,
        title: "Calculate severance",
        description: "Compute potential severance payment",
        deadline_days: null,
        type: "review",
      },
    ],
  },
];

// ── 1. Constants: CATEGORY_PLAYBOOK_MAP ────────────────────────────────────

describe("CATEGORY_PLAYBOOK_MAP", () => {
  it("maps labor to wrongful_dismissal", () => {
    expect(CATEGORY_PLAYBOOK_MAP.labor).toEqual(["wrongful_dismissal"]);
  });

  it("maps housing to rent_reduction", () => {
    expect(CATEGORY_PLAYBOOK_MAP.housing).toEqual(["rent_reduction"]);
  });

  it("maps consumer to three issue types", () => {
    expect(CATEGORY_PLAYBOOK_MAP.consumer).toEqual([
      "deposit_retention",
      "withdrawal",
      "warranty",
    ]);
  });

  it("maps traffic to fine_contest", () => {
    expect(CATEGORY_PLAYBOOK_MAP.traffic).toEqual(["fine_contest"]);
  });

  it("maps family to custody", () => {
    expect(CATEGORY_PLAYBOOK_MAP.family).toEqual(["custody"]);
  });

  it("maps public to defense_strategy", () => {
    expect(CATEGORY_PLAYBOOK_MAP.public).toEqual(["defense_strategy"]);
  });

  it("maps other to empty array", () => {
    expect(CATEGORY_PLAYBOOK_MAP.other).toEqual([]);
  });

  it("returns undefined for unknown keys", () => {
    expect(CATEGORY_PLAYBOOK_MAP["unknown"]).toBeUndefined();
  });
});

// ── 2. Prompt Building: buildPlaybookContext ────────────────────────────────

describe("buildPlaybookContext", () => {
  it("formats matched playbook steps with deadlines and statutes", () => {
    const result = buildPlaybookContext("labor", mockPlaybooks);
    expect(result).toContain("## Remediation Playbooks");
    expect(result).toContain("Wrongful Dismissal");
    expect(result).toContain("Check probation period");
    expect(result).toContain("§ 1 KSchG");
    expect(result).toContain("(Deadline: 21 days)");
    expect(result).toContain("File dismissal protection suit");
  });

  it("formats issue_type with title case", () => {
    const result = buildPlaybookContext("labor", mockPlaybooks);
    expect(result).toContain("Wrongful Dismissal");
    expect(result).toContain("Check probation period");
  });

  it("handles steps without deadline or statute", () => {
    // Only wrongful_dismissal is matched for labor
    const result = buildPlaybookContext("labor", mockPlaybooks);
    expect(result).toContain("Wrongful Dismissal");
    expect(result).toContain("Check probation period");
  });

  it("returns empty string when no playbooks match the category", () => {
    const result = buildPlaybookContext("other", mockPlaybooks);
    expect(result).toBe("");
  });

  it("returns empty string for unknown category", () => {
    const result = buildPlaybookContext("unknown_category", mockPlaybooks);
    expect(result).toBe("");
  });

  it("returns empty string for empty playbook cache", () => {
    const result = buildPlaybookContext("labor", []);
    expect(result).toBe("");
  });

  it("includes multiple matched playbooks for same category", () => {
    const result = buildPlaybookContext("labor", mockPlaybooks);
    expect(result).toContain("### Wrongful Dismissal");
  });
});

// ── 3. Prompt Building: buildGuidancePrompt ────────────────────────────────

describe("buildGuidancePrompt", () => {
  const baseParams = (
    overrides: Partial<GenerateGuidanceParams> = {},
  ): GenerateGuidanceParams => ({
    situation: "I was fired without notice after 5 years",
    language: "en",
    folderContext: null,
    bookmarkedLaws: [],
    qdrantResults: [],
    qdrantContext: "",
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    customEndpoint: "",
    ...overrides,
  });

  it("includes the user's situation text", () => {
    const prompt = buildGuidancePrompt(baseParams(), []);
    expect(prompt).toContain("I was fired without notice after 5 years");
  });

  it("includes folder context with all 8 properties when provided", () => {
    const prompt = buildGuidancePrompt(
      baseParams({ folderContext: mockFolder }),
      [],
    );
    expect(prompt).toContain("## User's Case Context");
    expect(prompt).toContain("Category: labor");
    expect(prompt).toContain("Incident Date: 2026-05-01");
    expect(prompt).toContain("Dispute Value (Streitwert): €15000");
    expect(prompt).toContain("Status: pre_action");
    expect(prompt).toContain("Opposing Party: Employer GmbH");
    expect(prompt).toContain("Deadline: 2026-06-15");
    expect(prompt).toContain("Court: Arbeitsgericht Berlin");
    expect(prompt).toContain("Case Number: 5 Ca 1234/24");
    expect(prompt).toContain(
      "Notes: Wrongful dismissal after 5 years of employment",
    );
  });

  it("omits folder fields that are empty or zero", () => {
    const emptyFolder: FolderContext = {
      id: "f-2",
      name: "Minimal",
      category: "other",
      incident_date: null,
      dispute_value: 0,
      status: "pre_action",
      opposing_party: "",
      deadline_date: null,
      court_name: "",
      case_number: "",
      notes: "",
    };
    const prompt = buildGuidancePrompt(
      baseParams({ folderContext: emptyFolder }),
      [],
    );
    expect(prompt).toContain("## User's Case Context");
    expect(prompt).toContain("Category: other");
    expect(prompt).not.toContain("Incident Date:");
    expect(prompt).not.toContain("Dispute Value");
    expect(prompt).not.toContain("Opposing Party:");
    expect(prompt).not.toContain("Deadline:");
    expect(prompt).not.toContain("Court:");
    expect(prompt).not.toContain("Case Number:");
    expect(prompt).not.toContain("Notes:");
  });

  it("includes bookmarked laws when provided", () => {
    const bookmarkedLaws = [
      {
        law_key: "BGB",
        norm_id: "§ 611a",
        law_title: "Bürgerliches Gesetzbuch",
      },
      {
        law_key: "KSchG",
        norm_id: "§ 1",
        law_title: "Kündigungsschutzgesetz",
      },
    ];
    const prompt = buildGuidancePrompt(baseParams({ bookmarkedLaws }), []);
    expect(prompt).toContain("## User's Bookmarked Laws");
    expect(prompt).toContain("BGB § 611a — Bürgerliches Gesetzbuch");
    expect(prompt).toContain("KSchG § 1 — Kündigungsschutzgesetz");
  });

  it("includes Qdrant search context when provided", () => {
    const qdrantCtx =
      "§ 622 BGB: Notice periods\n§ 626 BGB: Extraordinary termination";
    const prompt = buildGuidancePrompt(
      baseParams({ qdrantContext: qdrantCtx }),
      [],
    );
    expect(prompt).toContain("## Relevant German Laws (from search)");
    expect(prompt).toContain("§ 622 BGB: Notice periods");
  });

  it("includes playbook context when folder category matches", () => {
    const prompt = buildGuidancePrompt(
      baseParams({ folderContext: mockFolder }),
      mockPlaybooks,
    );
    expect(prompt).toContain("## Remediation Playbooks");
    expect(prompt).toContain("### Wrongful Dismissal");
  });

  it("sets language instruction correctly for DE, EN, and other languages", () => {
    const dePrompt = buildGuidancePrompt(baseParams({ language: "de" }), []);
    expect(dePrompt).toContain(
      "Generate 3-5 possible legal outcome paths in German",
    );

    const enPrompt = buildGuidancePrompt(baseParams({ language: "en" }), []);
    expect(enPrompt).toContain(
      "Generate 3-5 possible legal outcome paths in English",
    );

    const frPrompt = buildGuidancePrompt(baseParams({ language: "fr" }), []);
    expect(frPrompt).toContain(
      "Generate 3-5 possible legal outcome paths in fr",
    );
  });

  it("omits sections when their data is empty", () => {
    const prompt = buildGuidancePrompt(baseParams(), []);
    expect(prompt).not.toContain("## User's Case Context");
    expect(prompt).not.toContain("## User's Bookmarked Laws");
    expect(prompt).not.toContain("## Relevant German Laws (from search)");
    expect(prompt).not.toContain("## Remediation Playbooks");
  });

  it("ends with instructions section", () => {
    const prompt = buildGuidancePrompt(baseParams(), []);
    expect(prompt).toContain("## Instructions");
    expect(prompt).toContain("Generate 3-5 possible legal outcome paths");
  });
});

// ── 4. Response Parsing ────────────────────────────────────────────────────

describe("parseGuidanceResponse", () => {
  it("parses valid JSON response", () => {
    const paths = parseGuidanceResponse(VALID_JSON_RESPONSE);
    expect(paths).toHaveLength(3);
    expect(paths[0].path_number).toBe(1);
    expect(paths[0].title).toBe("Out-of-Court Settlement");
    expect(paths[0].risk_level).toBe("low");
    expect(paths[0].success_probability).toBe(0.65);
    expect(paths[0].laws_cited).toHaveLength(1);
    expect(paths[0].laws_cited[0].law_key).toBe("BGB");
  });

  it("parses JSON wrapped in markdown code fences", () => {
    const paths = parseGuidanceResponse(CODED_RESPONSE);
    expect(paths).toHaveLength(3);
    expect(paths[0].title).toBe("Out-of-Court Settlement");
  });

  it("extracts JSON from mixed text response", () => {
    const paths = parseGuidanceResponse(PARTIAL_RESPONSE);
    expect(paths).toHaveLength(3);
  });

  it("throws on invalid non-JSON response", () => {
    expect(() => parseGuidanceResponse(INVALID_RESPONSE)).toThrow(
      "Failed to parse",
    );
  });

  it("throws on missing paths array", () => {
    const bad = JSON.stringify({ not_paths: [] });
    expect(() => parseGuidanceResponse(bad)).toThrow(
      "AI response missing 'paths' array",
    );
  });

  it("normalizes invalid risk levels to medium", () => {
    const bad = JSON.stringify({
      paths: [
        {
          title: "Test",
          summary: "Test",
          detailed_analysis: "Test",
          laws_cited: [],
          risk_level: "extreme",
          risk_reason: "Test",
          recommended_actions: ["Step 1"],
          estimated_timeline: "1 week",
          success_probability: 0.5,
        },
      ],
    });
    const paths = parseGuidanceResponse(bad);
    expect(paths[0].risk_level).toBe("medium");
  });

  it("clamps success probability to [0, 1] range", () => {
    const above = JSON.stringify({
      paths: [
        {
          title: "Test",
          summary: "Test",
          detailed_analysis: "Test",
          laws_cited: [],
          risk_level: "low",
          risk_reason: "Test",
          recommended_actions: ["Step 1"],
          estimated_timeline: "1 week",
          success_probability: 1.5,
        },
      ],
    });
    expect(parseGuidanceResponse(above)[0].success_probability).toBe(1);

    const below = JSON.stringify({
      paths: [
        {
          title: "Test",
          summary: "Test",
          detailed_analysis: "Test",
          laws_cited: [],
          risk_level: "low",
          risk_reason: "Test",
          recommended_actions: ["Step 1"],
          estimated_timeline: "1 week",
          success_probability: -0.5,
        },
      ],
    });
    expect(parseGuidanceResponse(below)[0].success_probability).toBe(0);
  });

  it("defaults NaN or missing success probability to 0.5", () => {
    const nanVal = JSON.stringify({
      paths: [
        {
          title: "Test",
          summary: "Test",
          detailed_analysis: "Test",
          laws_cited: [],
          risk_level: "low",
          risk_reason: "Test",
          recommended_actions: ["Step 1"],
          estimated_timeline: "1 week",
          success_probability: "not-a-number",
        },
      ],
    });
    expect(parseGuidanceResponse(nanVal)[0].success_probability).toBe(0.5);
  });

  it("defaults missing optional fields gracefully", () => {
    const minimal = JSON.stringify({
      paths: [
        {
          title: "Test",
          summary: "Test",
          detailed_analysis: "Test",
          risk_level: "medium",
        },
      ],
    });
    const paths = parseGuidanceResponse(minimal);
    expect(paths[0].recommended_actions).toEqual([]);
    expect(paths[0].estimated_timeline).toBe("Varies");
    expect(paths[0].success_probability).toBe(0.5);
    expect(paths[0].laws_cited).toEqual([]);
    expect(paths[0].risk_reason).toBe("");
  });

  it("handles empty paths array", () => {
    const empty = JSON.stringify({ paths: [] });
    const paths = parseGuidanceResponse(empty);
    expect(paths).toEqual([]);
  });

  it("strips code fences without json tag", () => {
    const fenced = "```\n" + VALID_JSON_RESPONSE + "\n```";
    const paths = parseGuidanceResponse(fenced);
    expect(paths).toHaveLength(3);
  });

  it("recovers JSON embedded in conversational text", () => {
    const narrative =
      "Based on German law, here are your options:\n\n" +
      VALID_JSON_RESPONSE +
      "\n\nPlease consult a lawyer.";
    const paths = parseGuidanceResponse(narrative);
    expect(paths).toHaveLength(3);
  });

  it("assigns sequential path numbers starting at 1", () => {
    const paths = parseGuidanceResponse(VALID_JSON_RESPONSE);
    expect(paths[0].path_number).toBe(1);
    expect(paths[1].path_number).toBe(2);
    expect(paths[2].path_number).toBe(3);
  });
});

// ── 5. Cost Estimation ─────────────────────────────────────────────────────

describe("attachCostEstimates", () => {
  it("attaches cost estimates for valid dispute value", () => {
    const result = attachCostEstimates(basePaths, 15000);
    expect(result[0].cost_estimate).toBeGreaterThan(0);
    expect(result[0].cost_breakdown).not.toBeNull();
    expect(result[0].cost_breakdown?.court_fees).toBeGreaterThan(0);
    expect(result[0].cost_breakdown?.lawyer_fees).toBeGreaterThan(0);
    expect(result[0].cost_breakdown?.total_risk).toBeGreaterThan(0);
  });

  it("returns paths unchanged for zero or negative dispute value", () => {
    expect(attachCostEstimates(basePaths, 0)[0].cost_estimate).toBeNull();
    expect(attachCostEstimates(basePaths, -1)[0].cost_estimate).toBeNull();
  });

  it("applies same cost to all paths in a batch", () => {
    const multiPaths: GuidancePath[] = [
      { ...basePaths[0] },
      { ...basePaths[0], path_number: 2 },
    ];
    const result = attachCostEstimates(multiPaths, 10000);
    expect(result[0].cost_estimate).toBe(result[1].cost_estimate);
  });
});

// ── 6. Deadline Warnings ───────────────────────────────────────────────────

describe("calculateDeadlineWarnings", () => {
  it("returns folder deadline warning when deadline_date is provided", () => {
    const warnings = calculateDeadlineWarnings("2026-05-01", "2026-06-15");
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].label).toBe("Folder deadline");
    expect(warnings[0].statute).toBe("User-set deadline");
  });

  it("marks deadline as urgent within 14 days", () => {
    const nearFuture = new Date();
    nearFuture.setDate(nearFuture.getDate() + 5);
    const warnings = calculateDeadlineWarnings(
      "2026-05-01",
      nearFuture.toISOString().split("T")[0],
    );
    const folderWarn = warnings.find((w) => w.label === "Folder deadline");
    expect(folderWarn?.is_urgent).toBe(true);
  });

  it("marks deadline as not urgent when far out", () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 60);
    const warnings = calculateDeadlineWarnings(
      "2026-05-01",
      farFuture.toISOString().split("T")[0],
    );
    const folderWarn = warnings.find((w) => w.label === "Folder deadline");
    expect(folderWarn?.is_urgent).toBe(false);
  });

  it("returns KSchG and BGB deadlines when incident date is provided", () => {
    const warnings = calculateDeadlineWarnings("2026-05-01", null);
    const kSchg = warnings.find((w) =>
      w.label.includes("Kündigungsschutzklage"),
    );
    expect(kSchg).toBeDefined();
    expect(kSchg?.statute).toBe("§ 4 KSchG");

    const bgb = warnings.find((w) => w.label.includes("Mietminderung"));
    expect(bgb).toBeDefined();
    expect(bgb?.statute).toBe("§ 548 BGB");
  });

  it("returns empty array when no dates provided", () => {
    const warnings = calculateDeadlineWarnings(null, null);
    expect(warnings).toEqual([]);
  });

  it("returns folder + KSchG + BGB deadlines when both dates provided", () => {
    const warnings = calculateDeadlineWarnings("2026-05-01", "2026-06-15");
    expect(warnings).toHaveLength(3);
    expect(warnings.some((w) => w.label === "Folder deadline")).toBe(true);
    expect(
      warnings.some((w) => w.label.includes("Kündigungsschutzklage")),
    ).toBe(true);
    expect(warnings.some((w) => w.label.includes("Mietminderung"))).toBe(true);
  });

  it("handles past deadlines as urgent", () => {
    const warnings = calculateDeadlineWarnings(null, "2020-01-01");
    expect(warnings[0].days_remaining).toBeLessThan(0);
    expect(warnings[0].is_urgent).toBe(true);
  });
});

// ── 7. Language Helper ─────────────────────────────────────────────────────

describe("getLanguagePrompt", () => {
  const expected: Record<string, string> = {
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

  it("returns correct language for all 9 supported languages", () => {
    for (const [code, name] of Object.entries(expected)) {
      expect(getLanguagePrompt(code as AppLanguage)).toBe(name);
    }
  });

  it("defaults to English for unknown languages", () => {
    expect(getLanguagePrompt("unknown" as AppLanguage)).toBe("English");
  });
});

// ── 8. Document Generation ─────────────────────────────────────────────────

describe("generateDocument", () => {
  beforeEach(() => {
    vi.mocked(callOpenAI).mockReset();
  });

  it("generates document with all placeholders from folder context", async () => {
    vi.mocked(callOpenAI).mockResolvedValue(
      "Sehr geehrte Damen und Herren,\n\nhiermit lege ich Widerspruch ein...",
    );

    const docParams: DocumentGenerationParams = {
      templateSlug: "widerspruch-mietpreisbremse",
      folderContext: mockFolder,
      situation: "I received a rent increase notice that exceeds the cap",
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
    };

    const doc = await generateDocument(docParams);

    expect(doc).toHaveProperty("title");
    expect(doc).toHaveProperty("content");
    expect(doc).toHaveProperty("template_slug");
    expect(doc).toHaveProperty("placeholders_filled");
    expect(doc.template_slug).toBe("widerspruch-mietpreisbremse");
    expect(doc.placeholders_filled.incident_date).toBe("2026-05-01");
    expect(doc.placeholders_filled.dispute_value).toBe("15000");
    expect(doc.placeholders_filled.status).toBe("pre_action");
    expect(doc.placeholders_filled.opposing_party).toBe("Employer GmbH");
    expect(doc.placeholders_filled.situation).toBe(
      "I received a rent increase notice that exceeds the cap",
    );
  });

  it("handles missing folder fields gracefully", async () => {
    vi.mocked(callOpenAI).mockResolvedValue("Document content");

    const minimalFolder: FolderContext = {
      id: "f-3",
      name: "Minimal",
      category: "other",
      incident_date: null,
      dispute_value: 0,
      status: "pre_action",
      opposing_party: "",
      deadline_date: null,
      court_name: "",
      case_number: "",
      notes: "",
    };

    const docParams: DocumentGenerationParams = {
      templateSlug: "test-template",
      folderContext: minimalFolder,
      situation: "Test situation",
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
    };

    const doc = await generateDocument(docParams);
    expect(doc.placeholders_filled.incident_date).toBe("");
    expect(doc.placeholders_filled.dispute_value).toBe("0");
    expect(doc.placeholders_filled.opposing_party).toBe("");
  });

  it("prefixes title with 'Document —'", async () => {
    vi.mocked(callOpenAI).mockResolvedValue("Doc body");

    const doc = await generateDocument({
      templateSlug: "test-template",
      folderContext: mockFolder,
      situation: "Test",
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
    });
    expect(doc.title).toBe("Document — test-template");
  });
});

// ── 9. Main Orchestrator: generateGuidancePaths ────────────────────────────

describe("generateGuidancePaths", () => {
  beforeEach(() => {
    vi.mocked(callOpenAI).mockReset();
    vi.mocked(getServerClient).mockReset();
  });

  it("returns parsed paths with cost estimates attached", async () => {
    vi.mocked(callOpenAI).mockResolvedValue(VALID_JSON_RESPONSE);

    vi.mocked(getServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as any);

    const params: GenerateGuidanceParams = {
      situation: "I was fired without notice",
      language: "en",
      folderContext: { ...mockFolder, dispute_value: 5000 },
      bookmarkedLaws: [],
      qdrantResults: [],
      qdrantContext: "",
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
    };

    const paths = await generateGuidancePaths(params);

    expect(paths).toHaveLength(3);
    expect(paths[0].path_number).toBe(1);
    expect(paths[0].risk_level).toBe("low");
    expect(paths[0].cost_estimate).toBeGreaterThan(0);
    expect(paths[0].cost_breakdown).not.toBeNull();
  });

  it("handles empty playbooks gracefully", async () => {
    vi.mocked(callOpenAI).mockResolvedValue(VALID_JSON_RESPONSE);
    vi.mocked(getServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as any);

    const params: GenerateGuidanceParams = {
      situation: "Test",
      language: "en",
      folderContext: null,
      bookmarkedLaws: [],
      qdrantResults: [],
      qdrantContext: "",
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
    };

    const paths = await generateGuidancePaths(params);
    expect(paths).toHaveLength(3);
  });

  it("throws when AI provider fails", async () => {
    vi.mocked(callOpenAI).mockRejectedValue(
      new Error("API rate limit exceeded"),
    );
    vi.mocked(getServerClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as any);

    const params: GenerateGuidanceParams = {
      situation: "Test",
      language: "en",
      folderContext: null,
      bookmarkedLaws: [],
      qdrantResults: [],
      qdrantContext: "",
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
    };

    await expect(generateGuidancePaths(params)).rejects.toThrow(
      "API rate limit exceeded",
    );
  });
});
