/**
 * BrowserWorkerManager — Shared singleton that owns the Transformers.js web worker.
 *
 * All consumers (useBrowserAI hook, translateViaQwen, Settings test) route
 * through this manager so only ONE chat.worker.ts is ever created, preventing
 * duplicate model downloads (~570 MB each).
 *
 * Features:
 *   - Single worker instance shared across the app
 *   - Timeouts on all requests (generation: 120s, translation: 60s)
 *   - Auto-restart on worker crash, rejecting dangling promises
 *   - Subscription API for reactive status (progress, ready, error)
 */

type PendingEntry = {
  resolve: (v: string) => void;
  reject: (e: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export type WorkerStatusEvent =
  | { type: "ready" }
  | { type: "progress" | "download"; loaded?: number; total?: number }
  | { type: "error"; message: string };

type StatusListener = (event: WorkerStatusEvent) => void;

class BrowserWorkerManager {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingEntry>();
  private listeners = new Set<StatusListener>();
  private _isReady = false;
  private restartCount = 0;
  private readonly MAX_RESTARTS = 3;

  /** Ensure the worker exists (no model init — call ensureReady after). */
  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    return this.worker;
  }

  private createWorker(): Worker {
    const worker = new Worker(
      new URL("../workers/chat.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent) => {
      const { status: s, id, output, error: workerError, ...rest } = event.data;

      switch (s) {
        case "ready":
          this._isReady = true;
          this.broadcast({ type: "ready" });
          this.resolvePending(id, output || "");
          break;

        case "progress":
        case "download":
          this.broadcast({
            type: s,
            loaded: rest.loaded,
            total: rest.total,
          });
          break;

        case "complete":
          this.resolvePending(id, output || "");
          break;

        case "error":
          this.rejectPending(id, new Error(workerError || "Unknown worker error"));
          break;
      }
    };

    worker.onerror = (err: ErrorEvent) => {
      const msg = err.message || "Worker crashed";
      this._isReady = false;

      // Reject all in-flight promises
      for (const [pid, entry] of this.pending) {
        clearTimeout(entry.timeout);
        entry.reject(new Error(msg));
      }
      this.pending.clear();

      this.broadcast({ type: "error", message: msg });
      this.restartWorker();
    };

    return worker;
  }

  private restartWorker(): void {
    if (this.restartCount >= this.MAX_RESTARTS) {
      this.worker?.terminate();
      this.worker = null;
      return;
    }
    this.restartCount++;
    this.worker?.terminate();
    this.worker = this.createWorker();
  }

  private send(
    data: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<string> {
    const id = crypto.randomUUID();
    const worker = this.getOrCreateWorker();

    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      worker.postMessage({ ...data, id });
    });
  }

  private resolvePending(id: string, value: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    entry.resolve(value);
    this.pending.delete(id);
  }

  private rejectPending(id: string, error: unknown): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    entry.reject(error);
    this.pending.delete(id);
  }

  private broadcast(event: WorkerStatusEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        // Silently skip listener errors
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Subscribe to worker status events. Returns an unsubscribe function.
   * If the worker is already ready, fires a "ready" event immediately.
   */
  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    if (this._isReady) {
      try {
        listener({ type: "ready" });
      } catch {
        // skip
      }
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Send a generation prompt to the worker (120s timeout). */
  async generate(
    prompt: string,
    model?: string,
    params?: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      top_k?: number;
    },
  ): Promise<string> {
    return this.send({ prompt, model, ...params }, 120_000);
  }

  /** Translate text via the cached Qwen model (60s timeout). */
  async translate(text: string, language: string): Promise<string> {
    return this.send({ task: "translate", text, language }, 60_000);
  }

  /**
   * Test connection — triggers model download and returns when ready.
   * Progress updates are broadcast to subscribers.
   */
  async testConnection(model?: string): Promise<string> {
    return this.send({ prompt: "INIT_ONLY", model }, 300_000);
  }

  /** Ensure the worker exists (safe to call even if already created). */
  ensureReady(): void {
    this.getOrCreateWorker();
  }

  /** Terminate the worker and reset state. */
  terminate(): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timeout);
      entry.reject(new Error("Worker terminated"));
    }
    this.pending.clear();
    this._isReady = false;
    this.restartCount = 0;
    this.worker?.terminate();
    this.worker = null;
  }

  get isReady(): boolean {
    return this._isReady;
  }
}

/** Singleton instance shared across the app. */
export const browserWorker = new BrowserWorkerManager();
