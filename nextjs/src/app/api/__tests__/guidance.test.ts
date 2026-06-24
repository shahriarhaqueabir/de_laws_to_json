import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks (MUST be before route import) ──────────────────────────────────────

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSupabase = {
  auth: {
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "case-file-1" },
          error: null,
        }),
      })),
    })),
  })),
};

vi.mock("@/lib/supabase-server", () => ({
  getServerClient: () => mockSupabase,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

// Mock Qdrant search
vi.mock("@/lib/qdrant", () => ({
  searchNorms: vi.fn().mockResolvedValue([
    {
      law_key: "BGB",
      law_title: "Bürgerliches Gesetzbuch",
      category: "civil",
      norm_id: "§ 823",
      norm_title: "Schadensersatzpflicht",
      content:
        "Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet.",
      score: 0.85,
    },
    {
      law_key: "StVG",
      law_title: "Straßenverkehrsgesetz",
      category: "traffic",
      norm_id: "§ 7",
      norm_title: "Haftung des Fahrzeughalters",
      content:
        "Wird bei dem Betrieb eines Kraftfahrzeugs oder eines Anhängers ein Mensch getötet, der Körper oder die Gesundheit eines Menschen verletzt oder eine Sache beschädigt, so ist der Halter verpflichtet, dem Verletzten den daraus entstehenden Schaden zu ersetzen.",
      score: 0.82,
    },
  ]),
}));

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  decryptApiKey: vi.fn().mockResolvedValue("sk-mock-key"),
}));

// Mock translate-server (avoid real env-dependent translation calls)
vi.mock("@/lib/translate-server", () => ({
  translateQueryToGerman: vi.fn((text: string) => Promise.resolve(text)),
  translateFromGerman: vi.fn((text: string) => Promise.resolve(text)),
}));

// Mock generateGuidancePaths (avoid real AI API calls)
vi.mock("@/lib/guidance", () => ({
  generateGuidancePaths: vi.fn().mockResolvedValue([
    {
      path_number: 1,
      title: "Right to Compensation",
      summary: "You may be entitled to compensation under § 823 BGB",
      detailed_analysis: "Analysis text here",
      laws_cited: [
        {
          law_key: "BGB",
          norm_id: "§ 823",
          law_title: "Bürgerliches Gesetzbuch",
        },
      ],
      risk_level: "medium",
      cost_estimate: 500,
      recommended_actions: ["Document everything", "Contact a lawyer"],
    },
    {
      path_number: 2,
      title: "Traffic Accident Claim",
      summary: "You can file a claim with the insurance company",
      detailed_analysis: "Analysis text here",
      laws_cited: [
        {
          law_key: "StVG",
          norm_id: "§ 7",
          law_title: "Straßenverkehrsgesetz",
        },
      ],
      risk_level: "low",
      cost_estimate: 0,
      recommended_actions: ["File insurance claim", "Gather evidence"],
    },
  ]),
}));

import { POST } from "@/app/api/guidance/route";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/guidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 422 when situation is too short", async () => {
    const req = new NextRequest("http://localhost/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation: "Hi" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when situation exceeds max length", async () => {
    const req = new NextRequest("http://localhost/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation: "x".repeat(10001) }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns basic search results when user has no API key", async () => {
    mockSupabase.from().select().eq().maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const req = new NextRequest("http://localhost/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        situation:
          "I was in a car accident on the highway and the other driver was at fault.",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.session_id).toBeNull();
    expect(body.data.paths).toHaveLength(2);
    expect(body.data.paths[0].path_number).toBe(1);
    expect(body.data.paths[0].laws_cited).toBeDefined();
  });

  it("returns basic search results for anonymous users", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        situation:
          "I slipped and fell in a supermarket due to a wet floor with no warning sign.",
        language: "en",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.session_id).toBeNull();
    expect(body.data.paths).toBeDefined();
    expect(body.data.language).toBe("en");
  });

  it("accepts folder_context with all 8 properties", async () => {
    const req = new NextRequest("http://localhost/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        situation: "My landlord refuses to fix the heating in my apartment.",
        language: "en",
        folder_context: {
          id: "folder-1",
          name: "Rent Reduction",
          category: "housing",
          incident_date: "2025-01-15",
          dispute_value: 3000,
          status: "pre_action",
          opposing_party: "Landlord GmbH",
          deadline_date: "2025-02-15",
          court_name: "Amtsgericht Berlin",
          case_number: "",
          notes: "Heating has been broken since December",
        },
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.folder_context).toBeDefined();
    expect(body.data.folder_context.name).toBe("Rent Reduction");
  });

  it("returns 400-level for empty body", async () => {
    const req = new NextRequest("http://localhost/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
