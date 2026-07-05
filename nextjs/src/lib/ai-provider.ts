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
  maxTokens: number = 4096,
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
  maxTokens: number = 4096,
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

/**
 * Validate a custom endpoint URL to prevent SSRF attacks.
 *
 * Rules:
 * - Must be a valid URL with http or https scheme.
 * - Must NOT point to private/reserved IP ranges (127.0.0.0/8,
 *   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16,
 *   ::1/128).
 * - Hostnames that resolve to private IPs at runtime cannot be
 *   prevented here, but this static check stops the most common
 *   SSRF vectors (cloud metadata, localhost services).
 */
function validateEndpointUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Endpoint must use http or https");
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block loopback / localhost
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0"
    ) {
      throw new Error("Endpoint must not point to localhost");
    }

    // Block private IPv4 ranges
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const first = parseInt(ipv4Match[1], 10);
      const second = parseInt(ipv4Match[2], 10);
      if (
        first === 10 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        first === 127 ||
        first === 0 ||
        (first === 169 && second === 254)
      ) {
        throw new Error("Endpoint must not point to a private IP range");
      }
    }

    return parsed.origin;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid URL";
    throw new Error(`Invalid provider endpoint: ${message}`);
  }
}

// ── OpenAI-Compatible ──

export async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 4096,
  temperature: number = 0.3,
): Promise<string> {
  // SSRF validation: reject private/internal endpoints
  const safeEndpoint = validateEndpointUrl(endpoint);
  const res = await fetch(
    `${safeEndpoint.replace(/\/$/, "")}/v1/chat/completions`,
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
