import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockTranslateText = vi.fn();

vi.mock("../../lib/translate", () => ({
  translateText: (...args: unknown[]) => mockTranslateText(...args),
}));

import { useTranslation } from "../useTranslation";

beforeEach(() => {
  mockTranslateText.mockClear();
});

describe("useTranslation", () => {
  it("returns translate, translating, progress", () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.translate).toBeInstanceOf(Function);
    expect(result.current.translating).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("translate(text) returns translated string", async () => {
    mockTranslateText.mockResolvedValue("Hello");
    const { result } = renderHook(() => useTranslation());

    let output: string | undefined;
    await act(async () => {
      output = await result.current.translate("Hallo");
    });

    expect(output).toBe("Hello");
    expect(mockTranslateText).toHaveBeenCalledWith(
      "Hallo",
      expect.any(Function),
    );
  });

  it("caches results (second call with same text returns from cache)", async () => {
    mockTranslateText.mockResolvedValue("Hello");
    const { result } = renderHook(() => useTranslation());

    await act(async () => {
      await result.current.translate("Hallo");
    });

    mockTranslateText.mockClear();

    await act(async () => {
      const output = await result.current.translate("Hallo");
      expect(output).toBe("Hello");
    });

    // translateText should NOT be called again (cached)
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it("translating state is true during translation, false after", async () => {
    let resolvePromise: (v: string) => void;
    mockTranslateText.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve;
        }),
    );

    const { result } = renderHook(() => useTranslation());

    // Start translation
    let promise: Promise<string | undefined>;
    act(() => {
      promise = result.current.translate("Hallo");
    });

    // Should be translating
    expect(result.current.translating).toBe(true);
    expect(result.current.progress).toBe(0);

    // Resolve the translation
    await act(async () => {
      resolvePromise!("Hello");
      await promise;
    });

    // Should no longer be translating
    expect(result.current.translating).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("progress updates during translation", async () => {
    let resolvePromise: (v: string) => void;
    let progressCallbackRef: ((p: { progress: number }) => void) | undefined;

    mockTranslateText.mockImplementation(
      (_text: string, onProgress?: (p: { progress: number }) => void) => {
        progressCallbackRef = onProgress;
        return new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });
      },
    );

    const { result } = renderHook(() => useTranslation());

    let promise: Promise<string | undefined>;
    act(() => {
      promise = result.current.translate("Hallo");
    });

    // Simulate progress updates via the callback
    act(() => {
      progressCallbackRef!({ progress: 0.5 });
    });

    expect(result.current.progress).toBe(0.5);

    act(() => {
      progressCallbackRef!({ progress: 0.8 });
    });

    expect(result.current.progress).toBe(0.8);

    // Complete
    await act(async () => {
      resolvePromise!("Hello");
      await promise;
    });

    // Progress should reset to 0
    expect(result.current.progress).toBe(0);
  });

  it("handles translation error and resets state", async () => {
    mockTranslateText.mockRejectedValue(new Error("Translation failed"));
    const { result } = renderHook(() => useTranslation());

    await act(async () => {
      try {
        await result.current.translate("Hallo");
      } catch {
        // Expected
      }
    });

    expect(result.current.translating).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("different texts both resolve correctly", async () => {
    mockTranslateText
      .mockResolvedValueOnce("Hello")
      .mockResolvedValueOnce("Goodbye");

    const { result } = renderHook(() => useTranslation());

    await act(async () => {
      const r1 = await result.current.translate("Hallo");
      expect(r1).toBe("Hello");
    });

    await act(async () => {
      const r2 = await result.current.translate("Tschüss");
      expect(r2).toBe("Goodbye");
    });

    expect(mockTranslateText).toHaveBeenCalledTimes(2);
  });
});
