/**
 * Web Worker for client-side text generation via Transformers.js.
 * Used in Browser AI mode — runs entirely in-browser, no server AI call.
 * Model: Qwen1.5-0.5B-Chat — instruction-tuned, good for legal guidance.
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

/* eslint-disable @typescript-eslint/no-explicit-any -- Transformers.js pipeline API is dynamic */

const TASK = 'text-generation';
const DEFAULT_MODEL = 'Xenova/Qwen1.5-0.5B-Chat';

let generator: any = null;
let currentModel: string | null = null;

async function getGenerator(modelName: string, progress_callback?: (x: any) => void) {
  if (!generator || currentModel !== modelName) {
    generator = await pipeline(TASK, modelName, { progress_callback });
    currentModel = modelName;
  }
  return generator;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { id, prompt, model } = event.data;
  const modelToUse = model || DEFAULT_MODEL;

  try {
    const gen = await getGenerator(modelToUse, (x: any) => {
      self.postMessage({ status: 'progress', id, ...x });
    });

    if (prompt === 'INIT_ONLY') {
      self.postMessage({ status: 'ready', id });
      return;
    }

    const output = await gen(prompt, {
      max_new_tokens: 512,
      temperature: 0.3,
      do_sample: true,
    });

    // text-generation includes the input prompt in generated_text
    const full = Array.isArray(output)
      ? output[0]?.generated_text || ''
      : (output as any)?.generated_text || '';

    // Strip the input prompt from the output
    const text = full.startsWith(prompt) ? full.slice(prompt.length).trim() : full.trim();

    self.postMessage({ status: 'complete', id, output: text });
  } catch (error: any) {
    self.postMessage({ status: 'error', id, error: error.message });
  }
});
