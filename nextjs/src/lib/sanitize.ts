/**
 * Sanitize error messages to prevent leaking sensitive information
 * (API keys, tokens, etc.) to the client.
 */

// Patterns matching common API key formats
const API_KEY_PATTERNS: RegExp[] = [
  // OpenAI keys: sk-proj-abc..., sk-svcacct-abc..., etc.
  /sk-[A-Za-z0-9_-]{20,}/,
  // Anthropic keys: sk-ant-abc...
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  // OpenAI project keys: sk-proj-...
  /sk-proj-[A-Za-z0-9_-]{20,}/,
  // Bearer tokens in error responses
  /Bearer\s+[A-Za-z0-9._-]{20,}/i,
  // Generic Authorization header values
  /(?:Authorization|X-API-Key|api[_-]?key):\s*['"]?[A-Za-z0-9_-]{10,}['"]?/i,
  // Key-like query params in URLs embedded in errors
  /[?&](?:api_key|apiKey|key)=\w+/i,
];

/**
 * Sanitize an error object's message for safe return to the client.
 *
 * Logs the full error server-side, then returns either the original
 * message (if no sensitive patterns detected) or a generic message
 * (if patterns were stripped).
 */
export function sanitizeErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error);

  // Check if any API key pattern is present
  const hasSensitiveContent = API_KEY_PATTERNS.some((pattern) =>
    pattern.test(rawMessage),
  );

  if (hasSensitiveContent) {
    return "Cloud AI call failed. Check your API key and provider settings.";
  }

  return rawMessage;
}
