/**
 * Shared AI provider implementations.
 *
 * Consolidates OpenAI, Anthropic, and OpenAI-compatible API calls
 * that were previously duplicated in chat.ts and guidance.ts.
 *
 * All functions return the raw text response on success and
 * throw on HTTP errors.
 */

// ── OpenAI ──

export async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1024,
  temperature: number = 0.3,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok)
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Anthropic ──

export async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1024,
  temperature: number = 0.3,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok)
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

// ── OpenAI-Compatible ──

export async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1024,
  temperature: number = 0.3,
): Promise<string> {
  const res = await fetch(
    `${endpoint.replace(/\/$/, "")}/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    },
  );
  if (!res.ok)
    throw new Error(`Provider API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ── Shared Constants ──

/**
 * RDG-compliant disclaimer appended to all AI-generated legal content.
 * Warns users that output is for informational/educational purposes
 * and does not constitute legal advice (Rechtsdienstleistung).
 */
export const LEGAL_DISCLAIMER = `\n\n---\n*Disclaimer: This information is provided for educational and informational purposes only. It is a logical analysis of legal texts and does not constitute legal advice (Rechtsdienstleistung) under the German Legal Services Act (Rechtsdienstleistungsgesetz - RDG). For advice specific to your situation, consult a licensed German attorney (Rechtsanwalt).*`;
