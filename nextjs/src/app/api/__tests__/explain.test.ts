/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGenerateNormExplanation = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/lib/chat", () => ({
  generateNormExplanation: mockGenerateNormExplanation,
}));

vi.mock("@/lib/encryption", () => ({
  decryptApiKey: vi.fn().mockResolvedValue("mock-decrypted-key"),
  encryptApiKey: vi.fn(),
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
  user: null as Record<string, unknown> | null,
  keyRow: null as Record<string, unknown> | null,
}));

vi.mock("@supabase/ssr", () => {
  const buildThenable = (result: any) => {
    const thenable = Promise.resolve(result);
    return Object.assign(thenable, {
      from: vi.fn((table: string) => {
        if (table === "user_api_keys") {
          const keyThenable = Promise.resolve({
            data: mockSupabaseResult.keyRow,
            error: null,
          });
          return Object.assign(keyThenable, {
            select: vi.fn(() => keyThenable),
            eq: vi.fn(() => keyThenable),
            order: vi.fn(() => keyThenable),
            range: vi.fn(() => keyThenable),
            limit: vi.fn(() => keyThenable),
            single: vi.fn(() => keyThenable),
            insert: vi.fn(() => keyThenable),
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: mockSupabaseResult.keyRow,
                error: null,
              }),
            ),
          });
        }
        return thenable;
      }),
      select: vi.fn(() => thenable),
      eq: vi.fn(() => thenable),
      order: vi.fn(() => thenable),
      range: vi.fn(() => thenable),
      limit: vi.fn(() => thenable),
      single: vi.fn(() => thenable),
      insert: vi.fn(() => thenable),
      auth: {
        getUser: vi
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ data: { user: mockSupabaseResult.user } }),
          ),
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
  mockGenerateNormExplanation.mockReset();
  mockFetch.mockReset();
  mockSupabaseResult.data = null;
  mockSupabaseResult.error = null;
  mockSupabaseResult.count = 0;
  mockSupabaseResult.user = null;
  mockSupabaseResult.keyRow = null;
});

describe("POST /api/explain", () => {
  it("Supabase cache hit returns cached explanation without AI call", async () => {
    mockSupabaseResult.data = {
      norm_id: "BGB-§ 433",
      translation: "Cached translation",
      summary: "Cached summary",
      implications: "Cached implications",
      next_steps: "Cached next steps",
    };

    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      normId: "§ 433",
      lawKey: "BGB",
      content: "Der Verkäufer einer Sache...",
      lang: "en",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.translation).toBe("Cached translation");
    expect(body.summary).toBe("");
    // AI should not be called for cache hit
    expect(mockGenerateNormExplanation).not.toHaveBeenCalled();
  });

  it("cloud mode generates explanation via generateNormExplanation", async () => {
    mockSupabaseResult.user = { id: "test-user-id" };
    mockSupabaseResult.keyRow = {
      provider: "openai",
      encrypted_key: "test-encrypted-key",
    };

    mockGenerateNormExplanation.mockResolvedValue({
      norm_id: "§ 433",
      law_key: "BGB",
      law_title: "",
      lang: "en",
      translation: "The seller of an item...",
      summary: "Defines a sales contract.",
      implications: "You have rights.",
      next_steps: "Contact a lawyer.",
      disclaimer: "",
    });

    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      normId: "§ 433",
      lawKey: "BGB",
      content: "Der Verkäufer einer Sache...",
      lang: "en",
      lawTitle: "Bürgerliches Gesetzbuch",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.translation).toBe("The seller of an item...");
    expect(body.summary).toBe("Defines a sales contract.");
    expect(body.law_title).toBe("Bürgerliches Gesetzbuch");
    expect(mockGenerateNormExplanation).toHaveBeenCalledWith(
      expect.objectContaining({
        normId: "§ 433",
        lawKey: "BGB",
      }),
    );
  });

  it("local mode calls Ollama and parses response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            translation: "Ollama translation",
          }),
        },
        done: true,
      }),
    });

    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      normId: "§ 433",
      lawKey: "BGB",
      content: "Der Verkäufer einer Sache...",
      lang: "en",
      mode: "local",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.translation).toBe("Ollama translation");
    expect(body.summary).toBe("");
    expect(body.implications).toBe("");
    expect(body.next_steps).toBe("");
  });

  it("local mode handles Ollama error gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Ollama unreachable"));

    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      normId: "§ 433",
      lawKey: "BGB",
      content: "Content",
      lang: "en",
      mode: "local",
    });
    const res = await POST(req);
    const body = await res.json();

    // Graceful fallback: returns 200 with empty translation and error in summary
    expect(res.status).toBe(200);
    expect(body.translation).toBe("");
    expect(body.summary).toContain("unavailable");
  });

  it("missing required field returns 422", async () => {
    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      // Missing normId
      lawKey: "BGB",
      content: "Content",
      lang: "en",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Supabase insert failure is non-fatal (returns explanation anyway)", async () => {
    mockSupabaseResult.user = { id: "test-user-id" };
    mockSupabaseResult.keyRow = {
      provider: "openai",
      encrypted_key: "test-encrypted-key",
    };

    mockGenerateNormExplanation.mockResolvedValue({
      norm_id: "§ 433",
      law_key: "BGB",
      law_title: "",
      lang: "en",
      translation: "Shown despite DB error",
      summary: "Summary",
      implications: "Implications",
      next_steps: "Next steps",
      disclaimer: "",
    });

    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      normId: "§ 433",
      lawKey: "BGB",
      content: "Der Verkäufer einer Sache...",
      lang: "en",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.translation).toBe("Shown despite DB error");
  });

  it("returns fallback response when no API key is available (no user signed in)", async () => {
    // Setup: user is null (no auth), so no API key is resolved
    mockSupabaseResult.data = null; // No cached explanation either

    const { POST } = await import("../explain/route");
    const req = makePostRequest("/api/explain", {
      normId: "§ 433",
      lawKey: "BGB",
      content: "Der Verkäufer einer Sache...",
      lang: "en",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Should return a fallback response without calling AI
    expect(body.norm_id).toBe("§ 433");
    expect(body.law_key).toBe("BGB");
    expect(body.summary).toContain(
      "Sign in and configure an AI provider in Settings",
    );
    expect(body.implications).toContain("Configure an API key in Settings");
    expect(mockGenerateNormExplanation).not.toHaveBeenCalled();
  });
});
