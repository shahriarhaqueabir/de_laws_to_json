import { CloudProvider, CitedLaw } from './types';

const SYSTEM_PROMPT = `You are a German law assistant. Your role is to:
1. Read the user's situation carefully.
2. Search through the provided legal context from German federal laws.
3. Explain which laws and paragraphs are relevant.
4. Apply logical reasoning to explain how the law likely applies.
5. Always note that this is non-binding guidance, not legal advice.
6. Be clear about uncertainty — if the text is ambiguous, say so.
7. Cite specific law keys and section numbers.

Always respond in the user's language (German or English).
Keep responses structured and easy to follow.`;

const LEGAL_DISCLAIMER =
  '\n\n---\n*This guidance is based on mathematical reasoning and logic applied to legal text. It is **not legally binding advice**. Consult a licensed attorney for your specific situation.*';

function buildUserPrompt(question: string, norms: CitedLaw[], context: string): string {
  return `Context from German laws:\n${context || '(No specific laws found)'}\n\nUser situation:\n${question}\n\nProvide guidance based on the relevant laws above. Include citations.`;
}

// ── OpenAI ──

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1024 }),
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Anthropic ──

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

// ── OpenAI-Compatible ──

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 1024 }),
  });
  if (!res.ok) throw new Error(`Provider API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Public API ──

export interface GenerateParams {
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
  question: string;
  norms: CitedLaw[];
  context: string;
}

export async function generateChatResponse(params: GenerateParams): Promise<string> {
  const { provider, apiKey, model, customEndpoint, question, context } = params;
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(question, params.norms, context) },
  ];

  let response: string;

  switch (provider) {
    case 'openai':
      response = await callOpenAI(apiKey, model, messages);
      break;
    case 'anthropic':
      response = await callAnthropic(apiKey, model, SYSTEM_PROMPT, [
        { role: 'user', content: buildUserPrompt(question, params.norms, context) },
      ]);
      break;
    case 'openai-compatible':
      response = await callOpenAICompatible(customEndpoint || 'https://api.openai.com', apiKey, model, messages);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return response + LEGAL_DISCLAIMER;
}

export { SYSTEM_PROMPT, LEGAL_DISCLAIMER, buildUserPrompt };
