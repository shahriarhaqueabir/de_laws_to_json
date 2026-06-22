/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

const mockPipeline = vi.fn();
const mockTranslator = vi.fn();
const { progressCallbackRef } = vi.hoisted(() => ({
  progressCallbackRef: {
    current: null as ((x: Record<string, unknown>) => void) | null,
  },
}));

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(
    (_task: string, _model: string, options: Record<string, unknown>) => {
      progressCallbackRef.current =
        (options.progress_callback as (x: Record<string, unknown>) => void) ??
        null;
      return mockTranslator;
    },
  ),
  env: { allowLocalModels: false },
}));

describe("translate.worker", () => {
  const postMessage = vi.fn();
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  beforeAll(async () => {
    vi.stubGlobal("self", {
      postMessage,
      addEventListener: vi.fn(
        (_type: string, handler: (event: MessageEvent) => void) => {
          messageHandler = handler;
        },
      ),
    });

    await import("../translate.worker");
  });

  beforeEach(() => {
    postMessage.mockClear();
    mockTranslator.mockClear();
    progressCallbackRef.current = null;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("posts progress messages during model download", async () => {
    mockTranslator.mockReturnValue(
      Promise.resolve({ translation_text: "Hello" }),
    );

    const promise = messageHandler!({
      data: { id: "1", text: "Hallo" },
    } as any);

    // The progress callback is captured during pipeline() call inside getInstance
    // It fires during model download before translation runs
    expect(progressCallbackRef.current).toBeDefined();

    // Simulate progress via the captured callback
    progressCallbackRef.current!({
      status: "download",
      progress: 0.5,
      file: "model.onnx",
    });

    // The spread of x overwrites the explicit status:'progress' → status becomes 'download'
    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "1",
        progress: 0.5,
      }),
    );
    // First call status should be 'download' because ...x spreads over status:'progress'
    expect(postMessage.mock.calls[0][0].status).toBe("download");

    await promise;

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "1",
        output: "Hello",
      }),
    );
  });

  it("posts 'complete' message with translated output", async () => {
    mockTranslator.mockResolvedValue({ translation_text: "Good morning" });

    await messageHandler!({ data: { id: "2", text: "Guten Morgen" } } as any);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "2",
        output: "Good morning",
      }),
    );
  });

  it("posts 'error' message on failure", async () => {
    mockTranslator.mockRejectedValue(new Error("Model load failed"));

    await messageHandler!({ data: { id: "3", text: "Hallo" } } as any);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        id: "3",
        error: "Model load failed",
      }),
    );
  });

  it("handles array output format", async () => {
    mockTranslator.mockResolvedValue([{ translation_text: "Hello" }]);

    await messageHandler!({ data: { id: "4", text: "Hallo" } } as any);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "4",
        output: "Hello",
      }),
    );
  });
});
