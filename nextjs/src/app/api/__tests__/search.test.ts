/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSearchNorms = vi.fn();
const mockSupabaseChain = vi.hoisted(() => {
  const chain: Record<string, any> = {};
  const buildThenable = (result: any) => {
    const thenable = Promise.resolve(result);
    return Object.assign(thenable, {
      from: vi.fn(() => thenable),
      select: vi.fn(() => thenable),
      eq: vi.fn(() => thenable),
      order: vi.fn(() => thenable),
      range: vi.fn(() => thenable),
      limit: vi.fn(() => thenable),
      single: vi.fn(() => thenable),
      insert: vi.fn().mockResolvedValue({ error: null }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
  };
  return { buildThenable };
});

const mockSupabaseResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  count: 0,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() =>
    mockSupabaseChain.buildThenable(mockSupabaseResult),
  ),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/qdrant", () => ({
  searchNorms: mockSearchNorms,
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  mockSearchNorms.mockReset();
  mockSupabaseResult.data = null;
  mockSupabaseResult.error = null;
  mockSupabaseResult.count = 0;
});

describe("GET /api/search", () => {
  it("returns results for semantic search with query", async () => {
    mockSearchNorms.mockResolvedValue([
      {
        law_key: "BGB",
        law_title: "Bürgerliches Gesetzbuch",
        category: "civil",
        norm_id: "§ 433",
        norm_title: "Kaufvertrag",
        content: "Der Verkäufer einer Sache...",
        score: 0.95,
      },
      {
        law_key: "BGB",
        law_title: "Bürgerliches Gesetzbuch",
        category: "civil",
        norm_id: "§ 434",
        norm_title: "Sachmangel",
        content: "Die Sache ist frei von Sachmängeln...",
        score: 0.82,
      },
      {
        law_key: "StGB",
        law_title: "Strafgesetzbuch",
        category: "criminal",
        norm_id: "§ 263",
        norm_title: "Betrug",
        content: "Wer in der Absicht...",
        score: 0.45,
      },
    ]);

    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search?q=Kaufvertrag");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("total", 3);
    // Grouped by law_key — 2 BGB norms + 1 StGB norm → 2 law-level results
    expect(body.results).toHaveLength(2);

    const bgb = body.results.find(
      (r: Record<string, unknown>) => r.key === "BGB",
    );
    expect(bgb).toBeDefined();
    expect(bgb.normHits).toBe(2);
    expect(bgb.relevantNorms).toHaveLength(2);
    // relevance = Math.round(0.95 * 100) = 95
    expect(bgb.relevance).toBe(95);

    const stgb = body.results.find(
      (r: Record<string, unknown>) => r.key === "StGB",
    );
    expect(stgb).toBeDefined();
    expect(stgb.normHits).toBe(1);
    expect(stgb.relevantNorms).toHaveLength(1);
  });

  it("returns category browse results when no query but category provided", async () => {
    mockSupabaseResult.data = [
      {
        key: "BGB",
        title: "Bürgerliches Gesetzbuch",
        category: "civil",
      },
      {
        key: "StGB",
        title: "Strafgesetzbuch",
        category: "civil",
      },
    ];
    mockSupabaseResult.count = 2;

    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search?category=civil");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(2);
    expect(body.results[0].key).toBe("BGB");
  });

  it("groups results by law_key with top 3 norms", async () => {
    const norms = Array.from({ length: 5 }, (_, i) => ({
      law_key: "BGB",
      law_title: "BGB",
      category: "civil",
      norm_id: `§ ${i + 1}`,
      norm_title: `Norm ${i + 1}`,
      content: `Content ${i + 1}`,
      score: 1.0 - i * 0.1,
    }));
    mockSearchNorms.mockResolvedValue(norms);

    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search?q=test");
    const res = await GET(req);
    const body = await res.json();

    expect(body.results).toHaveLength(1);
    expect(body.results[0].relevantNorms).toHaveLength(3); // top 3
    expect(body.results[0].normHits).toBe(5); // all 5 counted
    expect(body.results[0].contextSummary).toContain("5");
  });

  it("returns pagination offset correctly (page=2 => offset=20)", async () => {
    mockSearchNorms.mockResolvedValue([]);

    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search?q=test&page=2");
    await GET(req);

    expect(mockSearchNorms).toHaveBeenCalledWith("test", undefined, 50, 20);
  });

  it("clamps invalid page numbers to 1", async () => {
    mockSearchNorms.mockResolvedValue([]);

    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search?q=test&page=-1");
    await GET(req);

    // offset = (1 - 1) * 20 = 0
    expect(mockSearchNorms).toHaveBeenCalledWith("test", undefined, 50, 0);
  });

  it("returns 422 when no query or category provided", async () => {
    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Either a search query");
  });

  it("returns 500 on Qdrant failure", async () => {
    mockSearchNorms.mockRejectedValue(new Error("Qdrant connection refused"));

    const { GET } = await import("../search/route");
    const req = makeRequest("/api/search?q=test");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("SEARCH_FAILED");
    expect(body.error.message).toContain(
      "Search failed: Qdrant connection refused",
    );
  });
});
