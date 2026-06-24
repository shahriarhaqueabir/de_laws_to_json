/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";

const mockSearchNorms = vi.fn();

vi.mock("@/lib/qdrant", () => ({
  searchNorms: mockSearchNorms,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

const mockSupabaseResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
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

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockSearchNorms.mockReset();
  mockSupabaseResult.data = { count: 42 };
  mockSupabaseResult.error = null;
  mockSupabaseResult.count = 1;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.QDRANT_URL = "https://test.qdrant.io";
  process.env.QDRANT_API_KEY = "test-qdrant-key";
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/diagnostics", () => {
  it("both Supabase and Qdrant healthy returns 200", async () => {
    mockSearchNorms.mockResolvedValue([
      {
        law_key: "BGB",
        score: 0.5,
        law_title: "",
        category: "",
        norm_id: "",
        norm_title: "",
        content: "",
      },
    ]);

    const { GET } = await import("../diagnostics/route");
    const req = makeRequest("/api/diagnostics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checks.supabase.status).toBe("ok");
    expect(body.checks.qdrant.status).toBe("ok");
  });

  it("Supabase failure returns overall 500 with partial error", async () => {
    mockSupabaseResult.data = null;
    mockSupabaseResult.error = new Error("Supabase query failed");

    const { GET } = await import("../diagnostics/route");
    const req = makeRequest("/api/diagnostics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.checks.supabase.status).toBe("error");
    expect(body.checks.supabase.message).toBe("Supabase query failed");
  });

  it("Qdrant failure returns overall 500", async () => {
    mockSearchNorms.mockRejectedValue(new Error("Qdrant API key invalid"));

    const { GET } = await import("../diagnostics/route");
    const req = makeRequest("/api/diagnostics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.checks.qdrant.status).toBe("error");
    expect(body.checks.qdrant.message).toContain("Qdrant API key invalid");
  });

  it("both failing returns 500 with both errors", async () => {
    mockSupabaseResult.data = null;
    mockSupabaseResult.error = new Error("DB down");
    mockSearchNorms.mockRejectedValue(new Error("Qdrant down"));

    const { GET } = await import("../diagnostics/route");
    const req = makeRequest("/api/diagnostics");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.checks.supabase.status).toBe("error");
    expect(body.checks.qdrant.status).toBe("error");
  });

  it("env vars are masked as booleans", async () => {
    mockSearchNorms.mockResolvedValue([]);
    mockSupabaseResult.data = { count: 0 };

    const { GET } = await import("../diagnostics/route");
    const req = makeRequest("/api/diagnostics");
    const res = await GET(req);
    const body = await res.json();

    expect(body.env.NEXT_PUBLIC_SUPABASE_URL).toBe(true);
    expect(body.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(true);
    expect(body.env.QDRANT_URL).toBe(true);
    expect(body.env.QDRANT_API_KEY).toBe(true);
    // All env values should be booleans, not strings
    expect(typeof body.env.NEXT_PUBLIC_SUPABASE_URL).toBe("boolean");
    expect(typeof body.env.QDRANT_URL).toBe("boolean");
  });
});
