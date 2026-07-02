"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface UseBrowserAIReturn {
  /** Send a prompt to the worker. Returns the generated text when complete. */
  generate: (prompt: string, model?: string) => Promise<string>;
  /** True after the worker sends a "ready" status. */
  isReady: boolean;
  /** True while the worker is generating a response. */
  isGenerating: boolean;
  /** The last successfully generated response text. */
  response: string;
  /** The last error message, or null. */
  error: string | null;
  /** Download/generation progress (0–1). */
  progress: number;
  /** Human-readable status message from the worker. */
  status: string | null;
}

/**
 * useBrowserAI — Creates and manages a Transformers.js web worker for
 * client-side text generation.
 *
 * When `enabled` is false (e.g. chat mode changed away from "browser"),
 * the worker is terminated and resources are freed.
 *
 * The returned `generate()` function returns a Promise that resolves with
 * the generated text. The `response` state variable is also set for
 * reactive consumers.
 */
export function useBrowserAI(enabled: boolean = true): UseBrowserAIReturn {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<{
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
  } | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsReady(false);
      setIsGenerating(false);
      setStatus(null);
      pendingRef.current?.reject(new Error("Worker disabled"));
      pendingRef.current = null;
      return;
    }

    // Guard: don't create a second worker if one already exists
    if (workerRef.current) return;

    const worker = new Worker(
      new URL("../workers/chat.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent) => {
      const { status: s, output, error: workerError, ...rest } = event.data;

      switch (s) {
        case "ready":
          setIsReady(true);
          setIsGenerating(false);
          setStatus("AI model ready");
          break;

        case "progress": {
          // Transformers.js progress_callback may put its own status field
          // in the data, overwriting the outer "progress" label.
          // Treat any progress-like message the same way.
          const pct = rest.total
            ? Math.round((rest.loaded / rest.total) * 100)
            : typeof rest.progress === "number"
              ? Math.round(rest.progress * 100)
              : 0;
          setProgress(pct / 100);
          setStatus(pct > 0 ? `Loading model... ${pct}%` : "Loading model...");
          break;
        }

        case "download": {
          const pct = rest.total
            ? Math.round((rest.loaded / rest.total) * 100)
            : 0;
          setProgress(pct / 100);
          setStatus(`Downloading core... ${pct}%`);
          break;
        }

        case "complete":
          setResponse(output || "");
          setIsGenerating(false);
          setProgress(1);
          setStatus(null);
          pendingRef.current?.resolve(output || "");
          pendingRef.current = null;
          break;

        case "error":
          setError(workerError || "Unknown worker error");
          setIsGenerating(false);
          setStatus(null);
          pendingRef.current?.reject(
            new Error(workerError || "Unknown worker error"),
          );
          pendingRef.current = null;
          break;
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      const msg = err.message || "Worker error";
      setError(msg);
      setIsGenerating(false);
      setStatus(null);
      pendingRef.current?.reject(new Error(msg));
      pendingRef.current = null;
    };

    workerRef.current = worker;

    // Send init signal to start model download
    worker.postMessage({ prompt: "INIT_ONLY", id: "init" });

    return () => {
      worker.terminate();
      workerRef.current = null;
      // If there's a pending promise, silently resolve it with empty
      // string to avoid unhandled rejections. The caller can check
      // isReady/isGenerating to detect the worker was torn down.
      if (pendingRef.current) {
        pendingRef.current.resolve("");
      }
      pendingRef.current = null;
    };
  }, [enabled]);

  const generate = useCallback(
    async (prompt: string, model?: string): Promise<string> => {
      const worker = workerRef.current;
      if (!worker) {
        const msg = "Browser AI worker not available.";
        setError(msg);
        return msg;
      }

      setError(null);
      setResponse("");
      setIsGenerating(true);
      setProgress(0);

      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { resolve, reject };
        worker.postMessage({
          id: crypto.randomUUID(),
          prompt,
          model,
        });
      });
    },
    [],
  );

  return { generate, isReady, isGenerating, response, error, progress, status };
}
