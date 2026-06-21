"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ChatMode, ChatSettings, DEFAULT_CHAT_SETTINGS } from "../lib/types";
import { SYSTEM_PROMPT } from "../lib/chat";

const STORAGE_KEY = "glv_chat_settings";

interface ChatContextType {
  settings: ChatSettings;
  updateSettings: (patch: Partial<ChatSettings>) => void;
  mode: ChatMode;
  setMode: (m: ChatMode) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ChatSettings>(() => {
    const base = { ...DEFAULT_CHAT_SETTINGS };
    if (!base.ollamaParams.system_prompt) {
      base.ollamaParams.system_prompt = SYSTEM_PROMPT;
    }
    // Synchronize with localStorage on initial mount.
    // During SSR this safely falls back to defaults; on SPA navigation
    // it picks up saved settings immediately without an effect cycle.
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const loaded = JSON.parse(raw);
          // Auto-migrate legacy 9090 port to new 9000 standard
          if (loaded.brokerUrl === "http://localhost:9090") {
            loaded.brokerUrl = "http://localhost:9000";
          }
          // Ensure system prompt is synced if empty in storage
          if (!loaded.ollamaParams?.system_prompt) {
            loaded.ollamaParams = {
              ...(loaded.ollamaParams || DEFAULT_CHAT_SETTINGS.ollamaParams),
              system_prompt: SYSTEM_PROMPT,
            };
          }
          const merged = { ...base, ...loaded };
          delete (merged as Partial<ChatSettings>).apiKey;
          return merged;
        }
      } catch {}
    }
    return base;
  });
  const [mounted, setHydrated] = useState(false);

  // Standard hydration guard: marks the component as client-hydrated
  // so child content becomes visible only after localStorage state is applied.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  const updateSettings = (patch: Partial<ChatSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    // Persist settings to localStorage WITHOUT the apiKey
    const { apiKey: _, ...persistable } = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
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
      {mounted ? children : <div className="opacity-0">{children}</div>}
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
