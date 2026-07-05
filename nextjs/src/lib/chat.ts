import {
  CloudProvider,
  CitedLaw,
  AppLanguage,
  NormExplanation,
  LANGUAGE_NAMES,
} from "./types";
import {
  callOpenAI,
  callAnthropic,
  callOpenAICompatible,
  LEGAL_DISCLAIMER,
} from "./ai-provider";

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

function buildUserPrompt(
  question: string,
  norms: CitedLaw[],
  context: string,
): string {
  return `Context from German laws:\n${context || "(No specific laws found)"}\n\nUser situation:\n${question}\n\nProvide guidance based on the relevant laws above. Include citations.`;
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
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export async function generateChatResponse(
  params: GenerateParams,
): Promise<string> {
  const {
    provider,
    apiKey,
    model,
    customEndpoint,
    question,
    context,
    language,
    temperature,
    maxTokens,
    systemPrompt,
  } = params;
  const langName = LANGUAGE_NAMES[language] || "English";
  const baseSystem = systemPrompt || SYSTEM_PROMPT;
  const systemWithLang = `${baseSystem}\n\nThe user's language is: ${langName}. Always respond in ${langName}.`;

  const messages = [
    { role: "system", content: systemWithLang },
    { role: "user", content: buildUserPrompt(question, params.norms, context) },
  ];

  let response: string;

  switch (provider) {
    case "openai":
      response = await callOpenAI(
        apiKey,
        model,
        messages,
        maxTokens,
        temperature,
      );
      break;
    case "anthropic":
      response = await callAnthropic(
        apiKey,
        model,
        systemWithLang,
        [
          {
            role: "user",
            content: buildUserPrompt(question, params.norms, context),
          },
        ],
        maxTokens,
        temperature,
      );
      break;
    case "openai-compatible":
      response = await callOpenAICompatible(
        customEndpoint || "https://api.openai.com",
        apiKey,
        model,
        messages,
        maxTokens,
        temperature,
      );
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

const EXPLAIN_SYSTEM_PROMPT = `You are a precise multilingual legal translator. Your only task is to translate German legal text accurately into the requested language.

Rules:
- Translate the German legal text accurately into the user's requested language.
- Preserve legal terminology and nuance.
- Return ONLY a valid JSON object with a single "translation" field.
- No markdown, no code fences, no explanatory text, no notes.

Example response format:
{"translation": "The translated text goes here..."}`;

export async function generateNormExplanation(
  params: ExplainParams,
): Promise<NormExplanation> {
  const {
    provider,
    apiKey,
    model,
    customEndpoint,
    normId,
    lawKey,
    content,
    lang,
  } = params;
  const langName = LANGUAGE_NAMES[lang] || "English";

  const systemMessage = EXPLAIN_SYSTEM_PROMPT;

  const userMessage = `Translate this German law section to ${langName}. Return ONLY a JSON object with a "translation" field containing the translation.

German text:
${content}`;

  const messages = [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];

  let raw: string;

  switch (provider) {
    case "openai":
      raw = await callOpenAI(apiKey, model, messages, 2048);
      break;
    case "anthropic":
      raw = await callAnthropic(
        apiKey,
        model,
        systemMessage,
        [{ role: "user", content: userMessage }],
        2048,
      );
      break;
    case "openai-compatible":
      raw = await callOpenAICompatible(
        customEndpoint || "https://api.openai.com",
        apiKey,
        model,
        messages,
        2048,
      );
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

  let parsed: Pick<
    NormExplanation,
    "translation" | "summary" | "implications" | "next_steps"
  >;
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
    law_title: "",
    lang,
    translation: parsed.translation || "",
    summary: parsed.summary || "",
    implications: parsed.implications || "",
    next_steps: parsed.next_steps || "",
    disclaimer: LEGAL_DISCLAIMER.trim(),
  };
}

export { SYSTEM_PROMPT, LEGAL_DISCLAIMER, buildUserPrompt };
