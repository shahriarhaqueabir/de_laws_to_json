/**
 * Server-side query translation for Qdrant search.
 *
 * E5-small is multilingual but optimized for German passages.
 * English queries produce embeddings that don't match German documents well.
 * This utility detects non-German queries and translates them to German.
 */

// Common English→German legal term mapping (fast path, no API call)
const LEGAL_TERM_MAP: Record<string, string> = {
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

// Simple German word detection heuristic
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
  const germanWordCount = words.filter((w) => GERMAN_WORDS.has(w)).length;
  // If more than 30% of words are German-specific, treat as German
  return germanWordCount / words.length > 0.3;
}

function findTermMatch(query: string): string | null {
  const lower = query.toLowerCase().trim();
  // Check full phrase match first
  if (LEGAL_TERM_MAP[lower]) return LEGAL_TERM_MAP[lower];
  // Check partial match
  for (const [en, de] of Object.entries(LEGAL_TERM_MAP)) {
    if (lower.includes(en)) return de;
  }
  return null;
}

/**
 * Translates a query to German for better E5-small matching.
 * Uses term mapping for common legal terms (fast, no API call).
 * Falls back to original query if translation is not possible.
 */
export async function translateQueryToGerman(query: string): Promise<string> {
  if (!query.trim()) return query;

  // If already German, return as-is
  if (isLikelyGerman(query)) {
    return query;
  }

  // Try term mapping first (fast path)
  const termMatch = findTermMatch(query);
  if (termMatch) {
    console.log(`[Translate] Term-mapped "${query}" → "${termMatch}"`);
    return termMatch;
  }

  // Try LibreTranslate public API (free, no auth needed for small usage)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: query,
        source: "en",
        target: "de",
        format: "text",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as { translatedText: string };
      if (data.translatedText && data.translatedText !== query) {
        console.log(
          `[Translate] API translated "${query}" → "${data.translatedText}"`,
        );
        return data.translatedText;
      }
    }
  } catch {
    console.log(
      `[Translate] API unavailable, using original query: "${query}"`,
    );
  }

  // Fallback: return original query
  return query;
}
