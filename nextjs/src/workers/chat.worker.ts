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

/**
 * Strip Gemma-style <think> reasoning blocks from model output.
 * Gemma 3 often wraps its chain-of-thought in <think>...</think>
 * tags before the final answer. These should not be shown to the user.
 */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

/**
 * Clean model output: strip prompt prefix, strip think tags, trim.
 */
function cleanOutput(full: string, prompt: string): string {
  let text = full.startsWith(prompt)
    ? full.slice(prompt.length).trim()
    : full.trim();
  text = stripThinkTags(text);
  return text;
}

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
      const systemMsg = `Translate the following German legal text to ${langName}. Respond with ONLY the translated text and nothing else — no explanations, no notes, no JSON, no formatting.`;
      const finalPrompt = buildFullPrompt(systemMsg, inputText, modelToUse);

      const output = await gen(finalPrompt, {
        max_new_tokens: 1024,
        temperature: 0.1,
        do_sample: true,
      });

      const full = Array.isArray(output)
        ? output[0]?.generated_text || ""
        : (output as any)?.generated_text || "";

      let result = cleanOutput(full, finalPrompt);

      // If the model returned JSON with a "translation" field, extract just that
      try {
        const parsed = JSON.parse(result);
        if (parsed.translation && typeof parsed.translation === "string") {
          result = parsed.translation.trim();
        }
      } catch {
        // Not JSON — use as-is
      }

      self.postMessage({ status: "complete", id, output: result });
      return;
    }

    if (prompt === "INIT_ONLY") {
      self.postMessage({ status: "ready", id });
      return;
    }

    // Use 12k max new tokens for long-form legal analysis.
    // Qwen3-0.6B supports up to 32k; Gemma 3 270M supports ~8k.
    const maxTokens = isGemmaModel(modelToUse) ? 8192 : 12288;
    const output = await gen(prompt, {
      max_new_tokens: maxTokens,
      temperature: 0.3,
      do_sample: true,
    });

    // text-generation includes the input prompt in generated_text
    const full = Array.isArray(output)
      ? output[0]?.generated_text || ""
      : (output as any)?.generated_text || "";

    // Strip the input prompt and any Gemma-style <think> tags
    const text = cleanOutput(full, prompt);

    self.postMessage({ status: "complete", id, output: text });
  } catch (error: any) {
    self.postMessage({ status: "error", id, error: error.message });
  }
});
