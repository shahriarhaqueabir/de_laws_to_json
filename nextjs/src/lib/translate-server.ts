/**
 * Server-side translation service for the German Law Vault.
 *
 * Provides bidirectional translation across all 9 supported languages using:
 * 1. Legal term mapping (fast path — no API call)
 * 2. LibreTranslate API (free, ~30 req/min on public instance)
 * 3. Graceful fallback when translation is unavailable
 *
 * Language codes: de, en, tr, ar, fr, es, pl, uk, ru
 */

import type { AppLanguage } from "./types";

// ── LibreTranslate Language Code Mapping ──────────────────────────────────
// LibreTranslate uses ISO 639-1 codes which match our AppLanguage type
// except for some edge cases.

const LIBRE_LANG_CODES: Record<string, string> = {
  de: "de",
  en: "en",
  tr: "tr",
  ar: "ar",
  fr: "fr",
  es: "es",
  pl: "pl",
  uk: "uk",
  ru: "ru",
};

const LIBRE_API_URL = "https://libretranslate.com/translate";
const LIBRE_TIMEOUT_MS = 5000;

// ── English→German Legal Term Map ─────────────────────────────────────────
// Used for fast-path search query translation (no API call needed)

const EN_DE_TERM_MAP: Record<string, string> = {
  accident: "Unfall",
  "accident on road": "Verkehrsunfall",
  "car accident": "Autounfall",
  "traffic accident": "Verkehrsunfall",
  dismissal: "Kündigung",
  "wrongful dismissal": "Kündigungsschutz",
  termination: "Kündigung",
  "rent reduction": "Mietminderung",
  "rental agreement": "Mietvertrag",
  landlord: "Vermieter",
  tenant: "Mieter",
  "deposit return": "Kaution Rückzahlung",
  "fine notice": "Bußgeldbescheid",
  "speeding ticket": "Bußgeldbescheid",
  custody: "Sorgerecht",
  divorce: "Scheidung",
  inheritance: "Erbschaft",
  will: "Testament",
  contract: "Vertrag",
  "consumer protection": "Verbraucherschutz",
  warranty: "Gewährleistung",
  "personal injury": "Personenschaden",
  compensation: "Schadensersatz",
  damages: "Schadensersatz",
  "health insurance": "Krankenversicherung",
  "social security": "Sozialversicherung",
  pension: "Rente",
  unemployment: "Arbeitslosigkeit",
  "labor law": "Arbeitsrecht",
  "employment contract": "Arbeitsvertrag",
  notice: "Frist",
  deadline: "Frist",
  "statute of limitations": "Verjährung",
  objection: "Widerspruch",
  appeal: "Berufung",
  lawsuit: "Klage",
  court: "Gericht",
  lawyer: "Rechtsanwalt",
  attorney: "Rechtsanwalt",
  judge: "Richter",
  "power of attorney": "Vollmacht",
  "data protection": "Datenschutz",
  privacy: "Datenschutz",
  "general terms": "AGB",
  "terms and conditions": "AGB",
  "driving ban": "Fahrverbot",
  "driving license": "Führerschein",
  insurance: "Versicherung",
  "liability insurance": "Haftpflichtversicherung",
  "property damage": "Sachschaden",
  theft: "Diebstahl",
  fraud: "Betrug",
  assault: "Körperverletzung",
  "hit and run": "Fahrerflucht",
  "traffic law": "Straßenverkehrsrecht",
  "road traffic": "Straßenverkehr",
  neighbor: "Nachbar",
  "noise complaint": "Lärmbelästigung",
  construction: "Bau",
  "building permit": "Baugenehmigung",
  residence: "Aufenthalt",
  "residence permit": "Aufenthaltserlaubnis",
  citizenship: "Staatsangehörigkeit",
  asylum: "Asyl",
  immigration: "Einwanderung",
  marriage: "Ehe",
  "registered partnership": "Lebenspartnerschaft",
  adoption: "Adoption",
  "parental leave": "Elternzeit",
  "child support": "Kindesunterhalt",
  alimony: "Unterhalt",
  insolvency: "Insolvenz",
  bankruptcy: "Insolvenz",
  "debt collection": "Mahnverfahren",
  "dunning letter": "Mahnung",
  foreclosure: "Zwangsversteigerung",
};

// ── German→English Legal Term Map (reverse lookup) ────────────────────────
// Built by reversing the EN→DE map so we can translate German results back

function buildDeEnTermMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [en, de] of Object.entries(EN_DE_TERM_MAP)) {
    // If multiple English terms map to the same German term, keep first
    if (!map[de]) {
      map[de] = en;
    }
  }
  return map;
}

const DE_EN_TERM_MAP = buildDeEnTermMap();

// ── German Word Detection ─────────────────────────────────────────────────

const GERMAN_WORDS = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "eines",
  "und",
  "oder",
  "aber",
  "sondern",
  "nicht",
  "kein",
  "keine",
  "ist",
  "sind",
  "war",
  "waren",
  "hat",
  "haben",
  "hatte",
  "wird",
  "werden",
  "wurde",
  "kann",
  "können",
  "konnte",
  "muss",
  "müssen",
  "musste",
  "soll",
  "sollen",
  "sollte",
  "darf",
  "dürfen",
  "durfte",
  "bei",
  "mit",
  "nach",
  "vor",
  "zu",
  "auf",
  "aus",
  "in",
  "über",
  "unter",
  "für",
  "gegen",
  "ohne",
  "um",
  "durch",
  "§",
  "bgb",
  "stgb",
  "stvo",
  "owig",
  "vvg",
  "mietrecht",
  "arbeitsrecht",
  "familienrecht",
  "verkehrsrecht",
  "sozialrecht",
  "steuerrecht",
  "kündigung",
  "mietminderung",
  "schadensersatz",
  "unfall",
  "bußgeld",
  "klage",
  "widerspruch",
]);

function isLikelyGerman(query: string): boolean {
  const words = query.toLowerCase().split(/\s+/);
  if (words.length === 0) return false;
  const germanWordCount = words.filter((w) => GERMAN_WORDS.has(w)).length;
  return germanWordCount / words.length > 0.3;
}

// ── Term Match Helpers ────────────────────────────────────────────────────

function findEnDeTermMatch(query: string): string | null {
  const lower = query.toLowerCase().trim();
  if (EN_DE_TERM_MAP[lower]) return EN_DE_TERM_MAP[lower];
  for (const [en, de] of Object.entries(EN_DE_TERM_MAP)) {
    if (lower.includes(en)) return de;
  }
  return null;
}

function findDeEnTermMatch(query: string): string | null {
  const lower = query.toLowerCase().trim();
  if (DE_EN_TERM_MAP[lower]) return DE_EN_TERM_MAP[lower];
  for (const [de, en] of Object.entries(DE_EN_TERM_MAP)) {
    if (lower.includes(de)) return en;
  }
  return null;
}

// ── LibreTranslate API Call ───────────────────────────────────────────────

async function callLibreTranslate(
  text: string,
  source: string,
  target: string,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIBRE_TIMEOUT_MS);

    const res = await fetch(LIBRE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { translatedText: string };
      if (data.translatedText && data.translatedText !== text) {
        return data.translatedText;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Translate any non-German query to German for Qdrant E5-small search.
 * Uses term mapping first (fast), then LibreTranslate as fallback.
 */
export async function translateQueryToGerman(query: string): Promise<string> {
  if (!query.trim()) return query;

  // Already German — return as-is
  if (isLikelyGerman(query)) {
    console.log(`[Translate] Query is already German: "${query}"`);
    return query;
  }

  // Fast path: term mapping
  const termMatch = findEnDeTermMatch(query);
  if (termMatch) {
    console.log(`[Translate] Term-mapped EN→DE: "${query}" → "${termMatch}"`);
    return termMatch;
  }

  // LibreTranslate fallback
  const apiResult = await callLibreTranslate(query, "en", "de");
  if (apiResult) {
    console.log(
      `[Translate] LibreTranslate EN→DE: "${query}" → "${apiResult}"`,
    );
    return apiResult;
  }

  console.log(
    `[Translate] No translation available, using original: "${query}"`,
  );
  return query;
}

/**
 * Translate German text to any supported language.
 * Used for displaying German search results/norms in the user's language.
 */
export async function translateFromGerman(
  text: string,
  targetLanguage: AppLanguage,
): Promise<string> {
  if (!text.trim() || targetLanguage === "de") return text;

  // Fast path: German→English term mapping
  if (targetLanguage === "en") {
    const termMatch = findDeEnTermMatch(text);
    if (termMatch) {
      console.log(
        `[Translate] Term-mapped DE→EN: "${text.slice(0, 40)}..." → "${termMatch}"`,
      );
      return termMatch;
    }
  }

  // LibreTranslate: German → target language
  const targetCode = LIBRE_LANG_CODES[targetLanguage];
  if (targetCode) {
    const apiResult = await callLibreTranslate(text, "de", targetCode);
    if (apiResult) {
      console.log(
        `[Translate] LibreTranslate DE→${targetLanguage}: "${text.slice(0, 40)}..."`,
      );
      return apiResult;
    }
  }

  console.log(
    `[Translate] DE→${targetLanguage} unavailable for: "${text.slice(0, 40)}..."`,
  );
  return text;
}

/**
 * Generic bidirectional translation between any two supported languages.
 * Falls back gracefully if the API is unavailable.
 */
export async function translateText(
  text: string,
  sourceLanguage: AppLanguage | "auto",
  targetLanguage: AppLanguage,
): Promise<string> {
  if (!text.trim() || sourceLanguage === targetLanguage) return text;

  // Direct paths optimized for our primary use case
  if (sourceLanguage === "en" && targetLanguage === "de") {
    return translateQueryToGerman(text);
  }
  if (sourceLanguage === "de") {
    return translateFromGerman(text, targetLanguage);
  }

  // Generic path via LibreTranslate
  const sourceCode =
    sourceLanguage === "auto" ? "auto" : LIBRE_LANG_CODES[sourceLanguage];
  const targetCode = LIBRE_LANG_CODES[targetLanguage];

  if (sourceCode && targetCode) {
    const apiResult = await callLibreTranslate(text, sourceCode, targetCode);
    if (apiResult) return apiResult;
  }

  return text;
}
