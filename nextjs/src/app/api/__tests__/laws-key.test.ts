import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseResult = vi.hoisted(() => ({
  data: null as any,
  error: null as any,
  count: 0,
}));

const mockScroll = vi.fn();

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

vi.mock("@/lib/qdrant", () => ({
  COLLECTION: "german_norms",
}));

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: vi.fn(function () {
    return { scroll: mockScroll };
  }),
}));

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  mockSupabaseResult.data = null;
  mockSupabaseResult.error = null;
  mockSupabaseResult.count = 0;
  mockScroll.mockReset();
});

describe("GET /api/laws/[key]", () => {
  it("valid key returns law metadata + norms from Qdrant scroll", async () => {
    mockSupabaseResult.data = {
      key: "BGB",
      title: "Bürgerliches Gesetzbuch",
      category: "civil",
    };

    mockScroll.mockResolvedValue({
      points: [
        {
          payload: {
            law_key: "BGB",
            norm_id: "§ 433",
            norm_title: "Kaufvertrag",
          },
        },
        {
          payload: {
            law_key: "BGB",
            norm_id: "§ 434",
            norm_title: "Sachmangel",
          },
        },
      ],
    });

    const { GET } = await import("../laws/[key]/route");
    const req = makeRequest("/api/laws/BGB");
    const res = await GET(req, { params: Promise.resolve({ key: "BGB" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.key).toBe("BGB");
    expect(body.title).toBe("Bürgerliches Gesetzbuch");
    expect(body.norms).toHaveLength(2);
    expect(body.norms[0].norm_id).toBe("§ 433");

    expect(mockScroll).toHaveBeenCalledWith("german_norms", {
      filter: { must: [{ key: "law_key", match: { value: "BGB" } }] },
      limit: 1000,
      with_payload: true,
    });
  });

  it("missing key returns 404", async () => {
    mockSupabaseResult.data = null;
    mockSupabaseResult.error = { message: "Not found" };

    const { GET } = await import("../laws/[key]/route");
    const req = makeRequest("/api/laws/NONEXISTENT");
    const res = await GET(req, {
      params: Promise.resolve({ key: "NONEXISTENT" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Law not found");
  });

  it("invalid (empty) key returns 400 validation", async () => {
    const { GET } = await import("../laws/[key]/route");
    const req = makeRequest("/api/laws/");
    const res = await GET(req, { params: Promise.resolve({ key: "" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid law key");
  });

  it("Qdrant scroll failure returns 502 with partial metadata", async () => {
    mockSupabaseResult.data = {
      key: "BGB",
      title: "Bürgerliches Gesetzbuch",
    };

    mockScroll.mockRejectedValue(new Error("Qdrant timeout"));

    const { GET } = await import("../laws/[key]/route");
    const req = makeRequest("/api/laws/BGB");
    const res = await GET(req, { params: Promise.resolve({ key: "BGB" }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Could not fetch norms from vector store");
    expect(body.law).toBeDefined();
    expect(body.law.key).toBe("BGB");
  });
});
