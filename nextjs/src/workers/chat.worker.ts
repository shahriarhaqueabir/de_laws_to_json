/**
 * Web Worker for client-side text generation via Transformers.js.
 * Used in Browser AI mode — runs entirely in-browser, no server AI call.
 *
 * Models (all loaded with dtype: "q4f16" for WASM compatibility):
 *   - onnx-community/Qwen3-0.6B-ONNX      (570 MB) — best multilingual quality
 *   - onnx-community/gemma-3-270m-it-ONNX  (273 MB) — lightweight fallback
 *
 * Prompt format is model-aware:
 *   - Qwen3 uses ChatML:  <|im_start|>system ... <|im_end|>
 *   - Gemma 3 uses:       <start_of_turn>system\n...<end_of_turn>
 */
import { pipeline, env } from "@huggingface/transformers";
import { isGemmaModel, buildFullPrompt } from "../lib/prompt-format";

// ── WASM Configuration for CSP Compatibility ──
// Transformers.js downloads ONNX WASM binaries at runtime.
// The CSP in next.config.ts allows these CDN origins:
//   - cdn.jsdelivr.net (preferred, fast worldwide CDN)
//   - unpkg.com (fallback)
//
// We configure wasmPaths explicitly so the runtime picks a CSP-compatible
// origin instead of guessing. Single-threaded mode (numThreads: 1) avoids
// SharedArrayBuffer requirements that would need COOP/COEP headers.
env.allowLocalModels = false;

const WASM_CDNS = [
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@latest/dist/",
  "https://unpkg.com/@huggingface/transformers@latest/dist/",
];

env.backends = {
  onnx: {
    wasm: {
      wasmPaths: WASM_CDNS[0],
      numThreads: 1,
    },
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any -- Transformers.js pipeline API is dynamic */

const TASK = "text-generation";
const DEFAULT_MODEL = "onnx-community/Qwen3-0.6B-ONNX";

// Prompt format functions imported from lib/prompt-format.ts

let generator: any = null;
let currentModel: string | null = null;

async function getGenerator(
  modelName: string,
  progress_callback?: (x: any) => void,
) {
  if (!generator || currentModel !== modelName) {
    // Use q4f16 (4-bit quantized) weights to fit within WASM heap.
    // FP32 weights (~2 GB) cause std::bad_alloc on most devices.
    // q4f16 reduces memory to ~570 MB for Qwen3-0.6B, ~273 MB for Gemma 3 270M.
    generator = await pipeline(TASK, modelName, {
      dtype: "q4f16",
      progress_callback,
    });
    currentModel = modelName;
  }
  return generator;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { id, task, prompt, text: inputText, language, model } = event.data;
  const modelToUse = model || DEFAULT_MODEL;

  try {
    const gen = await getGenerator(modelToUse, (x: any) => {
      self.postMessage({ status: "progress", id, ...x });
    });

    // ── Translation task (reuses the same Qwen model) ──
    if (task === "translate") {
      if (!inputText) {
        self.postMessage({
          status: "error",
          id,
          error: "No text provided for translation",
        });
        return;
      }

      const langName = language || "English";
      const systemMsg = `You are a precise translator for German legal texts. Translate the following German legal text to ${langName}. Return ONLY the translated text. Do not add explanations, notes, or any other text.`;
      const finalPrompt = buildFullPrompt(systemMsg, inputText, modelToUse);

      const output = await gen(finalPrompt, {
        max_new_tokens: 1024,
        temperature: 0.3,
        do_sample: true,
      });

      const full = Array.isArray(output)
        ? output[0]?.generated_text || ""
        : (output as any)?.generated_text || "";

      const result = full.startsWith(finalPrompt)
        ? full.slice(finalPrompt.length).trim()
        : full.trim();

      self.postMessage({ status: "complete", id, output: result });
      return;
    }

    if (prompt === "INIT_ONLY") {
      self.postMessage({ status: "ready", id });
      return;
    }

    const output = await gen(prompt, {
      max_new_tokens: 512,
      temperature: 0.3,
      do_sample: true,
    });

    // text-generation includes the input prompt in generated_text
    const full = Array.isArray(output)
      ? output[0]?.generated_text || ""
      : (output as any)?.generated_text || "";

    // Strip the input prompt from the output
    const text = full.startsWith(prompt)
      ? full.slice(prompt.length).trim()
      : full.trim();

    self.postMessage({ status: "complete", id, output: text });
  } catch (error: any) {
    self.postMessage({ status: "error", id, error: error.message });
  }
});
