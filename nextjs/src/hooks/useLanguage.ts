/**
 * useLanguage — Multilingual UI string hook.
 *
 * Provides a `t(key, vars?)` function for UI strings sourced from LANGUAGE_MAP.
 * The active language comes from ChatSettings. Falls back to English, then raw key.
 */

import { useCallback } from "react";
import { useChat } from "../components/chat-context";
import type { AppLanguage } from "../lib/types";
import { LANGUAGE_MAP } from "../lib/i18n";

export function useLanguage() {
  let language: AppLanguage = "en";

  // useChat may throw if called outside ChatProvider (e.g., test env)
  try {
    const { settings } = useChat();
    language = settings.language || "en";
  } catch {
    language = "en";
  }

  /**
   * Look up a UI string by key.
   * Supports `{n}` style variable interpolation.
   *
   * @example
   *   t("search.results_count", { n: 12 }) // → "12 Statutes Retrieved"
   */
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const strings = LANGUAGE_MAP[language] || LANGUAGE_MAP.en;
      let text = strings[key];
      if (!text) return LANGUAGE_MAP.en[key] || key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [language],
  );

  return { language, t };
}
