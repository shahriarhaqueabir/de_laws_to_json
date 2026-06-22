import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

let mockWorkerOnmessage:
  | ((event: { data: Record<string, unknown> }) => void)
  | null = null;
const mockPostMessage = vi.fn();

// Replace Worker on globalThis directly (more reliable than vi.stubGlobal in jsdom)
class MockWorker {
  postMessage = mockPostMessage;
  private _onmessage:
    | ((event: { data: Record<string, unknown> }) => void)
    | null = null;

  constructor(_url: string | URL, _options?: Record<string, unknown>) {
    // Constructor called
  }

  set onmessage(
    fn: ((event: { data: Record<string, unknown> }) => void) | null,
  ) {
    mockWorkerOnmessage = fn;
    this._onmessage = fn;
  }

  get onmessage() {
    return this._onmessage;
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, "Worker", {
    value: MockWorker,
    configurable: true,
    writable: true,
  });
});

beforeEach(() => {
  mockPostMessage.mockReset();
  mockWorkerOnmessage = null;
  // Reset modules so translate.ts re-initializes its worker singleton
  vi.resetModules();
  // Re-apply crypto spy since vi.resetModules may clear spies
  vi.spyOn(crypto, "randomUUID").mockReturnValue("test-id-456");
});

describe("translateText", () => {
  it("resolves with output string on 'complete' message", async () => {
    const { translateText } = await import("../translate");

    const resultPromise = translateText("Hello");

    // Simulate the worker completing
    mockWorkerOnmessage!({
      data: { status: "complete", id: "test-id-456", output: "Hallo" },
    });

    const result = await resultPromise;
    expect(result).toBe("Hallo");
  });

  it("rejects on 'error' message", async () => {
    const { translateText } = await import("../translate");

    const resultPromise = translateText("Hello");

    mockWorkerOnmessage!({
      data: { status: "error", id: "test-id-456", error: "Translation failed" },
    });

    await expect(resultPromise).rejects.toThrow("Translation failed");
  });

  it("passes progress_callback on 'progress' messages", async () => {
    const { translateText } = await import("../translate");

    const onProgress = vi.fn();
    const resultPromise = translateText("Hello", onProgress);

    // Send progress update
    mockWorkerOnmessage!({
      data: {
        status: "progress",
        id: "test-id-456",
        progress: 0.5,
        file: "model.bin",
      },
    });

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({
      status: "progress",
      progress: 0.5,
      file: "model.bin",
    });

    // Now complete
    mockWorkerOnmessage!({
      data: { status: "complete", id: "test-id-456", output: "Hallo" },
    });

    const result = await resultPromise;
    expect(result).toBe("Hallo");
  });

  it("sends correct message to the worker", async () => {
    const { translateText } = await import("../translate");

    translateText("Guten Morgen"); // don't await

    expect(mockPostMessage).toHaveBeenCalledWith({
      id: "test-id-456",
      text: "Guten Morgen",
    });
  });

  it("does not forward progress to onProgress when callback is omitted", async () => {
    const { translateText } = await import("../translate");

    const resultPromise = translateText("Hello");

    mockWorkerOnmessage!({
      data: {
        status: "progress",
        id: "test-id-456",
        progress: 0.8,
      },
    });

    // Should NOT throw — progress handler is omitted, so it's a no-op
    mockWorkerOnmessage!({
      data: { status: "complete", id: "test-id-456", output: "Hallo" },
    });

    await expect(resultPromise).resolves.toBe("Hallo");
  });
});
