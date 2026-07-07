export interface Law {
  key: string;
  title: string;
  alt_title: string;
  category: string;
  authority: string;
  status: string;
  jurisdiction: string;
  last_changed: string;
  source: string;
  total_norms: number;
}

export interface Norm {
  law_key: string;
  law_title: string;
  category: string;
  norm_id: string;
  norm_title: string;
  content: string;
}

export interface LawSearchResult {
  key: string;
  title: string;
  category: string;
  relevance: number;
  normHits: number;
  relevantNorms: Array<{
    normId: string;
    title: string;
    content: string;
  }>;
}

// ── Chat Modes ──

export type ChatMode = "local" | "cloud" | "browser" | "basic";

export type CloudProvider = "openai" | "anthropic" | "openai-compatible";

export const MODE_LABELS: Record<
  ChatMode,
  { label: string; description: string }
> = {
  local: {
    label: "Local AI",
    description: "Connects directly to Ollama running on your machine (ollama serve). Works from any device — your browser reaches your local Ollama via localhost:11434. Use any Ollama model; recommended: 'german-legal' (6.6GB) for legal analysis, 'qwen2.5:1.5b-translate' (1GB) for translations.",
  },
  cloud: {
    label: "Cloud AI",
    description:
      "Uses your API key to call OpenAI, Anthropic, or any OpenAI-compatible provider. Translations use a lightweight single-field response for speed.",
  },
  browser: {
    label: "Browser AI",
    description:
      "Runs Qwen3-0.6B ONNX model in your browser (~570MB download). Handles all 9 languages. Fully private — no data leaves your machine.",
  },
  basic: {
    label: "Basic Search",
    description:
      "Searches laws and shows relevant paragraphs. No AI generation. No translation — switch to Browser AI, Cloud AI, or Local AI for multilingual support.",
  },
};

// ── Language Support ──

export type AppLanguage =
  | "de"
  | "en"
  | "tr"
  | "ar"
  | "fr"
  | "es"
  | "pl"
  | "uk"
  | "ru";

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  de: "Deutsch",
  en: "English",
  tr: "Türkçe",
  ar: "العربية",
  fr: "Français",
  es: "Español",
  pl: "Polski",
  uk: "Українська",
  ru: "Русский",
};

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  de: "German",
  en: "English",
  tr: "Turkish",
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  pl: "Polish",
  uk: "Ukrainian",
  ru: "Russian",
};

// ── Ollama Parameters ──

export interface OllamaParams {
  temperature: number;
  top_p: number;
  top_k: number;
  max_tokens: number;
  system_prompt: string;
}

export const DEFAULT_OLLAMA_PARAMS: OllamaParams = {
  temperature: 0.3,
  top_p: 0.9,
  top_k: 40,
  max_tokens: 8192,
  system_prompt: "", // Will be populated from SYSTEM_PROMPT in chat.ts if empty
};

export interface ChatSettings {
  mode: ChatMode;
  language: AppLanguage;
  // Local AI
  brokerUrl: string;
  ollamaParams: OllamaParams;
  // Cloud AI
  provider: CloudProvider;
  model: string;
  customEndpoint: string;
  // Browser AI
  browserModel: string;
}

export const BROWSER_MODELS = [
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    name: "Qwen3 (0.6B)",
    size: "~570MB",
    description: "Best quality multilingual model for 9-language translation and basic chat. Recommended for desktop devices. Shared across Browser AI and Basic modes for norm translations.",
  },
  {
    id: "onnx-community/gemma-3-270m-it-ONNX",
    name: "Gemma 3 (270M)",
    size: "~275MB",
    description: "Lightweight multilingual model by Google DeepMind. Supports 140+ languages, fits most devices. Faster than Qwen3 but slightly less accurate for legal translation.",
  },
];

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  mode: "basic",
  language: "en",
  brokerUrl: "http://localhost:11434",
  ollamaParams: DEFAULT_OLLAMA_PARAMS,
  provider: "openai",
  model: "gpt-4o-mini",
  customEndpoint: "",
  browserModel: "onnx-community/Qwen3-0.6B-ONNX",
};

export interface CitedLaw {
  law_key: string;
  norm_id: string;
  law_title: string;
  /** Truncated norm content for AI context (client-side only). */
  content?: string;
}

// ── Norm Explanations ──

export interface NormExplanation {
  norm_id: string;
  law_key: string;
  law_title: string;
  lang: AppLanguage;
  translation: string;
  summary: string;
  implications: string;
  next_steps: string;
  disclaimer: string;
  is_official?: boolean;
}
