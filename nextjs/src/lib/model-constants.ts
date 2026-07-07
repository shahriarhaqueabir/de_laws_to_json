// Recommended models for Local (Ollama) AI mode.
// Users can pick ANY Ollama-compatible model — these are just defaults.
//
// ANALYSIS_MODEL (6.6GB) — Full legal analysis, multi-step reasoning, guidance.
//   Modelfile includes German law guardrails and citation rules.
//
// TRANSLATION_MODEL (1GB) — Lightweight Qwen 2.5 fine-tuned for precise
//   German-to-X section translations at temperature 0 for consistency.
export const ANALYSIS_MODEL = "german-legal:latest" as const;
export const TRANSLATION_MODEL = "qwen2.5:1.5b-translate" as const;
export const RECOMMENDED_LOCAL_MODELS = [ANALYSIS_MODEL, TRANSLATION_MODEL] as const;
export type RecommendedModel = (typeof RECOMMENDED_LOCAL_MODELS)[number];
