/**
 * Model-aware prompt formatting utilities.
 *
 * Different models use different chat templates:
 *   - Qwen3 uses ChatML:  <|im_start|>system ... <|im_end|>
 *   - Gemma 3 uses:       <start_of_turn>system\n...<end_of_turn>
 */

export function isGemmaModel(modelId: string): boolean {
  return modelId.toLowerCase().includes("gemma");
}

export function buildSystemPrompt(systemContent: string, model: string): string {
  if (isGemmaModel(model)) {
    return `<start_of_turn>system\n${systemContent}<end_of_turn>`;
  }
  return `<|im_start|>system\n${systemContent}<|im_end|>`;
}

export function buildUserPrompt(userContent: string, model: string): string {
  if (isGemmaModel(model)) {
    return `<start_of_turn>user\n${userContent}<end_of_turn>`;
  }
  return `<|im_start|>user\n${userContent}<|im_end|>`;
}

export function buildAssistantPrefix(model: string): string {
  if (isGemmaModel(model)) {
    return "<start_of_turn>model\n";
  }
  return "<|im_start|>assistant\n";
}


/**
 * Strip model reasoning blocks (<think>...</think>) from output.
 * Common in Gemma 3, DeepSeek R1, QwQ, and other reasoning models.
 */
export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

export function buildFullPrompt(
  systemContent: string,
  userContent: string,
  model: string,
): string {
  return `${buildSystemPrompt(systemContent, model)}\n${buildUserPrompt(userContent, model)}\n${buildAssistantPrefix(model)}`;
}
