import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted mutable state used by the mock factory — survives vi.mock hoisting
const mockState = vi.hoisted(() => ({
  subscribe: vi.fn(() => vi.fn()),
  ensureReady: vi.fn(),
  generate: vi.fn(),
  isReady: false,
}));

vi.mock("../../lib/worker-manager", () => ({
  browserWorker: mockState,
}));

import { useBrowserAI } from "../useBrowserAI";

describe("useBrowserAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.subscribe.mockReturnValue(vi.fn());
    mockState.isReady = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to worker manager on mount", () => {
    renderHook(() => useBrowserAI());
    expect(mockState.ensureReady).toHaveBeenCalledOnce();
    expect(mockState.subscribe).toHaveBeenCalledOnce();
  });

  it("does not subscribe when disabled", () => {
    renderHook(() => useBrowserAI(false));
    expect(mockState.ensureReady).not.toHaveBeenCalled();
    expect(mockState.subscribe).not.toHaveBeenCalled();
  });

  it("sets isReady when worker sends ready status via subscriber callback", () => {
    let subscriber: ((event: { type: string }) => void) | null = null;
    mockState.subscribe.mockImplementation(
      (fn: (event: { type: string }) => void) => {
        subscriber = fn;
        return vi.fn();
      },
    );

    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      subscriber!({ type: "ready" });
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.status).toBe("AI model ready");
  });

  it("uses existing isReady if worker already ready", () => {
    mockState.isReady = true;

    const { result } = renderHook(() => useBrowserAI());

    expect(result.current.isReady).toBe(true);
  });

  it("sets isGenerating during generation", async () => {
    mockState.generate.mockResolvedValue("response text");

    const { result } = renderHook(() => useBrowserAI());

    let promise: Promise<string>;
    act(() => {
      promise = result.current.generate("test prompt");
    });

    expect(result.current.isGenerating).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.isGenerating).toBe(false);
  });

  it("returns generated text on completion", async () => {
    mockState.generate.mockResolvedValue("response text");

    const { result } = renderHook(() => useBrowserAI());

    let output: string;
    await act(async () => {
      output = await result.current.generate("test prompt");
    });

    expect(output!).toBe("response text");
    expect(result.current.response).toBe("response text");
    expect(mockState.generate).toHaveBeenCalledWith(
      "test prompt",
      undefined,
      undefined,
    );
  });

  it("sets error on worker error", async () => {
    mockState.generate.mockRejectedValue(new Error("Model load failed"));

    const { result } = renderHook(() => useBrowserAI());

    await act(async () => {
      const msg = await result.current.generate("test prompt");
      expect(msg).toBe("Model load failed");
    });

    expect(result.current.error).toBe("Model load failed");
    expect(result.current.isGenerating).toBe(false);
  });

  it("sets error when subscriber receives error event", () => {
    let subscriber: ((event: { type: string; message?: string }) => void) | null =
      null;
    mockState.subscribe.mockImplementation(
      (fn: (event: { type: string; message?: string }) => void) => {
        subscriber = fn;
        return vi.fn();
      },
    );

    const { result } = renderHook(() => useBrowserAI());

    act(() => {
      subscriber!({ type: "error", message: "Worker crashed" });
    });

    expect(result.current.error).toBe("Worker crashed");
  });

  it("unsubscribes on unmount", () => {
    const unsubscribe = vi.fn();
    mockState.subscribe.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useBrowserAI());
    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("resets state when disabled after being enabled", () => {
    const { rerender, result } = renderHook(
      (enabled: boolean) => useBrowserAI(enabled),
      { initialProps: true },
    );

    expect(mockState.subscribe).toHaveBeenCalledOnce();

    rerender(false);

    expect(result.current.isReady).toBe(false);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.status).toBeNull();
  });

  it("passes model and params to generate", async () => {
    mockState.generate.mockResolvedValue("output");

    const { result } = renderHook(() => useBrowserAI());

    await act(async () => {
      await result.current.generate("prompt", "custom-model", {
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
        top_k: 40,
      });
    });

    expect(mockState.generate).toHaveBeenCalledWith("prompt", "custom-model", {
      temperature: 0.7,
      max_tokens: 100,
      top_p: 0.9,
      top_k: 40,
    });
  });
});
