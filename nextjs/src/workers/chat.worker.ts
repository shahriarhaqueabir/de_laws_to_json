/**
 * Web Worker for client-side text generation via Transformers.js.
 * Used in Browser AI mode — runs entirely in-browser, no server AI call.
 * Model: Qwen3-0.6B-ONNX — fast, multilingual on-device inference.
 *
 * Expects the `prompt` field to already be formatted in ChatML format
 * (<|im_start|>system / <|im_start|>user / <|im_start|>assistant) so
 * Qwen3 distinguishes system instructions from user input correctly.
 */
import { pipeline, env } from "@huggingface/transformers";

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

let generator: any = null;
let currentModel: string | null = null;

async function getGenerator(
  modelName: string,
  progress_callback?: (x: any) => void,
) {
  if (!generator || currentModel !== modelName) {
    generator = await pipeline(TASK, modelName, { progress_callback });
    currentModel = modelName;
  }
  return generator;
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { id, prompt, model } = event.data;
  const modelToUse = model || DEFAULT_MODEL;

  try {
    const gen = await getGenerator(modelToUse, (x: any) => {
      self.postMessage({ status: "progress", id, ...x });
    });

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
