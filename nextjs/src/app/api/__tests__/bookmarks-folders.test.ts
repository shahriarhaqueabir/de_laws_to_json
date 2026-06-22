import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks (MUST be before route import) ──────────────────────────────────

const mockUser = { id: "user-123", email: "test@example.com" };

// Simple mock that creates fresh query builders
interface MockResponse {
  data: unknown;
  error: null | { message: string };
}

function createMockChain(data: unknown) {
  const response: MockResponse = { data, error: null };
  return vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve(response)),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve(response)),
      })),
      single: vi.fn(() => Promise.resolve(response)),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve(response)),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(response)),
          })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  }));
}

const mockFolders = [
  {
    id: "folder-1",
    user_id: "user-123",
    name: "Wrongful Dismissal",
    description: "Labor case",
    category: "labor",
    incident_date: "2025-06-01",
    dispute_value: 15000,
    status: "pre_action",
    opposing_party: "Employer GmbH",
    deadline_date: "2025-06-21",
    court_name: "Arbeitsgericht Berlin",
    case_number: "5 Ca 1234/25",
    notes: "Important case",
    created_at: "2025-06-01T10:00:00Z",
    updated_at: "2025-06-01T10:00:00Z",
  },
];

const mockNewFolder = {
  id: "folder-new",
  user_id: "user-123",
  name: "New Folder",
  description: "",
  category: "other",
  incident_date: null,
  dispute_value: 0,
  status: "pre_action",
  opposing_party: "",
  deadline_date: null,
  court_name: "",
  case_number: "",
  notes: "",
  created_at: "2025-06-21T10:00:00Z",
  updated_at: "2025-06-21T10:00:00Z",
};

const mockSupabase = {
  auth: {
    getUser: vi
      .fn()
      .mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: createMockChain(mockFolders),
};

vi.mock("@/lib/supabase-server", () => ({
  getServerClient: vi.fn(() => mockSupabase),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

// Import after mocks are hoisted
const { GET, POST } = await import("@/app/api/bookmarks/folders/route");

// ── Tests ────────────────────────────────────────────────────────────────

describe("GET /api/bookmarks/folders", () => {
  beforeEach(() => {
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const req = new NextRequest("http://localhost/api/bookmarks/folders");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns list of folders for authenticated user", async () => {
    const req = new NextRequest("http://localhost/api/bookmarks/folders");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("Wrongful Dismissal");
  });
});

describe("POST /api/bookmarks/folders", () => {
  beforeEach(() => {
    // Override the from mock to return insert data
    mockSupabase.from = createMockChain(mockNewFolder);
    mockSupabase.auth.getUser.mockReset();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  });

  afterEach(() => {
    // Restore from mock to default
    mockSupabase.from = createMockChain(mockFolders);
  });

  it("creates a folder with valid data", async () => {
    const req = new NextRequest("http://localhost/api/bookmarks/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Folder",
        category: "labor",
        dispute_value: 5000,
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.name).toBe("New Folder");
  });

  it("returns 422 when name is missing", async () => {
    const req = new NextRequest("http://localhost/api/bookmarks/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "No name" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when dispute_value is negative", async () => {
    const req = new NextRequest("http://localhost/api/bookmarks/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Folder", dispute_value: -100 }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts all 8 folder properties", async () => {
    const req = new NextRequest("http://localhost/api/bookmarks/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Complete Case",
        description: "Test case",
        category: "traffic",
        incident_date: "2025-06-01",
        dispute_value: 500,
        status: "consulting",
        opposing_party: "Police Dept",
        deadline_date: "2025-07-01",
        court_name: "Amtsgericht Mitte",
        case_number: "123 OWi 45/25",
        notes: "Speeding ticket contest",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toBeDefined();
  });

  it("rejects invalid status value", async () => {
    const req = new NextRequest("http://localhost/api/bookmarks/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Status",
        status: "invalid_status",
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
