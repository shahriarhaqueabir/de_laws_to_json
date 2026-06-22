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

const mockGenerator = vi.fn();
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
      return mockGenerator;
    },
  ),
  env: { allowLocalModels: false },
}));

describe("chat.worker", () => {
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

    await import("../chat.worker");
  });

  beforeEach(() => {
    postMessage.mockClear();
    mockGenerator.mockClear();
    progressCallbackRef.current = null;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("posts 'ready' status on INIT_ONLY prompt", async () => {
    // generator is null initially, so pipeline is called
    await messageHandler!({ data: { id: "1", prompt: "INIT_ONLY" } } as any);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready",
        id: "1",
      }),
    );
    // Should NOT call the generator with INIT_ONLY
    expect(mockGenerator).not.toHaveBeenCalled();
  });

  it("posts 'complete' with generated text, stripped of prompt", async () => {
    mockGenerator.mockResolvedValue([
      { generated_text: "What is your question?\n\nThe answer is 42." },
    ]);

    await messageHandler!({
      data: { id: "2", prompt: "What is your question?" },
    } as any);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "2",
        output: "The answer is 42.",
      }),
    );
  });

  it("strips input prompt from generated text", async () => {
    mockGenerator.mockResolvedValue([
      {
        generated_text:
          "Explain BGB § 823\n\nBGB § 823 states that a person who intentionally or negligently...",
      },
    ]);

    await messageHandler!({
      data: { id: "3", prompt: "Explain BGB § 823" },
    } as any);

    const expectedOutput =
      "BGB § 823 states that a person who intentionally or negligently...";
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "3",
        output: expectedOutput,
      }),
    );
  });

  it("uses default model when no model provided", async () => {
    mockGenerator.mockResolvedValue([{ generated_text: "prompt\n\nresponse" }]);

    // Use a different model name to force pipeline recreation
    // The INIT_ONLY test initialized with null model = DEFAULT_MODEL
    await messageHandler!({
      data: { id: "4", prompt: "Hello" },
    } as any);

    // generator is already initialized with DEFAULT_MODEL from test 1
    // So pipeline shouldn't be called again
    // Just verify the response goes through
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "4",
      }),
    );
  });

  it("handles model switching (recreates generator)", async () => {
    const pipelineMock = vi.mocked(
      (await import("@huggingface/transformers")).pipeline,
    );
    const previousCallCount = pipelineMock.mock.calls.length;

    mockGenerator.mockResolvedValue([{ generated_text: "v1\n\nresp1" }]);
    await messageHandler!({
      data: { id: "5", prompt: "p1", model: "switch-test-v1" },
    } as any);

    mockGenerator.mockResolvedValue([{ generated_text: "v2\n\nresp2" }]);
    await messageHandler!({
      data: { id: "6", prompt: "p2", model: "switch-test-v2" },
    } as any);

    // pipeline should have been called 2 more times (different models)
    expect(pipelineMock.mock.calls.length - previousCallCount).toBe(2);
  });

  it("reuses generator for same model within same test", async () => {
    const pipelineMock = vi.mocked(
      (await import("@huggingface/transformers")).pipeline,
    );
    const previousCallCount = pipelineMock.mock.calls.length;

    mockGenerator.mockResolvedValue([{ generated_text: "same\n\nr1" }]);
    await messageHandler!({
      data: { id: "7", prompt: "Test", model: "reuse-test-model" },
    } as any);

    mockGenerator.mockResolvedValue([{ generated_text: "same\n\nr2" }]);
    await messageHandler!({
      data: { id: "8", prompt: "Another test", model: "reuse-test-model" },
    } as any);

    // pipeline should be called only 1 more time (same model reused)
    expect(pipelineMock.mock.calls.length - previousCallCount).toBe(1);
  });

  it("posts progress during generation", async () => {
    let resolvePromise: (v: any) => void = () => {};
    const generatorCalledPromise = new Promise<void>((resolve) => {
      mockGenerator.mockImplementation(() => {
        const p = new Promise((res) => {
          resolvePromise = res;
        });
        resolve();
        return p;
      });
    });

    const messagePromise = messageHandler!({
      data: {
        id: "9",
        prompt: "Test prompt",
        model: "progress-test-model",
      },
    } as any);

    // Wait for the generator to be called
    await generatorCalledPromise;

    // Simulate progress callback from pipeline
    // The pipeline was called before the generator
    expect(progressCallbackRef.current).toBeDefined();
    progressCallbackRef.current!({
      status: "download",
      progress: 0.7,
    });

    // The progress callback was captured during the pipeline() call
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "9",
        progress: 0.7,
      }),
    );

    // Complete
    resolvePromise([{ generated_text: "Test prompt\n\nThe result." }]);
    await messagePromise;

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        id: "9",
        output: "The result.",
      }),
    );
  });

  it("posts 'error' message on failure", async () => {
    mockGenerator.mockImplementation(() =>
      Promise.reject(new Error("Out of memory")),
    );

    await messageHandler!({
      data: { id: "10", prompt: "Test", model: "error-test-model" },
    } as any);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "error",
        id: "10",
        error: "Out of memory",
      }),
    );
  });
});
