import { describe, it, expect } from "vitest";
import {
  MODE_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_NAMES,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_OLLAMA_PARAMS,
  BROWSER_MODELS,
} from "../types";

describe("MODE_LABELS", () => {
  it("has all 4 modes with label and description", () => {
    const modes = Object.keys(MODE_LABELS);
    expect(modes).toHaveLength(4);

    for (const mode of ["local", "cloud", "browser", "basic"]) {
      expect(MODE_LABELS[mode as keyof typeof MODE_LABELS]).toHaveProperty(
        "label",
      );
      expect(MODE_LABELS[mode as keyof typeof MODE_LABELS]).toHaveProperty(
        "description",
      );
    }
  });

  it("local mode has correct label", () => {
    expect(MODE_LABELS.local.label).toBe("Local AI");
  });

  it("basic mode has correct label", () => {
    expect(MODE_LABELS.basic.label).toBe("Basic Search");
  });
});

describe("LANGUAGE_LABELS", () => {
  const expectedLanguages = [
    "de",
    "en",
    "tr",
    "ar",
    "fr",
    "es",
    "pl",
    "uk",
    "ru",
  ];

  it("has all 9 languages", () => {
    const keys = Object.keys(LANGUAGE_LABELS);
    expect(keys).toHaveLength(9);
    for (const lang of expectedLanguages) {
      expect(
        LANGUAGE_LABELS[lang as keyof typeof LANGUAGE_LABELS],
      ).toBeDefined();
    }
  });

  it("returns Deutsch for de", () => {
    expect(LANGUAGE_LABELS.de).toBe("Deutsch");
  });

  it("returns English for en", () => {
    expect(LANGUAGE_LABELS.en).toBe("English");
  });
});

describe("LANGUAGE_NAMES", () => {
  const expectedLanguages = [
    "de",
    "en",
    "tr",
    "ar",
    "fr",
    "es",
    "pl",
    "uk",
    "ru",
  ];

  it("has all 9 languages", () => {
    const keys = Object.keys(LANGUAGE_NAMES);
    expect(keys).toHaveLength(9);
    for (const lang of expectedLanguages) {
      expect(LANGUAGE_NAMES[lang as keyof typeof LANGUAGE_NAMES]).toBeDefined();
    }
  });

  it("returns German for de", () => {
    expect(LANGUAGE_NAMES.de).toBe("German");
  });
});

describe("DEFAULT_CHAT_SETTINGS", () => {
  it("has all required fields", () => {
    const settings = DEFAULT_CHAT_SETTINGS;
    expect(settings).toHaveProperty("mode");
    expect(settings).toHaveProperty("language");
    expect(settings).toHaveProperty("brokerUrl");
    expect(settings).toHaveProperty("ollamaModel");
    expect(settings).toHaveProperty("ollamaParams");
    expect(settings).toHaveProperty("provider");
    expect(settings).toHaveProperty("model");
    expect(settings).toHaveProperty("customEndpoint");
    expect(settings).toHaveProperty("browserModel");
  });

  it("defaults to basic mode and English", () => {
    expect(DEFAULT_CHAT_SETTINGS.mode).toBe("basic");
    expect(DEFAULT_CHAT_SETTINGS.language).toBe("en");
  });

  it("defaults to gpt-4o-mini model", () => {
    expect(DEFAULT_CHAT_SETTINGS.model).toBe("gpt-4o-mini");
  });
});

describe("DEFAULT_OLLAMA_PARAMS", () => {
  it("has all params", () => {
    const params = DEFAULT_OLLAMA_PARAMS;
    expect(params).toHaveProperty("temperature");
    expect(params).toHaveProperty("top_p");
    expect(params).toHaveProperty("top_k");
    expect(params).toHaveProperty("max_tokens");
    expect(params).toHaveProperty("system_prompt");
  });

  it("has low temperature for legal precision", () => {
    expect(DEFAULT_OLLAMA_PARAMS.temperature).toBe(0.3);
  });

  it("has empty system_prompt by default (populated at runtime in chat-context)", () => {
    expect(DEFAULT_OLLAMA_PARAMS.system_prompt).toBe("");
  });
});

describe("BROWSER_MODELS", () => {
  it("entries have id, name, size, description", () => {
    for (const model of BROWSER_MODELS) {
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("size");
      expect(model).toHaveProperty("description");
    }
  });

  it("has at least 2 browser models", () => {
    expect(BROWSER_MODELS.length).toBeGreaterThanOrEqual(2);
  });

  it("first model is Qwen3 (best quality)", () => {
    expect(BROWSER_MODELS[0].id).toBe("onnx-community/Qwen3-0.6B-ONNX");
  });

  it("second model is Gemma 3 270M (lightweight fallback)", () => {
    expect(BROWSER_MODELS[1].id).toBe("onnx-community/gemma-3-270m-it-ONNX");
  });

  it("does not contain LaMini-Flan-T5 (encoder-decoder, incompatible)", () => {
    const ids = BROWSER_MODELS.map((m) => m.id);
    expect(ids).not.toContain("Xenova/LaMini-Flan-T5-783M");
  });
});
