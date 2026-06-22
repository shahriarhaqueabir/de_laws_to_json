import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateChatResponse,
  generateNormExplanation,
  LEGAL_DISCLAIMER,
} from "../chat";
import type { GenerateParams, ExplainParams } from "../chat";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function openAISuccess(body?: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: body ?? "This is a test response." } }],
    }),
  });
}

function anthropicSuccess(body?: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ text: body ?? "This is an Anthropic response." }],
    }),
  });
}

function failedFetch(status = 401, body = "Unauthorized") {
  mockFetch.mockResolvedValue({
    ok: false,
    status,
    text: async () => body,
  });
}

// ── callOpenAI (tested through generateChatResponse) ──

describe("generateChatResponse — OpenAI", () => {
  const baseParams: GenerateParams = {
    provider: "openai",
    apiKey: "sk-test-123",
    model: "gpt-4o-mini",
    customEndpoint: "",
    question: "What does BGB § 433 say?",
    norms: [],
    context: "Context about sales contracts.",
    language: "en",
  };

  it("sends correct URL, headers, body and returns content", async () => {
    openAISuccess("Sales contract defined.");

    const result = await generateChatResponse(baseParams);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test-123",
        },
      }),
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe("gpt-4o-mini");
    expect(callBody.temperature).toBe(0.3);
    expect(callBody.messages[0].role).toBe("system");
    expect(callBody.messages[1].role).toBe("user");
    expect(callBody.messages[1].content).toContain("BGB § 433");
    expect(result).toContain("Sales contract defined.");
  });

  it("throws on non-ok response", async () => {
    failedFetch(401, "Invalid API key");

    await expect(generateChatResponse(baseParams)).rejects.toThrow(
      "OpenAI API error: 401 Invalid API key",
    );
  });
});

// ── callAnthropic (tested through generateChatResponse) ──

describe("generateChatResponse — Anthropic", () => {
  const baseParams: GenerateParams = {
    provider: "anthropic",
    apiKey: "sk-ant-test",
    model: "claude-3-haiku-20240307",
    customEndpoint: "",
    question: "What is StGB § 123?",
    norms: [],
    context: "Trespassing context.",
    language: "en",
  };

  it("sends correct headers (x-api-key, anthropic-version) and returns content", async () => {
    anthropicSuccess("Trespassing explained.");

    const result = await generateChatResponse(baseParams);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "sk-ant-test",
          "anthropic-version": "2023-06-01",
        },
      }),
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.model).toBe("claude-3-haiku-20240307");
    expect(callBody.system).toContain("multilingual German legal expert");

    expect(result).toContain("Trespassing explained.");
  });
});

// ── callOpenAICompatible (tested through generateChatResponse) ──

describe("generateChatResponse — OpenAI-Compatible", () => {
  it("uses custom endpoint URL with /v1/chat/completions suffix", async () => {
    openAISuccess("Custom endpoint response.");

    await generateChatResponse({
      provider: "openai-compatible",
      apiKey: "sk-custom",
      model: "custom-model",
      customEndpoint: "https://my-proxy.example.com",
      question: "Test?",
      norms: [],
      context: "",
      language: "en",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://my-proxy.example.com/v1/chat/completions",
      expect.anything(),
    );
  });

  it("defaults to openai.com when custom endpoint is empty", async () => {
    openAISuccess("Default endpoint.");

    await generateChatResponse({
      provider: "openai-compatible",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
      question: "Test?",
      norms: [],
      context: "",
      language: "en",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.anything(),
    );
  });
});

// ── generateChatResponse routing ──

describe("generateChatResponse — routing", () => {
  it("routes to openai when provider is openai", async () => {
    openAISuccess("openai");
    const res = await generateChatResponse({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
      question: "Hi",
      norms: [],
      context: "",
      language: "en",
    });
    expect(res).toContain("openai");
  });

  it("routes to anthropic when provider is anthropic", async () => {
    anthropicSuccess("anthropic");
    const res = await generateChatResponse({
      provider: "anthropic",
      apiKey: "sk-test",
      model: "claude-3-haiku-20240307",
      customEndpoint: "",
      question: "Hi",
      norms: [],
      context: "",
      language: "en",
    });
    expect(res).toContain("anthropic");
  });

  it("routes to openai-compatible when provider is openai-compatible", async () => {
    openAISuccess("compatible");
    const res = await generateChatResponse({
      provider: "openai-compatible",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "https://example.com",
      question: "Hi",
      norms: [],
      context: "",
      language: "en",
    });
    expect(res).toContain("compatible");
  });

  it("throws for unknown provider", async () => {
    await expect(
      generateChatResponse({
        provider: "unknown" as any,
        apiKey: "",
        model: "",
        customEndpoint: "",
        question: "",
        norms: [],
        context: "",
        language: "en",
      }),
    ).rejects.toThrow("Unknown provider");
  });
});

// ── Language injection ──

describe("generateChatResponse — language injection", () => {
  it("injects English language into system prompt", async () => {
    openAISuccess("response");
    await generateChatResponse({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
      question: "Test",
      norms: [],
      context: "",
      language: "en",
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages[0].content).toContain("English");
    expect(callBody.messages[0].content).toContain("Always respond in English");
  });

  it("injects German language into system prompt", async () => {
    openAISuccess("Antwort");
    await generateChatResponse({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
      question: "Test",
      norms: [],
      context: "",
      language: "de",
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.messages[0].content).toContain("German");
    expect(callBody.messages[0].content).toContain("Always respond in German");
  });
});

// ── RDG disclaimer ──

describe("generateChatResponse — RDG disclaimer", () => {
  it("appends RDG disclaimer to response", async () => {
    openAISuccess("Legal analysis.");
    const result = await generateChatResponse({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      customEndpoint: "",
      question: "Test",
      norms: [],
      context: "",
      language: "en",
    });

    expect(result).toContain(LEGAL_DISCLAIMER);
  });
});

// ── generateNormExplanation ──

describe("generateNormExplanation", () => {
  const baseParams: ExplainParams = {
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    customEndpoint: "",
    normId: "§ 433",
    lawKey: "BGB",
    content: "Der Verkäufer einer Sache...",
    lang: "en",
  };

  it("parses valid JSON response", async () => {
    const mockJson = JSON.stringify({
      translation: "The seller of an item...",
      summary: "This defines a sales contract.",
      implications: "You have rights as a buyer.",
      next_steps: "Contact a lawyer.",
    });
    openAISuccess(mockJson);

    const result = await generateNormExplanation(baseParams);

    expect(result.norm_id).toBe("§ 433");
    expect(result.law_key).toBe("BGB");
    expect(result.translation).toBe("The seller of an item...");
    expect(result.summary).toBe("This defines a sales contract.");
    expect(result.implications).toBe("You have rights as a buyer.");
    expect(result.next_steps).toBe("Contact a lawyer.");
    expect(result.lang).toBe("en");
  });

  it("strips markdown code fences (```json ... ```)", async () => {
    const wrappedJson =
      '```json\n{\n  "translation": "Translated text",\n  "summary": "Summary text",\n  "implications": "Implications",\n  "next_steps": "Next steps"\n}\n```';
    openAISuccess(wrappedJson);

    const result = await generateNormExplanation(baseParams);

    expect(result.translation).toBe("Translated text");
    expect(result.summary).toBe("Summary text");
    expect(result.implications).toBe("Implications");
    expect(result.next_steps).toBe("Next steps");
  });

  it("strips markdown code fences without json tag", async () => {
    const wrappedJson =
      '```\n{"translation": "T", "summary": "S", "implications": "I", "next_steps": "N"}\n```';
    openAISuccess(wrappedJson);

    const result = await generateNormExplanation(baseParams);

    expect(result.translation).toBe("T");
  });

  it("fallback wraps raw text when JSON parse fails", async () => {
    openAISuccess("This is not JSON at all. Just plain text.");

    const result = await generateNormExplanation(baseParams);

    // Fallback: all fields contain the raw text
    expect(result.translation).toBe(
      "This is not JSON at all. Just plain text.",
    );
    expect(result.summary).toBe("This is not JSON at all. Just plain text.");
    expect(result.implications).toBe(
      "This is not JSON at all. Just plain text.",
    );
    expect(result.next_steps).toBe("This is not JSON at all. Just plain text.");
  });
});
