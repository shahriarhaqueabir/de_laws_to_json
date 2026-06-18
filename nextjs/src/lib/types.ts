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

export type ChatMode = 'local' | 'cloud' | 'browser' | 'basic';

export type CloudProvider = 'openai' | 'anthropic' | 'openai-compatible';





export const MODE_LABELS: Record<ChatMode, { label: string; icon: string; description: string }> = {
  local: {
    label: 'Local AI',
    icon: '🔌',
    description: 'Uses Ollama on your machine via the local broker.',
  },
  cloud: {
    label: 'Cloud AI',
    icon: '☁️',
    description: 'Uses your API key to call OpenAI, Anthropic, or any OpenAI-compatible provider.',
  },
  browser: {
    label: 'Browser AI',
    icon: '🧠',
    description: 'Runs a Transformers.js model in your browser (~1GB download). Fully private.',
  },
  basic: {
    label: 'Basic Search',
    icon: '📄',
    description: 'Searches laws and shows relevant paragraphs. No AI generation.',
  },
};

// ── Language Support ──

export type AppLanguage = 'de' | 'en' | 'tr' | 'ar' | 'fr' | 'es' | 'pl' | 'uk' | 'ru';

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  tr: 'Türkçe',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
  pl: 'Polski',
  uk: 'Українська',
  ru: 'Русский',
};

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  de: 'German',
  en: 'English',
  tr: 'Turkish',
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  pl: 'Polish',
  uk: 'Ukrainian',
  ru: 'Russian',
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
  max_tokens: 1024,
  system_prompt: 'You are a multilingual German legal expert. Your role is to read the user\'s situation, search through provided German legal context, explain which laws and paragraphs are relevant, and apply logical reasoning to explain how the law likely applies. Cite specific law keys and section numbers.',
};

export interface ChatSettings {
  mode: ChatMode;
  language: AppLanguage;
  // Local AI
  brokerUrl: string;
  ollamaModel: string;
  ollamaParams: OllamaParams;
  // Cloud AI
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  mode: 'basic',
  language: 'en',
  brokerUrl: 'http://localhost:9000',
  ollamaModel: '',
  ollamaParams: DEFAULT_OLLAMA_PARAMS,
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  customEndpoint: '',
};

export interface CitedLaw {
  law_key: string;
  norm_id: string;
  law_title: string;
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
}
