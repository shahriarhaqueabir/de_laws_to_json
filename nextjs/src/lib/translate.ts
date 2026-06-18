/**
 * Client-side German↔English translation via Transformers.js Web Worker.
 */

let worker: Worker | null = null;
const pending = new Map<string, { resolve: (v: string) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker {
  if (!worker && typeof window !== 'undefined') {
    worker = new Worker(new URL('../workers/translate.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event) => {
      const { status, id, output, error } = event.data;
      const entry = pending.get(id);
      if (!entry) return;

      if (status === 'complete') {
        entry.resolve(output);
        pending.delete(id);
      } else if (status === 'error') {
        entry.reject(new Error(error));
        pending.delete(id);
      }
      // progress messages are ignored for now
    };
  }
  return worker!;
}

export async function translateText(text: string): Promise<string> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text });
  });
}
