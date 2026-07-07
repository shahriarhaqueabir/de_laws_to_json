/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSearchNorms = vi.fn();
const mockGenerateChatResponse = vi.fn();
const mockFetch = vi.fn();

// We must pass through the real z from zod for the route to parse properly
// and use vi.mock only for non-zod external modules

vi.mock("@/lib/qdrant", () => ({
  searchNorms: mockSearchNorms,
}));

vi.mock("@/lib/chat", () => ({
  generateChatResponse: mockGenerateChatResponse,
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

// Mock encryption to return/accept known values without needing SERVER_ENCRYPTION_KEY
vi.mock("@/lib/encryption", () => ({
  encryptApiKey: vi
    .fn()
    .mockResolvedValue(
      JSON.stringify({ iv: "test", ciphertext: "encrypted-sk-test-123" }),
    ),
  decryptApiKey: vi.fn().mockImplementation(async (payload: string) => {
    const parsed = JSON.parse(payload);
    if (parsed.ciphertext === "encrypted-sk-test-123") {
      return "sk-test-123";
    }
    throw new Error("Decryption failed");
  }),
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
      maybeSingle: vi.fn(() => thenable),
      insert: vi.fn().mockResolvedValue({ error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "test-user-123", email: "test@test.com" } },
        }),
      },
    });
  };
  return { createServerClient: vi.fn(() => buildThenable(mockSupabaseResult)) };
});

global.fetch = mockFetch;

function makePostRequest(
  url: string,
  body: Record<string, unknown>,
): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSearchNorms.mockReset();
  mockGenerateChatResponse.mockReset();
  mockFetch.mockReset();
  mockSupabaseResult.data = null;
  mockSupabaseResult.error = null;
  mockSupabaseResult.count = 0;

  mockSearchNorms.mockResolvedValue([
    {
      law_key: "BGB",
      law_title: "Bürgerliches Gesetzbuch",
      category: "civil",
      norm_id: "§ 433",
      norm_title: "Kaufvertrag",
      content: "Der Verkäufer einer Sache verpflichtet sich...",
      score: 0.95,
    },
  ]);
});

describe("POST /api/chat", () => {
  it("basic mode returns norm listing, no AI call", async () => {
    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "What is a sales contract?",
      mode: "basic",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.response).toContain("Relevant laws found");
    expect(body.response).toContain("BGB");
    expect(body.response).toContain("§ 433");
    expect(body.mode).toBe("basic");
    // No AI call in basic mode
    expect(mockGenerateChatResponse).not.toHaveBeenCalled();
  });

  it("browser mode returns norm listing", async () => {
    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "Test",
      mode: "browser",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.response).toContain("Relevant laws found");
    expect(body.mode).toBe("browser");
    expect(mockGenerateChatResponse).not.toHaveBeenCalled();
  });

  it("cloud mode with DB-stored API key calls generateChatResponse", async () => {
    // Simulate a stored encrypted key in the DB
    mockSupabaseResult.data = {
      encrypted_key: JSON.stringify({
        iv: "test",
        ciphertext: "encrypted-sk-test-123",
      }),
      provider: "openai",
    };

    mockGenerateChatResponse.mockResolvedValue(
      "The BGB § 433 defines the obligations of a seller...",
    );

    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "Explain BGB § 433",
      mode: "cloud",
      model: "gpt-4o-mini",
      // No apiKey or provider in body — fetched from DB
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.response).toContain("BGB § 433");
    expect(mockGenerateChatResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        apiKey: "sk-test-123",
        model: "gpt-4o-mini",
      }),
    );
  });

  it("cloud mode with missing API key returns helpful message", async () => {
    // No DB row — mockSupabaseResult.data is already null from beforeEach
    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "Explain BGB",
      mode: "cloud",
      // No apiKey provided
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.response).toContain("No API key configured");
    expect(body.response).toContain("Settings");
    // AI should NOT be called
    expect(mockGenerateChatResponse).not.toHaveBeenCalled();
  });

  it("local mode with broker online returns broker response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: "Broker says: BGB § 433 is about sales contracts.",
      }),
    });

    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "Explain sales contract",
      mode: "local",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.response).toBe(
      "Broker says: BGB § 433 is about sales contracts.",
    );
    expect(body.brokerAvailable).toBe(true);
  });

  it("local mode with broker offline returns graceful fallback", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "Explain sales contract",
      mode: "local",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.response).toContain("your local AI is offline");
    expect(body.response).toContain("ollama serve");
    expect(body.brokerAvailable).toBe(false);
  });

  it("empty message returns 422 validation", async () => {
    const { POST } = await import("../chat/route");
    const req = makePostRequest("/api/chat", {
      message: "",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
