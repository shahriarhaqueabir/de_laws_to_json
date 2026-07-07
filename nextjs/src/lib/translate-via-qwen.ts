/**
 * translateViaQwen — Client-side translation using the cached Qwen3-0.6B-ONNX model.
 *
 * Delegates to the shared BrowserWorkerManager so translation reuses the same
 * worker instance used by Browser AI chat mode. The model is cached in IndexedDB
 * by Transformers.js, so no additional downloads are needed.
 */

import { browserWorker } from "./worker-manager";

/**
 * Translate German legal text to the target language using the cached Qwen model.
 * First call triggers model download; subsequent calls reuse the cached model.
 *
 * @param text - German legal text to translate
 * @param language - Target language name (e.g., "English", "Arabic", "Turkish")
 * @returns Translated text
 */
export async function translateViaQwen(
  text: string,
  language: string,
): Promise<string> {
  return browserWorker.translate(text, language);
}
