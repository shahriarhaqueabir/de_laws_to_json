import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBrowserAI } from "../useBrowserAI";

// Provides access to the latest MockWorkerInstance created by MockWorker.
let latestWorker: MockWorker;

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();

  constructor() {
    latestWorker = this;
  }
}

describe("useBrowserAI", () => {
  beforeEach(() => {
    latestWorker = undefined as unknown as MockWorker;
    vi.stubGlobal("Worker", MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a worker on mount", () => {
    const { result } = renderHook(() => useBrowserAI());
    expect(result.current.isReady).toBe(false);
    expect(latestWorker).toBeDefined();
    // Should send init signal
    expect(latestWorker.postMessage).toHaveBeenCalledWith({
      prompt: "INIT_ONLY",
      id: "init",
    });
  });

  it("does not create a worker when disabled", () => {
    renderHook(() => useBrowserAI(false));
    expect(latestWorker).toBeUndefined();
  });

  it("sets isReady when worker sends ready status", async () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      latestWorker.onmessage?.({ data: { status: "ready" } } as MessageEvent);
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.status).toBe("AI model ready");
  });

  it("sets isGenerating during generation", async () => {
    const { result } = renderHook(() => useBrowserAI());

    // Ready the worker
    act(() => {
      latestWorker.onmessage?.({ data: { status: "ready" } } as MessageEvent);
    });

    // Reset mock to track only the generate call
    latestWorker.postMessage.mockClear();

    expect(result.current.isGenerating).toBe(false);

    let promise: Promise<string>;
    act(() => {
      promise = result.current.generate("test prompt");
    });

    expect(result.current.isGenerating).toBe(true);
    expect(latestWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "test prompt" }),
    );
  });

  it("returns generated text on completion via promise", async () => {
    const { result } = renderHook(() => useBrowserAI());

    // Ready the worker
    act(() => {
      latestWorker.onmessage?.({ data: { status: "ready" } } as MessageEvent);
    });

    latestWorker.postMessage.mockClear();

    let promise: Promise<string>;
    act(() => {
      promise = result.current.generate("test");
    });

    act(() => {
      latestWorker.onmessage?.({
        data: { status: "complete", output: "response text" },
      } as MessageEvent);
    });

    const output = await promise!;
    expect(output).toBe("response text");
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.response).toBe("response text");
  });

  it("sets error on worker error", async () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      latestWorker.onmessage?.({
        data: { status: "error", error: "Model load failed" },
      } as MessageEvent);
    });

    expect(result.current.error).toBe("Model load failed");
    expect(result.current.isGenerating).toBe(false);
  });

  it("rejects promise on worker error", async () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      latestWorker.onmessage?.({ data: { status: "ready" } } as MessageEvent);
    });

    latestWorker.postMessage.mockClear();

    let promise: Promise<string>;
    act(() => {
      promise = result.current.generate("test");
    });

    act(() => {
      latestWorker.onmessage?.({
        data: { status: "error", error: "Model load failed" },
      } as MessageEvent);
    });

    await expect(promise!).rejects.toThrow("Model load failed");
    expect(result.current.isGenerating).toBe(false);
  });

  it("terminates worker on unmount", async () => {
    const { unmount, result } = renderHook(() => useBrowserAI());

    // Start a generation so there's a pending promise. Catch the
    // rejection that will fire on unmount cleanup.
    const genPromise = result.current.generate("test").catch(() => {});

    unmount();
    await genPromise;

    expect(latestWorker.terminate).toHaveBeenCalledOnce();
  });

  it("returns fallback message when worker is null", async () => {
    const { result } = renderHook(() => useBrowserAI(false));

    const output = await result.current.generate("test");
    expect(output).toBe("Browser AI worker not available.");
  });

  it("tracks download progress", () => {
    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      latestWorker.onmessage?.({
        data: {
          status: "download",
          loaded: 256,
          total: 1024,
        },
      } as MessageEvent);
    });

    expect(result.current.progress).toBeGreaterThan(0);
    expect(result.current.status).toContain("25%");
  });
});
