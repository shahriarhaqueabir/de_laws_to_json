import { CloudProvider, CitedLaw, AppLanguage, NormExplanation, LANGUAGE_NAMES } from './types';

const SYSTEM_PROMPT = `You are a multilingual German legal expert — the best damn lawyer in the house. Your expertise covers the entire German federal legal code (Bundesrecht). You think like a jurist and communicate like a trusted advisor.

## Your role
1. Read German legal texts carefully — the source law is always in German.
2. Explain the law in the user's chosen language with absolute clarity and precision.
3. Cite specific section numbers (§, Artikel, Paragraph) — never hand-wave.
4. Give practical implications: what this means for the person's situation.
5. Lay out concrete next steps the person can take.
6. Use a confident, precise, authoritative tone — you are their legal advisor.

## Rules
- The user's language may be English, German, Turkish, Arabic, French, Spanish, Polish, Ukrainian, or Russian. Always respond in the user's chosen language.
- When citing German legal terms, keep the original German term (e.g., "Eigentumsvorbehalt") but explain it in the user's language.
- If the law is ambiguous, state the ambiguity clearly and explain the range of possible interpretations.
- Structure your response so it's easy to follow — use short sections, clear headings, and plain language without dumbing it down.
- Never fabricate section numbers or laws. Only reference what is provided in the context.`;

const LEGAL_DISCLAIMER =
  '\n\n---\n*This explanation is based on mathematical reasoning and logic applied to the legal text. It is **not legally binding advice**. For your specific situation, consult a licensed attorney admitted in the relevant jurisdiction.*';

function buildUserPrompt(question: string, norms: CitedLaw[], context: string): string {
  return `Context from German laws:\n${context || '(No specific laws found)'}\n\nUser situation:\n${question}\n\nProvide guidance based on the relevant laws above. Include citations.`;
}

// ── OpenAI ──

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number = 1024,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
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
  maxTokens: number = 1024,
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
      max_tokens: maxTokens,
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
  maxTokens: number = 1024,
): Promise<string> {
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`Provider API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── GenerateParams ──

export interface GenerateParams {
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
  question: string;
  norms: CitedLaw[];
  context: string;
  language: AppLanguage;
}

export async function generateChatResponse(params: GenerateParams): Promise<string> {
  const { provider, apiKey, model, customEndpoint, question, context, language } = params;
  const langName = LANGUAGE_NAMES[language] || 'English';
  const systemWithLang = `${SYSTEM_PROMPT}\n\nThe user's language is: ${langName}. Always respond in ${langName}.`;

  const messages = [
    { role: 'system', content: systemWithLang },
    { role: 'user', content: buildUserPrompt(question, params.norms, context) },
  ];

  let response: string;

  switch (provider) {
    case 'openai':
      response = await callOpenAI(apiKey, model, messages);
      break;
    case 'anthropic':
      response = await callAnthropic(apiKey, model, systemWithLang, [
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

// ── Norm Explanation (Multilingual) ──

export interface ExplainParams {
  provider: CloudProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
  normId: string;
  lawKey: string;
  content: string;
  lang: AppLanguage;
}

const EXPLAIN_SYSTEM_PROMPT = `You are a precise multilingual legal translator and advisor. Your role is to explain German legal text to someone who does not speak German. You translate accurately, summarize clearly, identify practical implications, and recommend concrete next steps.

Rules:
- The source text is always German law. Read it carefully.
- Explain everything in the user's chosen language — not in German.
- Be precise about legal terms. When a German legal concept has no direct equivalent, keep the German term and explain it.
- Cite specific section references where applicable.
- Return ONLY valid JSON. No markdown, no code fences, no extra text.`;

export async function generateNormExplanation(params: ExplainParams): Promise<NormExplanation> {
  const { provider, apiKey, model, customEndpoint, normId, lawKey, content, lang } = params;
  const langName = LANGUAGE_NAMES[lang] || 'English';

  const systemMessage = EXPLAIN_SYSTEM_PROMPT;

  const userMessage = `Explain this German law section. Respond in ${langName}.

German text: ${content}

Return STRICT JSON with these exact fields:
{
  "translation": "accurate legal English translation of the German text",
  "summary": "what this means in simple terms in the user's language",
  "implications": "what this means practically for the person involved, written in the user's language",
  "next_steps": "concrete recommended actions the person can take, written in the user's language"
}`;

  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ];

  let raw: string;

  switch (provider) {
    case 'openai':
      raw = await callOpenAI(apiKey, model, messages, 2048);
      break;
    case 'anthropic':
      raw = await callAnthropic(apiKey, model, systemMessage, [
        { role: 'user', content: userMessage },
      ], 2048);
      break;
    case 'openai-compatible':
      raw = await callOpenAICompatible(customEndpoint || 'https://api.openai.com', apiKey, model, messages, 2048);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  // Strip markdown code fences if the AI wrapped the JSON
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed: Pick<NormExplanation, 'translation' | 'summary' | 'implications' | 'next_steps'>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback: if JSON parsing fails, wrap the raw text
    parsed = {
      translation: jsonStr,
      summary: jsonStr,
      implications: jsonStr,
      next_steps: jsonStr,
    };
  }

  return {
    norm_id: normId,
    law_key: lawKey,
    law_title: '',
    lang,
    translation: parsed.translation || '',
    summary: parsed.summary || '',
    implications: parsed.implications || '',
    next_steps: parsed.next_steps || '',
    disclaimer: LEGAL_DISCLAIMER.trim(),
  };
}

export { SYSTEM_PROMPT, LEGAL_DISCLAIMER, buildUserPrompt };
