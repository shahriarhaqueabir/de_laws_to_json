"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ChatMode, ChatSettings, DEFAULT_CHAT_SETTINGS } from "../lib/types";
import { SYSTEM_PROMPT } from "../lib/chat";

const STORAGE_KEY = "glv_chat_settings";

// ── SSRF Protection: Broker URL validation ──
// Only allow localhost/loopback addresses to prevent SSRF attacks
const BROKER_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isValidBrokerUrl(url: string): boolean {
  return BROKER_URL_REGEX.test(url);
}

function sanitizeBrokerUrl(
  url: string,
  fallback: string = "http://localhost:9000",
): string {
  if (isValidBrokerUrl(url)) return url;
  // Also allow empty/undefined (use default)
  if (!url || url.trim() === "") return fallback;
  // Invalid URL — log warning and return fallback
  console.warn(
    `[SSRF] Invalid broker URL rejected: "${url}". Using fallback: ${fallback}`,
  );
  return fallback;
}

interface ChatContextType {
  settings: ChatSettings;
  updateSettings: (patch: Partial<ChatSettings>) => void;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

function loadSavedSettings(): ChatSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw);
      // Auto-migrate legacy ports to new 9000 standard
      if (
        loaded.brokerUrl === "http://localhost:9090" ||
        loaded.brokerUrl === "http://localhost:11434"
      ) {
        loaded.brokerUrl = "http://localhost:9000";
      }
      // SSRF mitigation: reject non-localhost broker URLs
      loaded.brokerUrl = sanitizeBrokerUrl(loaded.brokerUrl);
      // Ensure system prompt is synced if empty in storage
      if (!loaded.ollamaParams?.system_prompt) {
        loaded.ollamaParams = {
          ...(loaded.ollamaParams || DEFAULT_CHAT_SETTINGS.ollamaParams),
          system_prompt: SYSTEM_PROMPT,
        };
      }
      return loaded;
    }
  } catch {}
  return null;
}

function buildDefaultSettings(): ChatSettings {
  const base = { ...DEFAULT_CHAT_SETTINGS };
  if (!base.ollamaParams.system_prompt) {
    base.ollamaParams.system_prompt = SYSTEM_PROMPT;
  }
  // Use NEXT_PUBLIC_BROKER_URL if available (with SSRF validation)
  if (typeof window !== "undefined") {
    const envBrokerUrl = process.env.NEXT_PUBLIC_BROKER_URL;
    if (envBrokerUrl) {
      base.brokerUrl = sanitizeBrokerUrl(envBrokerUrl, base.brokerUrl);
    }
  }
  return base;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Always initialize with defaults — matches SSR output exactly.
  // This eliminates hydration mismatches between server and client.
  const [settings, setSettings] = useState<ChatSettings>(buildDefaultSettings);

  // On mount: load saved settings from localStorage and apply them.
  // This runs after hydration, so no SSR mismatch.
  useEffect(() => {
    const saved = loadSavedSettings();
    if (saved) {
      setSettings((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  const updateSettings = (patch: Partial<ChatSettings>) => {
    // SSRF mitigation: validate broker URL before saving
    const sanitizedPatch = { ...patch };
    if (sanitizedPatch.brokerUrl !== undefined) {
      sanitizedPatch.brokerUrl = sanitizeBrokerUrl(sanitizedPatch.brokerUrl);
    }
    const next = { ...settings, ...sanitizedPatch };
    setSettings(next);
    // Persist settings to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("glv_settings_updated"));
  };

  const setMode = (mode: ChatMode) => updateSettings({ mode });

  return (
    <ChatContext.Provider
      value={{
        settings,
        updateSettings,
        mode: settings.mode,
        setMode,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
