import { describe, it, expect } from "vitest";
import {
  isGemmaModel,
  buildSystemPrompt,
  buildUserPrompt,
  buildAssistantPrefix,
  stripThinkTags,
  buildFullPrompt,
} from "../prompt-format";

describe("isGemmaModel", () => {
  it("returns true for model IDs containing 'gemma' (lowercase)", () => {
    expect(isGemmaModel("gemma-3")).toBe(true);
  });

  it("returns true for model IDs containing 'gemma' (mixed case)", () => {
    expect(isGemmaModel("Google-Gemma-3-4B")).toBe(true);
  });

  it("returns false for Qwen model IDs", () => {
    expect(isGemmaModel("onnx-community/Qwen3-0.6B-ONNX")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGemmaModel("")).toBe(false);
  });

  it("returns false for other model IDs", () => {
    expect(isGemmaModel("deepseek-r1")).toBe(false);
    expect(isGemmaModel("mistral-7b")).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  it("uses Gemma template when model is Gemma", () => {
    const result = buildSystemPrompt("You are a lawyer.", "gemma-3");
    expect(result).toBe("<start_of_turn>system\nYou are a lawyer.<end_of_turn>");
  });

  it("uses ChatML template for non-Gemma models", () => {
    const result = buildSystemPrompt("You are a lawyer.", "Qwen3-0.6B");
    expect(result).toBe("<|im_start|>system\nYou are a lawyer.<|im_end|>");
  });

  it("handles empty system content", () => {
    const result = buildSystemPrompt("", "Qwen3");
    expect(result).toBe("<|im_start|>system\n<|im_end|>");
  });

  it("handles multiline system content", () => {
    const content = "Line 1\nLine 2";
    const result = buildSystemPrompt(content, "gemma-3");
    expect(result).toContain("Line 1\nLine 2");
  });
});

describe("buildUserPrompt", () => {
  it("uses Gemma template when model is Gemma", () => {
    const result = buildUserPrompt("What is BGB?", "gemma-3");
    expect(result).toBe("<start_of_turn>user\nWhat is BGB?<end_of_turn>");
  });

  it("uses ChatML template for non-Gemma models", () => {
    const result = buildUserPrompt("What is BGB?", "Qwen3");
    expect(result).toBe("<|im_start|>user\nWhat is BGB?<|im_end|>");
  });
});

describe("buildAssistantPrefix", () => {
  it("returns Gemma model prefix for Gemma models", () => {
    expect(buildAssistantPrefix("google/gemma-3")).toBe("<start_of_turn>model\n");
  });

  it("returns ChatML assistant prefix for non-Gemma models", () => {
    expect(buildAssistantPrefix("Qwen3-0.6B")).toBe("<|im_start|>assistant\n");
  });
});

describe("stripThinkTags", () => {
  it("removes a single think block", () => {
    const input = "<think>internal reasoning</think>Final answer";
    expect(stripThinkTags(input)).toBe("Final answer");
  });

  it("removes multiple think blocks", () => {
    const input = "<think>first</think>Middle<think>second</think>End";
    expect(stripThinkTags(input)).toBe("MiddleEnd");
  });

  it("removes multiline think blocks", () => {
    const input = "<think>\nline 1\nline 2\n</think>\nVisible content";
    expect(stripThinkTags(input)).toBe("Visible content");
  });

  it("returns text unchanged when no think tags present", () => {
    expect(stripThinkTags("Plain answer")).toBe("Plain answer");
  });

  it("trims surrounding whitespace", () => {
    expect(stripThinkTags("  hello  ")).toBe("hello");
  });

  it("returns empty string for think-only input", () => {
    expect(stripThinkTags("<think>all internal</think>")).toBe("");
  });

  it("strips trailing whitespace after think block removal", () => {
    const input = "<think>thought</think>   Answer";
    expect(stripThinkTags(input)).toBe("Answer");
  });
});

describe("buildFullPrompt", () => {
  it("assembles a full Qwen3/ChatML prompt", () => {
    const result = buildFullPrompt("sys", "usr", "Qwen3");
    expect(result).toBe(
      "<|im_start|>system\nsys<|im_end|>\n<|im_start|>user\nusr<|im_end|>\n<|im_start|>assistant\n"
    );
  });

  it("assembles a full Gemma prompt", () => {
    const result = buildFullPrompt("sys", "usr", "gemma-3");
    expect(result).toBe(
      "<start_of_turn>system\nsys<end_of_turn>\n<start_of_turn>user\nusr<end_of_turn>\n<start_of_turn>model\n"
    );
  });

  it("includes system content in the prompt", () => {
    const result = buildFullPrompt("Be helpful.", "Hello?", "Qwen3");
    expect(result).toContain("Be helpful.");
  });

  it("includes user content in the prompt", () => {
    const result = buildFullPrompt("Be helpful.", "Hello?", "Qwen3");
    expect(result).toContain("Hello?");
  });
});
