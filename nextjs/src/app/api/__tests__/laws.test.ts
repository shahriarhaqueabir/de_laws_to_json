import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseResult = vi.hoisted(() => ({
  data: null as any,
  error: null as any,
  count: 0,
}));

vi.mock("@supabase/ssr", () => {
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
  return { createServerClient: vi.fn(() => buildThenable(mockSupabaseResult)) };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  mockSupabaseResult.data = null;
  mockSupabaseResult.error = null;
  mockSupabaseResult.count = 0;
});

describe("GET /api/laws", () => {
  it("lists all laws without category filter", async () => {
    mockSupabaseResult.data = [
      { key: "BGB", title: "Bürgerliches Gesetzbuch", category: "civil", authority: "BMJ" },
      { key: "StGB", title: "Strafgesetzbuch", category: "criminal", authority: "BMJ" },
    ];
    mockSupabaseResult.count = 2;

    const { GET } = await import("../laws/route");
    const req = makeRequest("/api/laws");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("filters laws by category", async () => {
    mockSupabaseResult.data = [
      { key: "StGB", title: "Strafgesetzbuch", category: "criminal" },
    ];
    mockSupabaseResult.count = 1;

    const { GET } = await import("../laws/route");
    const req = makeRequest("/api/laws?category=criminal");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].key).toBe("StGB");
  });

  it("returns pagination with total count", async () => {
    mockSupabaseResult.data = [{ key: "BGB", title: "BGB" }];
    mockSupabaseResult.count = 100;

    const { GET } = await import("../laws/route");
    const req = makeRequest("/api/laws?page=1");
    const res = await GET(req);
    const body = await res.json();

    expect(body.total).toBe(100);
    expect(body.results).toHaveLength(1);
  });

  it("returns 500 on Supabase error", async () => {
    mockSupabaseResult.data = null;
    mockSupabaseResult.error = { message: "Database connection failed" };

    const { GET } = await import("../laws/route");
    const req = makeRequest("/api/laws");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Database connection failed");
  });

  it("handles page parameter for custom offset", async () => {
    mockSupabaseResult.data = [];
    mockSupabaseResult.count = 0;

    const { GET } = await import("../laws/route");
    const req = makeRequest("/api/laws?page=2");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.results).toEqual([]);
  });
});
