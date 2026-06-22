/**
 * Web Worker for client-side translation via Transformers.js.
 *
 * Supports two models:
 * 1. `opus-mt-de-en` — dedicated German→English, small and fast (~300MB)
 * 2. `nllb-200-distilled-600M` — 200+ languages, good for all 9 supported langs (~1.2GB)
 *
 * The worker auto-selects the model based on the target language:
 * - German→English: uses opus-mt-de-en (fast path)
 * - German→any other language: uses NLLB-600M (broad coverage)
 */

import { pipeline, env } from "@huggingface/transformers";

// Skip local model check — always download from HuggingFace Hub
env.allowLocalModels = false;

/* eslint-disable @typescript-eslint/no-explicit-any */
/* Transformers.js pipeline API is dynamic */

// ── Model Definitions ─────────────────────────────────────────────────────

interface ModelConfig {
  modelId: string;
  task: string;
  description: string;
  size: string;
  languages: string[];
}

const MODELS: Record<string, ModelConfig> = {
  "opus-de-en": {
    modelId: "Xenova/opus-mt-de-en",
    task: "translation",
    description: "Dedicated German→English, fast & small",
    size: "~300MB",
    languages: ["de", "en"],
  },
  "nllb-600m": {
    modelId: "Xenova/nllb-200-distilled-600M",
    task: "translation",
    description: "200+ languages, covers all 9 supported languages",
    size: "~1.2GB",
    languages: ["de", "en", "tr", "ar", "fr", "es", "pl", "uk", "ru"],
  },
};

// ── NLLB Language Code Map ────────────────────────────────────────────────
// NLLB uses FLORES-200 codes, not ISO 639-1

const NLLB_LANG_CODES: Record<string, string> = {
  de: "deu_Latn",
  en: "eng_Latn",
  tr: "tur_Latn",
  ar: "ara_Arab",
  fr: "fra_Latn",
  es: "spa_Latn",
  pl: "pol_Latn",
  uk: "ukr_Cyrl",
  ru: "rus_Cyrl",
};

// For opus-mt-de-en we just use the standard codes internally
const OPUS_SRC = "de";
const OPUS_TGT = "en";

// ── Worker State ──────────────────────────────────────────────────────────

let currentModel: any = null;
let currentModelId: string | null = null;

// ── Model Selection Logic ─────────────────────────────────────────────────

function selectModel(sourceLang: string, targetLang: string): string {
  // German→English: use fast opus model
  if (sourceLang === "de" && targetLang === "en") {
    return "opus-de-en";
  }
  // Everything else: use NLLB
  return "nllb-600m";
}

// ── Pipeline Factory ──────────────────────────────────────────────────────

async function getTranslator(
  modelKey: string,
  progress_callback?: (x: any) => void,
) {
  const config = MODELS[modelKey];
  if (!config) throw new Error(`Unknown model: ${modelKey}`);

  if (!currentModel || currentModelId !== modelKey) {
    currentModel = await pipeline(config.task as any, config.modelId as any, {
      progress_callback,
    });
    currentModelId = modelKey;
  }
  return currentModel;
}

// ── Message Handler ───────────────────────────────────────────────────────

self.addEventListener("message", async (event: MessageEvent) => {
  const { id, text, sourceLang, targetLang } = event.data;

  const src = sourceLang || "de";
  const tgt = targetLang || "en";

  try {
    const modelKey = selectModel(src, tgt);
    const config = MODELS[modelKey];
    const translator = await getTranslator(modelKey, (x: any) => {
      self.postMessage({ status: "progress", id, modelKey, ...x });
    });

    let output: string;

    if (modelKey === "opus-de-en") {
      // opus-mt-de-en: simple pipeline, input format is just text
      const result = await translator(text);
      output = Array.isArray(result)
        ? result[0].translation_text
        : result.translation_text;
    } else {
      // NLLB: requires src_lang and tgt_lang in the input
      const srcCode = NLLB_LANG_CODES[src] || src;
      const tgtCode = NLLB_LANG_CODES[tgt] || tgt;

      const result = await translator(text, {
        src_lang: srcCode,
        tgt_lang: tgtCode,
      });
      output = Array.isArray(result)
        ? result[0].translation_text
        : result.translation_text;
    }

    self.postMessage({
      status: "complete",
      id,
      output,
      modelUsed: config.description,
    });
  } catch (error: any) {
    self.postMessage({
      status: "error",
      id,
      error: error.message,
    });
  }
});
