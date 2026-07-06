export const ANALYSIS_MODEL = "german-legal:latest" as const;
export const TRANSLATION_MODEL = "qwen2.5:1.5b-translate" as const;
export const REQUIRED_LOCAL_MODELS = [ANALYSIS_MODEL, TRANSLATION_MODEL] as const;
