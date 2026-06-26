/**
 * useLanguage — English-only UI string hook.
 *
 * Provides a `t(key, vars?)` function for UI strings.
 * All strings are English. No language selection is exposed.
 */

import { useChat } from "../components/chat-context";

// ── English UI Strings ────────────────────────────────────────────────────

const UI_STRINGS: Record<string, string> = {
  "search.loading": "Searching...",
  "search.results_count": "{n} Statutes Retrieved",
  "search.empty": "No statutes found matching the inquiry parameters.",
  "search.error": "Failed to fetch search results.",
  "laws.loading": "Decrypting Statute...",
  "laws.not_found": "Law not found or could not be loaded.",
  "laws.norms_empty":
    "Statutory fragments not currently indexed in neural memory.",
  "search.awaiting": "Awaiting Inquiry",
  "search.init": "Initializing Search Environment...",
  "guidance.loading": "Analyzing Situation...",
  "common.error": "Operational Error",
  "nav.sign_in": "Sign In",
  "nav.sign_out": "Sign Out",
  "nav.search": "Search",
  "nav.guidance": "Guidance",
  "nav.bookmarks": "Bookmarks",
  "nav.chat": "Chat",
  "nav.settings": "Settings",
  "nav.laws": "Laws",
  "nav.api_docs": "API Docs",
  "footer.tagline": "Sub lege libertas",
  "footer.copyright":
    "© 2026 German Law Vault — Official Legal Intelligence Repository",
  "auth.title": "Welcome",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.sign_in_button": "Sign In",
  "auth.sign_up_button": "Create Account",
  "auth.no_account": "Don't have an account?",
  "auth.has_account": "Already have an account?",
  "auth.error_prefix": "Error",
  "chat.title": "Legal Advisor",
  "chat.placeholder": "Describe your legal situation...",
  "chat.send": "Send",
  "chat.settings": "Settings",
  "chat.local_offline": "Local Node Offline",
  "chat.startup_hint":
    "Start your local Ollama and broker to enable fully offline AI mode",
  "chat.mode_basic": "Basic",
  "chat.mode_browser": "Browser",
  "chat.mode_cloud": "Cloud",
  "chat.mode_local": "Local",
  "bookmarks.title": "My Bookmarks",
  "bookmarks.empty": "No bookmarks yet",
  "bookmarks.new_folder": "New Folder",
  "bookmarks.delete_folder": "Delete Folder",
  "guidance.title": "Legal Guidance",
  "guidance.describe": "Describe Your Situation",
  "guidance.analyze": "Analyze",
  "guidance.no_folder": "No folder selected",
  "guidance.history": "History",
  "settings.title": "Settings",
  "settings.api_key": "API Key",
  "settings.save": "Save",
  "settings.remove": "Remove",
  "settings.provider": "AI Provider",
  "settings.model": "Model",
  "search.placeholder": "Search German laws...",
  "search.no_results": "No results found",
};

/**
 * useLanguage — English-only UI string hook.
 *
 * Provides a `t(key, vars?)` function for UI strings.
 * Always resolves to English. No language selection is exposed.
 */
export function useLanguage() {
  const language = "en" as const;

  /**
   * Look up a UI string by key.
   * Supports `{n}` style variable interpolation.
   *
   * @example
   *   t("search.results_count", { n: 12 }) // → "12 Statutes Retrieved"
   */
  const t = (key: string, vars?: Record<string, string | number>): string => {
    let text = UI_STRINGS[key];
    if (!text) return key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };

  return { language, t };
}
