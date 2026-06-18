/**
 * Web Worker for client-side text generation via Transformers.js.
 * Used in Browser AI mode — runs entirely in-browser, no server AI call.
 * Model: LaMini-Flan-T5-783M (~1.5GB, good for instruction following).
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

/* eslint-disable @typescript-eslint/no-explicit-any -- Transformers.js pipeline API is dynamic */

const TASK = 'text2text-generation';
const MODEL = 'Xenova/LaMini-Flan-T5-783M';

let generator: any = null;

async function getGenerator(progress_callback?: (x: any) => void) {
  if (!generator) {
    generator = await pipeline(TASK, MODEL, { progress_callback });
  }
  return generator;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { id, prompt } = event.data;

  try {
    const gen = await getGenerator((x: any) => {
      self.postMessage({ status: 'progress', id, ...x });
    });

    const output = await gen(prompt, {
      max_new_tokens: 512,
      temperature: 0.3,
      do_sample: true,
    });

    const text = Array.isArray(output)
      ? output[0]?.generated_text?.trim() || ''
      : (output as any)?.generated_text?.trim() || '';

    self.postMessage({ status: 'complete', id, output: text });
  } catch (error: any) {
    self.postMessage({ status: 'error', id, error: error.message });
  }
});
