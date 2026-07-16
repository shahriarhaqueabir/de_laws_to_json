"use client";

import { useState, useEffect, useCallback } from "react";
import { useChat } from "../components/chat-context";
import { useAuth } from "../components/auth-context";
import { useApiKeyStatus } from "./useApiKeyStatus";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ServiceStatus {
  label: string;
  status: "ok" | "warn" | "error" | "unknown";
  message: string;
}

export interface SystemStatus {
  /** Overall worst status across all services */
  overall: "ok" | "warn" | "error" | "unknown";
  /** Per-service statuses */
  services: ServiceStatus[];
  /** Current AI mode */
  mode: string;
  /** Timestamp of last check */
  lastChecked: string;
}

// ── SSRF-safe localhost check (same regex as useChatStrategy) ────────────────

const LOCAL_URL_REGEX =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSystemStatus(): SystemStatus {
  const { settings, mode } = useChat();
  const { user } = useAuth();
  const { hasStoredKey, loading: keyLoading } = useApiKeyStatus();

  const [lastChecked, setLastChecked] = useState<string>(
    new Date().toISOString(),
  );
  const [ollamaReachable, setOllamaReachable] = useState<
    boolean | null
  >(null);
  const [serverDiag, setServerDiag] = useState<
    Record<string, { status: string; message: string }> | null
  >(null);
  const [browserAiSupported, setBrowserAiSupported] = useState<
    boolean | null
  >(null);

  // ── Check Ollama from browser ──────────────────────────────────────────
  const checkOllama = useCallback(async () => {
    if (mode !== "local") {
      setOllamaReachable(null);
      return;
    }
    const url = settings.brokerUrl || "http://localhost:11434";
    if (!LOCAL_URL_REGEX.test(url)) {
      setOllamaReachable(false);
      return;
    }
    try {
      const res = await fetch(`${url}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      setOllamaReachable(res.ok);
    } catch {
      setOllamaReachable(false);
    }
  }, [mode, settings.brokerUrl]);

  // ── Check server-side diagnostics ──────────────────────────────────────
  const checkServer = useCallback(async () => {
    try {
      const res = await fetch("/api/diagnostics", {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      setServerDiag(data.checks || null);
    } catch {
      setServerDiag(null);
    }
  }, []);

  // ── Check Browser AI support ───────────────────────────────────────────
  const checkBrowserAi = useCallback(() => {
    if (mode !== "browser") {
      setBrowserAiSupported(null);
      return;
    }
    const supported =
      typeof Worker !== "undefined" &&
      typeof WebAssembly !== "undefined" &&
      (typeof SharedArrayBuffer !== "undefined" ||
        "webkitRequestFileSystem" in window);
    setBrowserAiSupported(supported);
  }, [mode]);

  // ── Run all checks ─────────────────────────────────────────────────────
  const runChecks = useCallback(() => {
    checkOllama();
    checkServer();
    checkBrowserAi();
    setLastChecked(new Date().toISOString());
  }, [checkOllama, checkServer, checkBrowserAi]);

  // Initial check + poll every 30s
  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, 30000);
    return () => clearInterval(interval);
  }, [runChecks]);

  // ── Build status object ────────────────────────────────────────────────
  const services: ServiceStatus[] = [];

  // 1. Supabase
  const sb = serverDiag?.supabase;
  services.push({
    label: "Database",
    status: sb?.status === "ok" ? "ok" : sb ? "error" : "unknown",
    message: sb?.message || "Not checked",
  });

  // 2. Qdrant
  const qd = serverDiag?.qdrant;
  services.push({
    label: "Vector Search",
    status: qd?.status === "ok" ? "ok" : qd ? "error" : "unknown",
    message: qd?.message || "Not checked",
  });

  // 3. Ollama (only when mode === "local")
  if (mode === "local") {
    services.push({
      label: "Local AI (Ollama)",
      status:
        ollamaReachable === true
          ? "ok"
          : ollamaReachable === false
            ? "error"
            : "unknown",
      message:
        ollamaReachable === true
          ? "Reachable"
          : ollamaReachable === false
            ? "Unreachable — start Ollama (ollama serve)"
            : "Checking...",
    });
  }

  // 4. Cloud API key (only when mode === "cloud")
  if (mode === "cloud") {
    const noKey = !hasStoredKey && !keyLoading;
    services.push({
      label: "Cloud API Key",
      status: noKey ? "warn" : hasStoredKey ? "ok" : "unknown",
      message: noKey
        ? "No API key configured — add one in Settings"
        : hasStoredKey
          ? "Configured"
          : "Checking...",
    });
  }

  // 5. Browser AI (only when mode === "browser")
  if (mode === "browser") {
    services.push({
      label: "Browser AI",
      status:
        browserAiSupported === true
          ? "ok"
          : browserAiSupported === false
            ? "warn"
            : "unknown",
      message:
        browserAiSupported === true
          ? "Supported"
          : browserAiSupported === false
            ? "Limited support — Web Worker or WASM may be unavailable"
            : "Checking...",
    });
  }

  // 6. Authentication
  services.push({
    label: "Authentication",
    status: user ? "ok" : "warn",
    message: user
      ? `Signed in as ${user.email || user.id.slice(0, 8)}`
      : "Not signed in — some features require login",
  });

  // Overall status = worst case
  const priority: Record<string, number> = {
    error: 0,
    warn: 1,
    unknown: 2,
    ok: 3,
  };
  const worst = services.reduce(
    (worst, s) =>
      (priority[s.status] || 0) < (priority[worst] || 3) ? s.status : worst,
    "ok" as ServiceStatus["status"],
  );

  return {
    overall: worst,
    services,
    mode,
    lastChecked,
  };
}
