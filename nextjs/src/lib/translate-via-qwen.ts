/**
 * translateViaQwen — Client-side translation using the cached Qwen3-0.6B-ONNX model.
 *
 * Instead of downloading separate translation models (opus-mt-de-en, NLLB-200),
 * this function reuses chat.worker.ts which loads the already-cached Qwen model
 * for the Browser AI chat mode. The model is shared and cached in IndexedDB,
 * so no additional downloads are needed.
 */

let worker: Worker | null = null;

type PendingRequest = {
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
};

const pending = new Map<string, PendingRequest>();

function getWorker(): Worker {
  if (!worker && typeof window !== "undefined") {
    worker = new Worker(
      new URL("../workers/chat.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent) => {
      const { status, id, output, error } = event.data;
      const entry = pending.get(id);
      if (!entry) return;

      if (status === "complete") {
        entry.resolve(output);
        pending.delete(id);
      } else if (status === "error") {
        entry.reject(new Error(error));
        pending.delete(id);
      }
      // "progress" and "ready" events are ignored — they're for model loading
    };
  }
  return worker!;
}

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
  const id = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({
      id,
      task: "translate",
      text,
      language,
    });
  });
}
