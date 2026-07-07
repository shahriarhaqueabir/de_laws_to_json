"use client";

import { useState, useCallback, useEffect, startTransition } from "react";
import { browserWorker, WorkerStatusEvent } from "../lib/worker-manager";

export interface UseBrowserAIReturn {
  /** Send a prompt to the worker. Returns the generated text when complete. */
  generate: (
    prompt: string,
    model?: string,
    params?: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      top_k?: number;
    },
  ) => Promise<string>;
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
 * useBrowserAI — React bindings for the shared BrowserWorkerManager.
 *
 * Unlike the previous implementation that owned its own Worker instance,
 * this hook subscribes to events from the shared singleton. The worker
 * stays alive as long as any consumer is active, preventing duplicate
 * model downloads.
 *
 * When `enabled` is false the hook desubscribes but does NOT terminate
 * the worker — other consumers (translateViaQwen) may still need it.
 */
export function useBrowserAI(enabled: boolean = true): UseBrowserAIReturn {
  const [isReady, setIsReady] = useState(() => browserWorker.isReady);
  const [isGenerating, setIsGenerating] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => {
        setIsReady(false);
        setIsGenerating(false);
        setStatus(null);
      });
      return;
    }

    // Ensure the worker exists (safe no-op if already created)
    browserWorker.ensureReady();

    const unsubscribe = browserWorker.subscribe((event: WorkerStatusEvent) => {
      switch (event.type) {
        case "ready":
          startTransition(() => {
            setIsReady(true);
            setIsGenerating(false);
            setStatus("AI model ready");
          });
          break;

        case "progress":
        case "download": {
          const pct = event.total
            ? Math.round((event.loaded! / event.total) * 100)
            : 0;
          startTransition(() => {
            setProgress(pct / 100);
            setStatus(
              pct > 0 ? `Loading model... ${pct}%` : "Loading model...",
            );
          });
          break;
        }

        case "error":
          startTransition(() => {
            setError(event.message);
            setIsGenerating(false);
            setStatus(null);
          });
          break;
      }
    });

    return unsubscribe;
  }, [enabled]);

  const generate = useCallback(
    async (
      prompt: string,
      model?: string,
      params?: {
        temperature?: number;
        max_tokens?: number;
        top_p?: number;
        top_k?: number;
      },
    ): Promise<string> => {
      setError(null);
      setResponse("");
      setIsGenerating(true);
      setProgress(0);

      try {
        const result = await browserWorker.generate(prompt, model, params);
        setResponse(result);
        setIsGenerating(false);
        setProgress(1);
        setStatus(null);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsGenerating(false);
        setStatus(null);
        return msg;
      }
    },
    [],
  );

  return { generate, isReady, isGenerating, response, error, progress, status };
}
