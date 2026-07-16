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
import { z } from "zod";

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
const LIBRE_TIMEOUT_MS = 1500;

// ── Ollama Translation ─────────────────────────────────────────────────────
// Uses TranslateGemma:4b for high-quality DE↔EN translation
// when the term map doesn't cover the text.

const OLLAMA_URL = "http://localhost:11434";
const OLLAMA_TRANSLATE_TIMEOUT_MS = 3_000;
const OLLAMA_PROBE_TIMEOUT_MS = 1_000;
const TRANSLATE_MODEL = "translategemma:4b";

// Language names for Ollama translation prompts
const OLLAMA_LANG_NAMES: Record<string, string> = {
  de: "German",
  en: "English",
  tr: "Turkish",
  ar: "Arabic",
  fr: "French",
  es: "Spanish",
  pl: "Polish",
  uk: "Ukrainian",
  ru: "Russian",
};

// ── Translation Result Cache ─────────────────────────────────────────────────
// LRU-like cache: maps "text::targetLang" → translated string.
// Prevents redundant translations of the same text within and across requests.
const TRANSLATION_CACHE = new Map<string, string>();
const CACHE_MAX = 500;

function cacheKey(text: string, targetLang: string): string {
  return `${text}::${targetLang}`;
}

function getCachedTranslation(
  text: string,
  targetLang: string,
): string | undefined {
  // LRU: delete and re-set to move entry to end (most recently used)
  const key = cacheKey(text, targetLang);
  if (!TRANSLATION_CACHE.has(key)) return undefined;
  const value = TRANSLATION_CACHE.get(key)!;
  TRANSLATION_CACHE.delete(key);
  TRANSLATION_CACHE.set(key, value);
  return value;
}

function setCachedTranslation(
  text: string,
  targetLang: string,
  result: string,
): void {
  const key = cacheKey(text, targetLang);
  // If key exists, delete first so re-insert goes to end (LRU)
  if (TRANSLATION_CACHE.has(key)) {
    TRANSLATION_CACHE.delete(key);
  } else if (TRANSLATION_CACHE.size >= CACHE_MAX) {
    // Evict oldest entry (Map preserves insertion order — first key is LRU)
    const firstKey = TRANSLATION_CACHE.keys().next();
    if (!firstKey.done) TRANSLATION_CACHE.delete(firstKey.value);
  }
  TRANSLATION_CACHE.set(key, result);
}

// Per-process cache: once we know Ollama is unreachable, skip it entirely.
let ollamaReachable: boolean | null = null;
let ollamaCheckInFlight: Promise<boolean> | null = null;

async function probeOllama(): Promise<boolean> {
  if (ollamaReachable !== null) return ollamaReachable;
  if (ollamaCheckInFlight) return ollamaCheckInFlight;
  ollamaCheckInFlight = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        OLLAMA_PROBE_TIMEOUT_MS,
      );
      const res = await fetch(`${OLLAMA_URL}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const ok = res.ok;
      ollamaReachable = ok;
      if (ok) console.log(`[Translate] Ollama reachable at ${OLLAMA_URL}`);
      else console.warn(`[Translate] Ollama not reachable at ${OLLAMA_URL}`);
      return ok;
    } catch {
      ollamaReachable = false;
      console.warn(
        `[Translate] Ollama not reachable at ${OLLAMA_URL} — disabling Ollama translation`,
      );
      return false;
    }
  })();
  return ollamaCheckInFlight;
}

async function callOllamaTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  // Only DE↔EN supported via TranslateGemma
  const supported = new Set(["de", "en"]);
  if (!supported.has(sourceLang) || !supported.has(targetLang)) return null;
  if (sourceLang === targetLang) return text;

  // Quick check — skip if Ollama is not running
  if (!(await probeOllama())) return null;

  const direction =
    sourceLang === "de" ? "German to English" : "English to German";
  const prompt = `Translate the following legal text from ${direction}. Return only the translation, no explanations.

${sourceLang === "de" ? "German" : "English"}: ${text}

${targetLang === "en" ? "English" : "German"}:`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      OLLAMA_TRANSLATE_TIMEOUT_MS,
    );

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 512,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { response: string };
      const translated = data.response?.trim();
      if (translated && translated !== text) return translated;
    }
    return null;
  } catch {
    return null;
  }
}

// ── English→German Legal Term Map ─────────────────────────────────────────
// Used for fast-path search query translation (no API call needed)

const EN_DE_TERM_MAP: Record<string, string> = {
  // ── Core Legal ──
  accident: "Unfall",
  "accident on road": "Verkehrsunfall",
  "car accident": "Autounfall",
  "traffic accident": "Verkehrsunfall",
  "my rights": "Rechte",
  rights: "Rechte",
  "what are my rights": "Rechte",
  help: "Hilfe",
  "legal advice": "Rechtsberatung",
  situation: "Sachverhalt",
  problem: "Problem",
  question: "Frage",
  obligation: "Pflicht",
  responsibility: "Haftung",
  liability: "Haftung",
  duty: "Pflicht",
  claim: "Anspruch",
  entitled: "Anspruch",
  entitlement: "Anspruch",
  contract: "Vertrag",
  // ── Criminal Law (Strafrecht) ──
  theft: "Diebstahl",
  burglary: "Einbruch",
  robbery: "Raub",
  assault: "Körperverletzung",
  "grievous bodily harm": "schwere Körperverletzung",
  "bodily harm": "Körperverletzung",
  fraud: "Betrug",
  embezzlement: "Untreue",
  "money laundering": "Geldwäsche",
  "drug offense": "Betäubungsmitteldelikt",
  drugs: "Betäubungsmittel",
  "criminal offense": "Straftat",
  crime: "Straftat",
  "criminal complaint": "Strafanzeige",
  "press charges": "Strafanzeige",
  "criminal proceedings": "Strafverfahren",
  "criminal defense": "Strafverteidigung",
  "defense lawyer": "Strafverteidiger",
  "self-defense": "Notwehr",
  "self defence": "Notwehr",
  evidence: "Beweis",
  witness: "Zeuge",
  "search warrant": "Durchsuchungsbefehl",
  arrest: "Festnahme",
  bail: "Kaution",
  probation: "Bewährung",
  fine: "Geldstrafe",
  prison: "Freiheitsstrafe",
  imprisonment: "Freiheitsstrafe",
  "suspended sentence": "Bewährungsstrafe",
  "prior conviction": "Vorstrafe",
  "criminal record": "Führungszeugnis",
  police: "Polizei",
  investigation: "Ermittlungsverfahren",
  indictment: "Anklage",
  verdict: "Urteil",
  sentence: "Urteil",
  // ── Family Law (Familienrecht) ──
  divorce: "Scheidung",
  separation: "Trennung",
  custody: "Sorgerecht",
  "joint custody": "gemeinsames Sorgerecht",
  "visitation rights": "Umgangsrecht",
  "child support": "Kindesunterhalt",
  alimony: "Unterhalt",
  "spousal support": "Ehegattenunterhalt",
  maintenance: "Unterhalt",
  marriage: "Ehe",
  wedding: "Eheschließung",
  "civil partnership": "Lebenspartnerschaft",
  adoption: "Adoption",
  "foster care": "Pflegekind",
  "parental leave": "Elternzeit",
  "parental allowance": "Elterngeld",
  "child benefit": "Kindergeld",
  paternity: "Vaterschaft",
  guardianship: "Vormundschaft",
  "name change": "Namensänderung",
  "domestic violence": "häusliche Gewalt",
  "protection order": "Schutzanordnung",
  "restraining order": "Schutzanordnung",
  // ── Social Law / Health (Sozialrecht) ──
  "social security": "Sozialversicherung",
  "health insurance": "Krankenversicherung",
  "statutory health insurance": "gesetzliche Krankenversicherung",
  "private health insurance": "private Krankenversicherung",
  "long-term care insurance": "Pflegeversicherung",
  "nursing care": "Pflege",
  "care insurance": "Pflegeversicherung",
  pension: "Rente",
  retirement: "Rente",
  "old-age pension": "Altersrente",
  disability: "Behinderung",
  disabled: "Behinderung",
  "sick leave": "Krankschreibung",
  "sick note": "Krankschreibung",
  "medical certificate": "ärztliche Bescheinigung",
  "incapacity to work": "Arbeitsunfähigkeit",
  rehabilitation: "Rehabilitation",
  unemployment: "Arbeitslosigkeit",
  "unemployment benefit": "Arbeitslosengeld",
  "citizen's benefit": "Bürgergeld",
  welfare: "Sozialhilfe",
  "housing benefit": "Wohngeld",
  "maternity leave": "Mutterschutz",
  "maternity benefit": "Mutterschaftsgeld",
  "sick pay": "Krankengeld",
  "accident insurance": "Unfallversicherung",
  // ── Employment Law (Arbeitsrecht) ──
  // Common English labor termination terms
  fire: "Kündigung",
  fired: "Kündigung",
  firing: "Kündigung",
  fires: "Kündigung",
  "laid off": "Entlassung",
  layoff: "Entlassung",
  sacked: "Entlassung",
  dismissal: "Kündigung",
  "wrongful dismissal": "Kündigungsschutz",
  "unfair dismissal": "Kündigungsschutz",
  "unfairly dismissed": "Kündigungsschutz",
  terminated: "Kündigung",
  termination: "Kündigung",
  "notice period": "Kündigungsfrist",
  "labor law": "Arbeitsrecht",
  "labour law": "Arbeitsrecht",
  "employment contract": "Arbeitsvertrag",
  "without notice": "fristlose Kündigung",
  "without warning": "fristlose Kündigung",
  "my job": "meine Arbeit",
  job: "Arbeit",
  employment: "Arbeitsverhältnis",
  "employment relationship": "Arbeitsverhältnis",
  employer: "Arbeitgeber",
  employee: "Arbeitnehmer",
  "works council": "Betriebsrat",
  "collective agreement": "Tarifvertrag",
  "minimum wage": "Mindestlohn",
  overtime: "Überstunden",
  holiday: "Urlaub",
  vacation: "Urlaub",
  "annual leave": "Jahresurlaub",
  "sick day": "Krankheitstag",
  "part-time": "Teilzeit",
  "fixed-term": "befristet",
  "probation period": "Probezeit",
  severance: "Abfindung",
  "reference letter": "Arbeitszeugnis",
  "non-compete": "Wettbewerbsverbot",
  // ── Housing Law (Mietrecht) ──
  "rent reduction": "Mietminderung",
  "rental agreement": "Mietvertrag",
  landlord: "Vermieter",
  tenant: "Mieter",
  "deposit return": "Kaution Rückzahlung",
  rent: "Miete",
  rental: "Miete",
  "rent increase": "Mieterhöhung",
  "rent cap": "Mietpreisbremse",
  "operating costs": "Betriebskosten",
  utilities: "Nebenkosten",
  "heating costs": "Heizkosten",
  "security deposit": "Kaution",
  "notice of termination": "Kündigung",
  eviction: "Räumung",
  "lease agreement": "Mietvertrag",
  subletting: "Untervermietung",
  apartment: "Wohnung",
  condominium: "Eigentumswohnung",
  renovation: "Renovierung",
  modernization: "Modernisierung",
  mold: "Schimmel",
  "damage deposit": "Kaution",
  neighbor: "Nachbar",
  "noise complaint": "Lärmbelästigung",
  construction: "Bau",
  "building permit": "Baugenehmigung",
  // ── Traffic Law (Verkehrsrecht) ──
  "traffic violation": "Verkehrsverstoß",
  speeding: "Geschwindigkeitsüberschreitung",
  "red light": "Rotlichtverstoß",
  parking: "Parken",
  "parking ticket": "Knöllchen",
  "drunk driving": "Trunkenheit am Steuer",
  DUI: "Trunkenheit am Steuer",
  "license suspension": "Fahrerlaubnisentzug",
  "license revocation": "Fahrerlaubnisentzug",
  points: "Punkte",
  "fine notice": "Bußgeldbescheid",
  "speeding ticket": "Bußgeldbescheid",
  "driving ban": "Fahrverbot",
  "driving license": "Führerschein",
  "driver's license": "Führerschein",
  insurance: "Versicherung",
  "liability insurance": "Haftpflichtversicherung",
  "property damage": "Sachschaden",
  "personal injury": "Personenschaden",
  compensation: "Schadensersatz",
  damages: "Schadensersatz",
  "hit and run": "Fahrerflucht",
  "traffic law": "Straßenverkehrsrecht",
  "road traffic": "Straßenverkehr",
  "traffic rules": "Straßenverkehrsordnung",
  highway: "Autobahn",
  "speed limit": "Geschwindigkeitsbegrenzung",
  pedestrian: "Fußgänger",
  cyclist: "Radfahrer",
  towing: "Abschleppen",
  breakdown: "Panne",
  "roadside assistance": "Pannenhilfe",
  "vehicle registration": "Fahrzeugzulassung",
  "car tax": "Kfz-Steuer",
  inspection: "Hauptuntersuchung",
  TÜV: "Hauptuntersuchung",
  "comprehensive insurance": "Vollkaskoversicherung",
  "partial comprehensive": "Teilkaskoversicherung",
  // ── Consumer Law (Verbraucherschutz) ──
  "consumer protection": "Verbraucherschutz",
  warranty: "Gewährleistung",
  withdrawal: "Widerruf",
  "right of withdrawal": "Widerrufsrecht",
  "cancellation policy": "Widerrufsbelehrung",
  defective: "mangelhaft",
  defect: "Mangel",
  "defective product": "Sachmangel",
  guarantee: "Garantie",
  "purchase price": "Kaufpreis",
  "purchase contract": "Kaufvertrag",
  "sales contract": "Kaufvertrag",
  "distance selling": "Fernabsatz",
  "online purchase": "Online-Kauf",
  "digital content": "digitale Inhalte",
  "product liability": "Produkthaftung",
  recall: "Rückruf",
  refund: "Rückerstattung",
  return: "Rücksendung",
  repair: "Nachbesserung",
  replacement: "Ersatzlieferung",
  "price reduction": "Minderung",
  "general terms": "AGB",
  "terms and conditions": "AGB",
  consumer: "Verbraucher",
  "consumer center": "Verbraucherzentrale",
  "debt collection": "Mahnverfahren",
  "dunning letter": "Mahnung",
  "collection agency": "Inkassobüro",
  insolvency: "Insolvenz",
  bankruptcy: "Insolvenz",
  "private insolvency": "Privatinsolvenz",
  "debt relief": "Restschuldbefreiung",
  foreclosure: "Zwangsversteigerung",
  // ── Finance / Tax Law (Steuerrecht) ──
  tax: "Steuer",
  "income tax": "Einkommensteuer",
  "value added tax": "Umsatzsteuer",
  "sales tax": "Umsatzsteuer",
  "corporate tax": "Körperschaftsteuer",
  "trade tax": "Gewerbesteuer",
  "property tax": "Grundsteuer",
  "inheritance tax": "Erbschaftsteuer",
  "gift tax": "Schenkungsteuer",
  "tax return": "Steuererklärung",
  "tax assessment": "Steuerbescheid",
  "tax deduction": "Steuerabzug",
  allowance: "Freibetrag",
  "tax-free": "steuerfrei",
  "tax advisor": "Steuerberater",
  "tax audit": "Betriebsprüfung",
  "tax evasion": "Steuerhinterziehung",
  interest: "Zinsen",
  loan: "Darlehen",
  mortgage: "Hypothek",
  credit: "Kredit",
  investment: "Kapitalanlage",
  securities: "Wertpapiere",
  stock: "Aktie",
  "capital gains": "Kapitalerträge",
  // ── Public / Administrative Law (Öffentliches Recht) ──
  "administrative act": "Verwaltungsakt",
  "administrative court": "Verwaltungsgericht",
  authority: "Behörde",
  "government agency": "Behörde",
  "public office": "Amt",
  official: "Amtsträger",
  citizenship: "Staatsangehörigkeit",
  naturalization: "Einbürgerung",
  residence: "Aufenthalt",
  "residence permit": "Aufenthaltserlaubnis",
  "settlement permit": "Niederlassungserlaubnis",
  visa: "Visum",
  asylum: "Asyl",
  refugee: "Flüchtling",
  deportation: "Abschiebung",
  immigration: "Einwanderung",
  "integration course": "Integrationskurs",
  "public service": "öffentlicher Dienst",
  "civil servant": "Beamter",
  "freedom of information": "Informationsfreiheit",
  "data protection": "Datenschutz",
  privacy: "Datenschutz",
  // ── Inheritance / Estate ──
  inheritance: "Erbschaft",
  "inheritance law": "Erbrecht",
  will: "Testament",
  "last will": "Testament",
  estate: "Nachlass",
  heir: "Erbe",
  beneficiary: "Erbe",
  legatee: "Vermächtnisnehmer",
  executor: "Testamentsvollstrecker",
  "probate court": "Nachlassgericht",
  "right of inheritance": "Erbrecht",
  "compulsory portion": "Pflichtteil",
  // ── Procedural / General ──
  notice: "Frist",
  deadline: "Frist",
  "statute of limitations": "Verjährung",
  objection: "Widerspruch",
  appeal: "Berufung",
  lawsuit: "Klage",
  litigation: "Rechtsstreit",
  court: "Gericht",
  lawyer: "Rechtsanwalt",
  attorney: "Rechtsanwalt",
  judge: "Richter",
  "power of attorney": "Vollmacht",
  "legal fees": "Rechtsanwaltskosten",
  "court fees": "Gerichtskosten",
  "legal aid": "Prozesskostenhilfe",
  mediation: "Mediation",
  arbitration: "Schiedsverfahren",
  settlement: "Vergleich",
  injunction: "Einstweilige Verfügung",
  enforcement: "Zwangsvollstreckung",
  garnishment: "Pfändung",
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
  // Exact match first
  if (EN_DE_TERM_MAP[lower]) return EN_DE_TERM_MAP[lower];
  // Collect ALL matching terms, preferring longer (more specific) ones
  const matches: Array<{
    en: string;
    de: string;
    length: number;
    pos: number;
  }> = [];
  for (const [en, de] of Object.entries(EN_DE_TERM_MAP)) {
    const idx = lower.indexOf(en);
    if (idx !== -1) {
      matches.push({ en, de, length: en.length, pos: idx });
    }
  }
  if (matches.length === 0) return null;
  // Sort by match position (earlier = better), then by length (longer = more specific)
  matches.sort((a, b) => a.pos - b.pos || b.length - a.length);
  // Remove overlaps: if a match is contained within another, keep the longer one
  const filtered: typeof matches = [];
  for (const m of matches) {
    const isContained = filtered.some(
      (f) => m.pos >= f.pos && m.pos + m.length <= f.pos + f.length,
    );
    if (!isContained) filtered.push(m);
  }
  // Return all top non-overlapping terms joined
  return [...new Set(filtered.map((m) => m.de))].slice(0, 3).join(" ");
}

/**
 * Collect ALL non-overlapping English→German term matches from a query.
 * Used to build a richer German search query when term-mapping is the only option.
 */
function findAllEnDeMatches(query: string): string[] {
  const lower = query.toLowerCase().trim();
  const matches: Array<{ en: string; de: string; pos: number; end: number }> =
    [];
  for (const [en, de] of Object.entries(EN_DE_TERM_MAP)) {
    const idx = lower.indexOf(en);
    if (idx !== -1) {
      matches.push({ en, de, pos: idx, end: idx + en.length });
    }
  }
  // Sort by position, then by length descending (prefer longer match at same position)
  matches.sort((a, b) => a.pos - b.pos || b.end - b.pos - (a.end - a.pos));
  // Remove overlapping matches, keeping the longer one
  const filtered: typeof matches = [];
  for (const m of matches) {
    const overlaps = filtered.some((f) => m.pos < f.end && m.end > f.pos);
    if (!overlaps) filtered.push(m);
  }
  return [...new Set(filtered.map((m) => m.de))];
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

  // Fast path: term mapping (collect ALL matching terms, not just first)
  const allTerms = findAllEnDeMatches(query);
  if (allTerms.length > 0) {
    const termResult = allTerms.join(" ");
    console.log(`[Translate] Term-mapped EN→DE: "${query}" → "${termResult}"`);
    return termResult;
  }

  // Ollama TranslateGemma:4b fallback (higher quality than LibreTranslate)
  const ollamaResult = await callOllamaTranslate(query, "en", "de");
  if (ollamaResult) {
    console.log(
      `[Translate] Ollama TranslateGemma EN→DE: "${query}" → "${ollamaResult}"`,
    );
    return ollamaResult;
  }

  // LibreTranslate fallback (auto-detect source language)
  const apiResult = await callLibreTranslate(query, "auto", "de");
  if (apiResult) {
    console.log(`[Translate] LibreTranslate →DE: "${query}" → "${apiResult}"`);
    return apiResult;
  }

  // Final fallback: strip stop words and keep key English terms
  const STOP_WORDS = new Set([
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "may",
    "might",
    "must",
    "can",
    "could",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "it",
    "they",
    "them",
    "their",
    "this",
    "that",
    "these",
    "those",
    "in",
    "on",
    "at",
    "by",
    "to",
    "for",
    "of",
    "with",
    "from",
    "into",
    "about",
    "and",
    "or",
    "but",
    "not",
    "what",
    "which",
    "who",
    "whom",
    "how",
    "when",
    "where",
    "why",
    "if",
    "then",
    "else",
    "so",
    "no",
    "off",
    "out",
    "up",
    "down",
    "just",
    "very",
    "too",
    "really",
    "already",
    "also",
    "get",
    "got",
    "need",
    "want",
    "ask",
    "tell",
    "know",
    "think",
  ]);
  const keyTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 6)
    .join(" ");
  if (keyTerms) {
    console.log(
      `[Translate] No translation available, using key terms: "${query}" → "${keyTerms}"`,
    );
    return keyTerms;
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

  // Skip translation if text isn't actually German-like
  // (prevents wasting time trying to translate English category keys, boilerplate, etc.)
  if (!isLikelyGerman(text)) {
    return text;
  }

  // Check cache first
  const cached = getCachedTranslation(text, targetLanguage);
  if (cached !== undefined) return cached;

  let result: string;

  // Fast path: German→English term mapping
  if (targetLanguage === "en" && !text.startsWith("Search focused on")) {
    const termMatch = findDeEnTermMatch(text);
    if (termMatch) {
      console.log(
        `[Translate] Term-mapped DE→EN: "${text.slice(0, 40)}..." → "${termMatch}"`,
      );
      result = termMatch;
      setCachedTranslation(text, targetLanguage, result);
      return result;
    }

    // Ollama TranslateGemma:4b fallback (higher quality than LibreTranslate)
    const ollamaResult = await callOllamaTranslate(text, "de", "en");
    if (ollamaResult) {
      console.log(
        `[Translate] Ollama TranslateGemma DE→EN: "${text.slice(0, 40)}..."`,
      );
      result = ollamaResult;
      setCachedTranslation(text, targetLanguage, result);
      return result;
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
      result = apiResult;
      setCachedTranslation(text, targetLanguage, result);
      return result;
    }
  }

  console.log(
    `[Translate] DE→${targetLanguage} unavailable for: "${text.slice(0, 40)}..."`,
  );
  result = text;
  setCachedTranslation(text, targetLanguage, result);
  return result;
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
