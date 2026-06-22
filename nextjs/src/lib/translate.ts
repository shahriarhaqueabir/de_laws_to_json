/**
 * Client-side German↔English translation via Transformers.js Web Worker.
 */

let worker: Worker | null = null;
type TranslationProgress = {
  status: "progress";
  progress: number;
  file?: string;
};

type PendingRequest = {
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
  onProgress?: (p: TranslationProgress) => void;
};

const pending = new Map<string, PendingRequest>();

function getWorker(): Worker {
  if (!worker && typeof window !== "undefined") {
    worker = new Worker(
      new URL("../workers/translate.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    worker.onmessage = (event) => {
      const { status, id, output, error, ...rest } = event.data;
      const entry = pending.get(id);
      if (!entry) return;

      if (status === "complete") {
        entry.resolve(output);
        pending.delete(id);
      } else if (status === "error") {
        entry.reject(new Error(error));
        pending.delete(id);
      } else if (status === "progress" && entry.onProgress) {
        entry.onProgress({
          status: "progress",
          ...rest,
        } as TranslationProgress);
      }
    };
  }
  return worker!;
}

export async function translateText(
  text: string,
  onProgress?: (p: TranslationProgress) => void,
): Promise<string> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, text });
  });
}
