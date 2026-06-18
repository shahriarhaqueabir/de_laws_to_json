/**
 * Web Worker for client-side translation via Transformers.js.
 */
import { pipeline, env } from '@huggingface/transformers';

// Skip local model check
env.allowLocalModels = false;

/* eslint-disable @typescript-eslint/no-explicit-any -- Transformers.js pipeline API is dynamic */

class TranslationWorker {
  static task = 'translation' as const;
  static model = 'Xenova/nllb-200-distilled-600M';
  static instance: any = null;

  static async getInstance(progress_callback?: (x: any) => void) {
    if (!this.instance) {
      this.instance = pipeline(this.task as any, this.model, {
        progress_callback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { id, text, src_lang, tgt_lang } = event.data;

  try {
    const translator = await TranslationWorker.getInstance((x) => {
      self.postMessage({ status: 'progress', id, ...x });
    });

    const output = await translator(text, {
      src_lang,
      tgt_lang,
    });

    self.postMessage({
      status: 'complete',
      id,
      output: Array.isArray(output) ? output[0].translation_text : output.translation_text,
    });
  } catch (error: any) {
    self.postMessage({
      status: 'error',
      id,
      error: error.message,
    });
  }
});
