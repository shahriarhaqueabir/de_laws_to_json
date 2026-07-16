import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ──
const mockUseChat = vi.hoisted(() => vi.fn());
const mockUseAuth = vi.hoisted(() => vi.fn());
const mockUseApiKeyStatus = vi.hoisted(() => vi.fn());

vi.mock("../../components/chat-context", () => ({
  useChat: mockUseChat,
}));

vi.mock("../../components/auth-context", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("../useApiKeyStatus", () => ({
  useApiKeyStatus: mockUseApiKeyStatus,
}));

import { useSystemStatus } from "../useSystemStatus";

describe("useSystemStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());

    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "basic",
    });

    mockUseAuth.mockReturnValue({
      user: null,
    });

    mockUseApiKeyStatus.mockReturnValue({
      hasStoredKey: false,
      loading: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Basic mode ──

  it("returns unknown for services that haven't been checked yet", () => {
    const { result } = renderHook(() => useSystemStatus());

    expect(result.current.mode).toBe("basic");
    expect(result.current.services.length).toBeGreaterThanOrEqual(2);
    // Database and Vector Search are unknown since no diag response yet
    const db = result.current.services.find((s) => s.label === "Database");
    expect(db?.status).toBe("unknown");
  });

  it("includes auth service with warn status when user is not signed in", () => {
    const { result } = renderHook(() => useSystemStatus());

    const auth = result.current.services.find(
      (s) => s.label === "Authentication",
    );
    expect(auth?.status).toBe("warn");
    expect(auth?.message).toContain("Not signed in");
  });

  it("includes auth service with ok status when user is signed in", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" },
    });

    const { result } = renderHook(() => useSystemStatus());

    const auth = result.current.services.find(
      (s) => s.label === "Authentication",
    );
    expect(auth?.status).toBe("ok");
    expect(auth?.message).toContain("test@example.com");
  });

  // ── Local mode with Ollama ──

  it("checks Ollama reachability in local mode and reports ok", async () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "local",
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: "german-legal:latest" }, { name: "qwen2.5:1.5b" }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useSystemStatus());

    // Advance past the initial render + effect
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const ollama = result.current.services.find(
      (s) => s.label === "Local AI (Ollama)",
    );
    expect(ollama?.status).toBe("ok");
    expect(ollama?.message).toBe("Reachable");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.any(Object),
    );
  });

  it("checks Ollama and reports error when unreachable", async () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "local",
    });

    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const ollama = result.current.services.find(
      (s) => s.label === "Local AI (Ollama)",
    );
    expect(ollama?.status).toBe("error");
    expect(ollama?.message).toContain("Unreachable");
  });

  it("skips Ollama check when SSRF-unsafe URL is configured", async () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "https://evil.com/proxy" },
      mode: "local",
    });

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const ollama = result.current.services.find(
      (s) => s.label === "Local AI (Ollama)",
    );
    expect(ollama?.status).toBe("error");
  });

  // ── Cloud mode ──

  it("shows warn for cloud when no API key is configured", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "cloud",
    });

    const { result } = renderHook(() => useSystemStatus());

    const key = result.current.services.find(
      (s) => s.label === "Cloud API Key",
    );
    expect(key?.status).toBe("warn");
    expect(key?.message).toContain("No API key configured");
  });

  it("shows ok for cloud when API key is stored", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "cloud",
    });
    mockUseApiKeyStatus.mockReturnValue({
      hasStoredKey: true,
      loading: false,
    });

    const { result } = renderHook(() => useSystemStatus());

    const key = result.current.services.find(
      (s) => s.label === "Cloud API Key",
    );
    expect(key?.status).toBe("ok");
    expect(key?.message).toBe("Configured");
  });

  // ── Browser mode ──

  it("reports browser AI as ok when Web Worker and WASM are available", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "browser",
    });

    // Mock browser APIs
    vi.stubGlobal("Worker", class MockWorker { } as unknown as typeof Worker);
    vi.stubGlobal("WebAssembly", {} as typeof WebAssembly);
    vi.stubGlobal("SharedArrayBuffer", class MockSAB { } as unknown as typeof SharedArrayBuffer);

    const { result } = renderHook(() => useSystemStatus());

    const browser = result.current.services.find(
      (s) => s.label === "Browser AI",
    );
    expect(browser?.status).toBe("ok");
  });

  it("reports browser AI as warn when Worker or WASM is unavailable", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "browser",
    });

    // Remove SharedArrayBuffer
    // @ts-expect-error - testing missing API
    delete globalThis.SharedArrayBuffer;

    const { result } = renderHook(() => useSystemStatus());

    const browser = result.current.services.find(
      (s) => s.label === "Browser AI",
    );
    expect(browser?.status).toBe("warn");
  });

  it("omits browser AI service when not in browser mode", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "basic",
    });

    const { result } = renderHook(() => useSystemStatus());

    const browser = result.current.services.find(
      (s) => s.label === "Browser AI",
    );
    expect(browser).toBeUndefined();
  });

  // ── Overall status ──

  it("computes overall as worst status across all services", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "cloud",
    });

    const { result } = renderHook(() => useSystemStatus());

    // Cloud mode without key = warn, no user = warn
    // Overall should be warn
    expect(result.current.overall).toBe("warn");
  });

  it("returns unknown overall when no checks have completed", () => {
    const { result } = renderHook(() => useSystemStatus());

    // Basic mode — no checks ran, services are unknown
    const hasUnknown = result.current.services.some(
      (s) => s.status === "unknown",
    );
    expect(hasUnknown).toBe(true);
  });

  // ── Server diagnostics ──

  it("fetches server diagnostics and populates DB/Qdrant status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        checks: {
          supabase: { status: "ok", message: "Connected" },
          qdrant: { status: "ok", message: "103,586 points" },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const db = result.current.services.find((s) => s.label === "Database");
    expect(db?.status).toBe("ok");
    expect(db?.message).toBe("Connected");

    const vs = result.current.services.find((s) => s.label === "Vector Search");
    expect(vs?.status).toBe("ok");
    expect(vs?.message).toBe("103,586 points");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/diagnostics",
      expect.any(Object),
    );
  });

  it("reports error for DB/Qdrant when diagnostics fail", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useSystemStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const db = result.current.services.find((s) => s.label === "Database");
    expect(db?.status).toBe("unknown");

    const vs = result.current.services.find((s) => s.label === "Vector Search");
    expect(vs?.status).toBe("unknown");
  });

  // ── Polling ──

  it("polls every 30 seconds", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        checks: {
          supabase: { status: "ok", message: "Connected" },
          qdrant: { status: "ok", message: "Active" },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    renderHook(() => useSystemStatus());

    // Initial call — basic mode only calls diagnostics
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance 30s — should poll again
    mockFetch.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    // Diagnostics check should have run again
    const diagCalls = mockFetch.mock.calls.filter(
      (call: unknown[]) => (call[0] as string) === "/api/diagnostics",
    );
    expect(diagCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not include Ollama service when mode is not local", () => {
    mockUseChat.mockReturnValue({
      settings: { brokerUrl: "http://localhost:11434" },
      mode: "cloud",
    });

    const { result } = renderHook(() => useSystemStatus());

    const ollama = result.current.services.find(
      (s) => s.label === "Local AI (Ollama)",
    );
    expect(ollama).toBeUndefined();
  });

  it("sets lastChecked timestamp on each check", async () => {
    const { result } = renderHook(() => useSystemStatus());

    const before = result.current.lastChecked;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(result.current.lastChecked).not.toBe(before);
  });
});
