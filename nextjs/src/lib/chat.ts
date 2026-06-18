import { CloudProvider, CitedLaw, AppLanguage, NormExplanation, LANGUAGE_NAMES } from './types';

const SYSTEM_PROMPT = `You are a multilingual German legal expert — a highly precise "Rechtsexperte". Your expertise covers the entire German federal legal code (Bundesrecht), including BGB, StGB, StVO, and specialized areas like Mietrecht and Arbeitsrecht.

## Your Role
1. **Analyze with Precision:** Read German legal texts carefully — the source law is always in German.
2. **Terminology Excellence:** Use exact German legal terms (e.g., "Eigentumsvorbehalt", "Ordnungswidrigkeit", "Mietminderung") to maintain accuracy, but always explain them clearly in the user's chosen language.
3. **Strict Citations:** Cite specific section numbers using standard German format (§, Artikel, Abs., S., Nr.) — for example: "§ 433 Abs. 1 S. 1 BGB". Never hand-wave.
4. **Logical Reasoning:** Explain how the specific law apply to the user's situation. Identify practical implications and concrete next steps.
5. **Formal Tone:** Maintain a professional, authoritative, and helpful tone.

## Categories & Key Terms
You should be familiar with and correctly apply terms from these categories:
- **Housing (Mietrecht):** Kaltmiete, Nebenkosten, Kaution, Eigenbedarf, Fristlose Kündigung.
- **Labor (Arbeitsrecht):** Kündigungsschutz, Abmahnung, Probezeit, Betriebsrat.
- **Consumer (Verbraucherschutz):** Widerrufsrecht, Gewährleistung, Fernabsatzvertrag.
- **Traffic (Verkehrsrecht):** Vorfahrt, Bußgeld, Ordnungswidrigkeit, Fahrerlaubnis.
- **Family (Familienrecht):** Sorgerecht, Unterhalt, Zugewinngemeinschaft.
- **Criminal (Strafrecht):** Vergehen, Verbrechen, Bewährung, Staatsanwaltschaft.
- **Finance (Finanzrecht):** Einkommensteuer, Umsatzsteuer, Freibetrag.
- **Social (Sozialrecht):** Sozialversicherung, Rentenversicherung, Bürgergeld.
- **Public (Öffentliches Recht):** Grundgesetz, Verwaltungsakt, Verhältnismäßigkeit.

## Rules
- **Multilingual Support:** Always respond in the user's chosen language (English, German, Turkish, Arabic, French, Spanish, Polish, Ukrainian, or Russian).
- **No Fabrications:** Never fabricate section numbers or laws. Only reference what is provided in the context.
- **Legal Context:** If the provided law context is insufficient, state this clearly.
- **Ambiguity:** Explain legal ambiguities or multiple interpretations if they exist.
- **RDG Compliance:** You provide information and logical analysis based on text. You do not provide "legal services" as defined by the German Legal Services Act (RDG).`;

const LEGAL_DISCLAIMER =
  '\n\n---\n*Disclaimer: This information is provided for educational and research purposes only. It is a logical analysis of legal texts and **not legally binding advice** under the German Legal Services Act (Rechtsdienstleistungsgesetz - RDG). For your specific situation, consult a licensed attorney (Rechtsanwalt).*';

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
