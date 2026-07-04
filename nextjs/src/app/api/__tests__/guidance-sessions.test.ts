/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock data ──────────────────────────────────────────────────────────────

const mockUser = { id: "user-123", email: "test@example.com" };

const mockSessions = [
  {
    id: "session-1",
    user_id: "user-123",
    situation: "I was in a car accident on the highway",
    language: "en",
    created_at: "2025-06-15T10:00:00Z",
    guidance_paths: [
      {
        id: "path-1",
        path_number: 1,
        title: "File an insurance claim",
        risk_level: "low",
        cost_estimate: 0,
      },
    ],
  },
  {
    id: "session-2",
    user_id: "user-123",
    situation: "My landlord refuses to fix the heating",
    language: "en",
    created_at: "2025-06-14T10:00:00Z",
    guidance_paths: [],
  },
];

const mockSessionDetail = {
  id: "session-1",
  user_id: "user-123",
  situation: "I was in a car accident on the highway",
  language: "en",
  created_at: "2025-06-15T10:00:00Z",
  updated_at: "2025-06-15T10:00:00Z",
};

const mockPaths = [
  {
    id: "path-1",
    case_file_id: "session-1",
    path_number: 1,
    title: "File an insurance claim",
    summary: "File a claim with the other driver's insurance",
    detailed_analysis: "Since the other driver was at fault...",
    risk_level: "low",
    cost_estimate: 0,
    laws_cited: [
      { law_key: "StVG", norm_id: "§ 7", law_title: "Straßenverkehrsgesetz" },
    ],
    recommended_actions: ["Gather evidence", "Contact insurance"],
    created_at: "2025-06-15T10:00:00Z",
  },
  {
    id: "path-2",
    case_file_id: "session-1",
    path_number: 2,
    title: "Pursue legal action",
    summary: "File a lawsuit if insurance denies the claim",
    detailed_analysis: "If the insurance company refuses...",
    risk_level: "medium",
    cost_estimate: 1500,
    laws_cited: [
      { law_key: "BGB", norm_id: "§ 823", law_title: "Bürgerliches Gesetzbuch" },
    ],
    recommended_actions: ["Consult a lawyer", "File a complaint"],
    created_at: "2025-06-15T10:00:00Z",
  },
];

// ── Mocks (MUST be before route imports) ──────────────────────────────────

const mockSupabase = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getServerClient: vi.fn(() => mockSupabase),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

// ── Chain builder helpers ──────────────────────────────────────────────────

function makeCountChain(count: number) {
  const eq = vi.fn().mockResolvedValue({ count, error: null });
  return { eq };
}

function makeListChain(sessions: any[]) {
  const range = vi.fn().mockResolvedValue({ data: sessions, error: null });
  const order = vi.fn().mockReturnValue({ range });
  const eq = vi.fn().mockReturnValue({ order });
  return { eq };
}

function makeSingleChain(session: any | null) {
  const result = session
    ? { data: session, error: null }
    : { data: null, error: { message: "Not found" } };
  const single = vi.fn().mockResolvedValue(result);
  const eq2 = vi.fn().mockReturnValue({ single });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  return { eq: eq1 };
}

function makePathsChain(paths: any[]) {
  const order = vi.fn().mockResolvedValue({ data: paths, error: null });
  const eq = vi.fn().mockReturnValue({ order });
  return { eq };
}

function makeDeleteChain(error: any = null) {
  const eq2 = vi.fn().mockResolvedValue({ data: null, error });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  return { eq: eq1 };
}

// ── Route imports ──────────────────────────────────────────────────────────

async function importRoutes() {
  const [listRoute, detailRoute] = await Promise.all([
    import("@/app/api/guidance/sessions/route"),
    import("@/app/api/guidance/sessions/[id]/route"),
  ]);
  return {
    GET_LIST: listRoute.GET,
    GET_DETAIL: detailRoute.GET,
    DELETE: detailRoute.DELETE,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/guidance/sessions (list)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "case_files") {
        return {
          select: vi.fn((fields: string, opts?: any) => {
            if (opts?.count === "exact" && opts?.head === true) {
              return makeCountChain(mockSessions.length);
            }
            return makeListChain(mockSessions);
          }),
        };
      }
      return {};
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { GET_LIST } = await importRoutes();
    const req = new NextRequest("http://localhost/api/guidance/sessions");
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns list of sessions with pagination metadata", async () => {
    const { GET_LIST } = await importRoutes();
    const req = new NextRequest("http://localhost/api/guidance/sessions");
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sessions).toHaveLength(2);
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it("returns empty arrays for zero sessions", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "case_files") {
        return {
          select: vi.fn((fields: string, opts?: any) => {
            if (opts?.count === "exact" && opts?.head === true) {
              return makeCountChain(0);
            }
            return makeListChain([]);
          }),
        };
      }
      return {};
    });

    const { GET_LIST } = await importRoutes();
    const req = new NextRequest("http://localhost/api/guidance/sessions");
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sessions).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);
    expect(body.data.pagination.totalPages).toBe(0);
  });

  it("respects page and limit query parameters", async () => {
    const { GET_LIST } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions?page=2&limit=10",
    );
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pagination.page).toBe(2);
    expect(body.data.pagination.limit).toBe(10);
  });

  it("clamps limit between 1 and 50", async () => {
    const { GET_LIST } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions?limit=999",
    );
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pagination.limit).toBe(50);
  });

  it("returns session with nested guidance_paths", async () => {
    const { GET_LIST } = await importRoutes();
    const req = new NextRequest("http://localhost/api/guidance/sessions");
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(body.data.sessions[0].guidance_paths).toBeDefined();
    expect(body.data.sessions[0].guidance_paths).toHaveLength(1);
    expect(body.data.sessions[0].guidance_paths[0].title).toBe(
      "File an insurance claim",
    );
  });

  it("returns 500 on database error", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error("Connection refused");
    });

    const { GET_LIST } = await importRoutes();
    const req = new NextRequest("http://localhost/api/guidance/sessions");
    const res = await GET_LIST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DB_ERROR");
  });
});

describe("GET /api/guidance/sessions/[id] (single)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  it("returns a single session with paths", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "case_files") {
        return { select: vi.fn(() => makeSingleChain(mockSessionDetail)) };
      }
      if (table === "guidance_paths") {
        return { select: vi.fn(() => makePathsChain(mockPaths)) };
      }
      return {};
    });

    const { GET_DETAIL } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/session-1",
    );
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.session.id).toBe("session-1");
    expect(body.data.session.situation).toContain("car accident");
    expect(body.data.paths).toHaveLength(2);
    expect(body.data.paths[0].path_number).toBe(1);
    expect(body.data.paths[1].path_number).toBe(2);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { GET_DETAIL } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/session-1",
    );
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when session is not found", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "case_files") {
        return { select: vi.fn(() => makeSingleChain(null)) };
      }
      return {};
    });

    const { GET_DETAIL } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/nonexistent",
    );
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on database error", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error("DB crash");
    });

    const { GET_DETAIL } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/session-1",
    );
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DB_ERROR");
  });
});

describe("DELETE /api/guidance/sessions/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "case_files") {
        return { delete: vi.fn(() => makeDeleteChain()) };
      }
      return {};
    });
  });

  it("deletes a session and returns success", async () => {
    const { DELETE } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/session-1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.deleted).toBe(true);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { DELETE } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/session-1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 500 on database error", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error("Delete failed");
    });

    const { DELETE } = await importRoutes();
    const req = new NextRequest(
      "http://localhost/api/guidance/sessions/session-1",
      { method: "DELETE" },
    );
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "session-1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("DB_ERROR");
  });
});
