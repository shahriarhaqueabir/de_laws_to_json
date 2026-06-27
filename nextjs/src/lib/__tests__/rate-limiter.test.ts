import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock supabase-admin before importing
vi.mock("../supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  checkRateLimit,
  cleanupRateLimits,
  getClientIp,
  DEFAULT_AI_RATE_LIMIT,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../rate-limiter";
import { createAdminClient } from "../supabase-admin";

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

beforeEach(() => {
  vi.clearAllMocks();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RateLimitConfig", () => {
  it("DEFAULT_AI_RATE_LIMIT has 10 requests per 60s", () => {
    expect(DEFAULT_AI_RATE_LIMIT.maxRequests).toBe(10);
    expect(DEFAULT_AI_RATE_LIMIT.windowMs).toBe(60_000);
  });

  it("DEFAULT_SEARCH_RATE_LIMIT has 60 requests per 60s", () => {
    expect(DEFAULT_SEARCH_RATE_LIMIT.maxRequests).toBe(60);
    expect(DEFAULT_SEARCH_RATE_LIMIT.windowMs).toBe(60_000);
  });
});

describe("getClientIp", () => {
  it("returns IP from x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    expect(getClientIp(request)).toBe("10.0.0.1");
  });

  it("returns IP from x-real-ip when no forwarded header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.5" },
    });
    expect(getClientIp(request)).toBe("10.0.0.5");
  });

  it("returns 127.0.0.1 when no IP headers present", () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("127.0.0.1");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "x-real-ip": "10.0.0.1",
      },
    });
    expect(getClientIp(request)).toBe("192.168.1.1");
  });

  it("trims whitespace from IP", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "  10.0.0.1  " },
    });
    expect(getClientIp(request)).toBe("10.0.0.1");
  });
});

describe("checkRateLimit", () => {
  it("returns allowed when Supabase RPC succeeds within limit", async () => {
    const now = Math.ceil(Date.now() / 1000);
    mockRpc.mockResolvedValue({
      data: { allowed: true, remaining: 9, reset_at: now + 60 },
      error: null,
    });

    const result = await checkRateLimit("10.0.0.1");

    expect(result.allowed).toBe(true);
    expect(result.headers["X-RateLimit-Limit"]).toBe("10");
    expect(result.headers["X-RateLimit-Remaining"]).toBe("9");
    expect(result.headers["X-RateLimit-Reset"]).toBe(String(now + 60));
    expect(result.headers["Retry-After"]).toBeUndefined();
  });

  it("returns not allowed when rate limit exceeded via Supabase", async () => {
    const now = Math.ceil(Date.now() / 1000);
    mockRpc.mockResolvedValue({
      data: { allowed: false, remaining: 0, reset_at: now + 30 },
      error: null,
    });

    const result = await checkRateLimit("10.0.0.2");

    expect(result.allowed).toBe(false);
    expect(result.headers["X-RateLimit-Remaining"]).toBe("0");
    expect(result.headers["Retry-After"]).toBeDefined();
  });

  it("falls back to in-memory when Supabase RPC errors", async () => {
    mockRpc.mockRejectedValue(new Error("Supabase unavailable"));

    const result = await checkRateLimit("10.0.0.3");

    expect(result.allowed).toBe(true);
    expect(result.headers["X-RateLimit-Limit"]).toBe("10");
    expect(result.headers["X-RateLimit-Remaining"]).toBe("9");
  });

  it("in-memory fallback blocks after exceeding limit", async () => {
    mockRpc.mockRejectedValue(new Error("Supabase unavailable"));

    // Make 11 requests (max is 10 for DEFAULT_AI_RATE_LIMIT)
    const results = await Promise.all(
      Array.from({ length: 11 }, () => checkRateLimit("10.0.0.4")),
    );

    // First 10 should be allowed
    for (let i = 0; i < 10; i++) {
      expect(results[i].allowed).toBe(true);
    }
    // 11th should be blocked
    expect(results[10].allowed).toBe(false);
    expect(results[10].headers["Retry-After"]).toBeDefined();
  });

  it("different IPs have independent in-memory limits", async () => {
    mockRpc.mockRejectedValue(new Error("Supabase unavailable"));

    // Exhaust limit on IP A
    await Promise.all(
      Array.from({ length: 10 }, () => checkRateLimit("10.0.0.5")),
    );

    const blocked = await checkRateLimit("10.0.0.5");
    expect(blocked.allowed).toBe(false);

    // Different IP should still be allowed
    const result = await checkRateLimit("10.0.0.6");
    expect(result.allowed).toBe(true);
  });

  it("uses custom config when provided", async () => {
    mockRpc.mockRejectedValue(new Error("Supabase unavailable"));

    const customConfig = { maxRequests: 3, windowMs: 10_000 };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => checkRateLimit("10.0.0.7", customConfig)),
    );

    expect(results[0].allowed).toBe(true);
    expect(results[1].allowed).toBe(true);
    expect(results[2].allowed).toBe(true);
    expect(results[3].allowed).toBe(false);
  });

  it("passes correct arguments to Supabase RPC", async () => {
    mockRpc.mockResolvedValue({
      data: {
        allowed: true,
        remaining: 9,
        reset_at: Math.ceil(Date.now() / 1000) + 60,
      },
      error: null,
    });

    await checkRateLimit("10.0.0.8", DEFAULT_SEARCH_RATE_LIMIT);

    expect(mockRpc).toHaveBeenCalledWith("check_rate_limit", {
      p_ip_hash: expect.any(String),
      p_endpoint: "api",
      p_max_requests: 60,
      p_window_ms: 60_000,
    });

    // Verify the hash is a 16-char hex string
    const hashArg = mockRpc.mock.calls[0][1].p_ip_hash;
    expect(hashArg).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns Retry-After header when rate limited via Supabase", async () => {
    const futureReset = Math.ceil(Date.now() / 1000) + 120;
    mockRpc.mockResolvedValue({
      data: { allowed: false, remaining: 0, reset_at: futureReset },
      error: null,
    });

    const result = await checkRateLimit("10.0.0.9");

    expect(result.allowed).toBe(false);
    expect(result.headers["Retry-After"]).toBeDefined();
    const retryAfter = Number(result.headers["Retry-After"]);
    expect(retryAfter).toBeGreaterThan(0);
  });
});

describe("cleanupRateLimits", () => {
  it("returns count from Supabase RPC", async () => {
    mockRpc.mockResolvedValue({ data: 42, error: null });

    const count = await cleanupRateLimits();

    expect(count).toBe(42);
    expect(mockRpc).toHaveBeenCalledWith("cleanup_rate_limits", {
      window_minutes: 5,
    });
  });

  it("returns 0 when Supabase RPC errors", async () => {
    mockRpc.mockRejectedValue(new Error("DB error"));

    const count = await cleanupRateLimits();

    expect(count).toBe(0);
  });

  it("returns 0 when RPC returns null data", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const count = await cleanupRateLimits();

    expect(count).toBe(0);
  });
});

describe("checkRateLimit probabilistic cleanup", () => {
  it("triggers cleanupRPC with ~5% probability", async () => {
    // Mock Math.random to return 0.01 (below 0.05 threshold)
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.01);
    mockRpc.mockResolvedValue({
      data: {
        allowed: true,
        remaining: 9,
        reset_at: Math.ceil(Date.now() / 1000) + 60,
      },
      error: null,
    });

    await checkRateLimit("10.0.0.10");

    // cleanup_rate_limits should have been called (probabilistic trigger)
    expect(mockRpc).toHaveBeenCalledWith("cleanup_rate_limits", {
      window_minutes: 5,
    });

    randomSpy.mockRestore();
  });

  it("does not trigger cleanup when random is above threshold", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    mockRpc.mockResolvedValue({
      data: {
        allowed: true,
        remaining: 9,
        reset_at: Math.ceil(Date.now() / 1000) + 60,
      },
      error: null,
    });

    await checkRateLimit("10.0.0.11");

    // Should only have the check_rate_limit call, not cleanup_rate_limits
    expect(mockRpc).toHaveBeenCalledTimes(1);

    randomSpy.mockRestore();
  });
});
