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

export interface ChatSettings {
  mode: ChatMode;
  // Local AI
  brokerUrl: string;
  // Cloud AI
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  mode: 'basic',
  brokerUrl: 'http://localhost:9000',
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  customEndpoint: '',
};

export const PROVIDER_MODELS: Record<CloudProvider, string[]> = {
  'openai': ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
  'anthropic': ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
  'openai-compatible': ['custom'],
};

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

export interface CitedLaw {
  law_key: string;
  norm_id: string;
  law_title: string;
}
