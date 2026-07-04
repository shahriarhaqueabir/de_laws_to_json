#!/usr/bin/env npx tsx
/**
 * scripts/translate-i18n.ts
 *
 * Batch translation script for i18n files.
 * Reads the English source of truth (en.ts) and generates real translations
 * for all 8 target languages using Ollama (mistral:latest).
 *
 * Run: cd nextjs && npx tsx scripts/translate-i18n.ts
 */

import fs from "node:fs";
import path from "node:path";

// ── Configuration ──────────────────────────────────────────────────────────

const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "mistral:latest";

const I18N_DIR = path.resolve(import.meta.dirname, "..", "src", "lib", "i18n");

const ALL_LANGUAGES: Array<{
  code: string;
  name: string;
  englishName: string;
}> = [
  { code: "de", name: "German", englishName: "German" },
  { code: "tr", name: "Turkish", englishName: "Turkish" },
  { code: "ar", name: "Arabic", englishName: "Arabic" },
  { code: "fr", name: "French", englishName: "French" },
  { code: "es", name: "Spanish", englishName: "Spanish" },
  { code: "pl", name: "Polish", englishName: "Polish" },
  { code: "uk", name: "Ukrainian", englishName: "Ukrainian" },
  { code: "ru", name: "Russian", englishName: "Russian" },
];

// Allow targeting specific languages via CLI args
// Usage: npx tsx scripts/translate-i18n.ts [lang codes...]
//   e.g. npx tsx scripts/translate-i18n.ts ar fr
//   If no args given, all languages are processed
const CLI_TARGETS = process.argv.slice(2).map((a) => a.toLowerCase());

// ── Types ──────────────────────────────────────────────────────────────────

type TranslationMap = Record<string, string>;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Read and parse the English source file to extract key-value pairs.
 */
function parseEnglishFile(filePath: string): TranslationMap {
  const content = fs.readFileSync(filePath, "utf-8");
  const map: TranslationMap = {};

  const lines = content.split("\n");
  let inExport = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("export const EN:")) {
      inExport = true;
      continue;
    }
    if (!inExport) continue;
    if (line === "};") break;

    // Match: "key": "value",
    const match = line.match(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/);
    if (match) {
      const [, key, value] = match;
      map[key] = value;
    }
  }

  return map;
}

/**
 * Build the system prompt for translation.
 */
function buildSystemPrompt(languageName: string, langCode: string): string {
  // Language-specific guidance for better domain terminology
  const domainHints: Record<string, string> = {
    tr:
      "IMPORTANT: Use correct Turkish legal terminology:\n" +
      "  - 'Statute' / 'Law' = 'Kanun' (NOT 'Türk Anne Sözleşmesi' or 'Yazı Kodu')\n" +
      "  - 'norms' = 'normlar' or 'hükümler'\n" +
      "  - 'Search' = 'Arama'\n" +
      "  - 'Chat' = 'Sohbet'\n" +
      "  - 'Bookmarks' = 'Yer İmleri'\n" +
      "  - 'Settings' = 'Ayarlar'\n" +
      "  - 'Sign In' = 'Giriş Yap'\n" +
      "  - 'Sign Out' = 'Çıkış Yap'\n" +
      "  - 'Guidance' = 'Rehberlik'\n" +
      "  - 'legal advisor' = 'hukuk danışmanı'\n" +
      "  - 'AI advisor' = 'AI danışmanı'\n" +
      "  - 'Start Setup' / 'Set Up' = 'Kurulumu Başlat'\n" +
      "  - 'Complete' related = 'Tamamlandı'\n",
    ar:
      "IMPORTANT: Use correct Arabic legal terminology:\n" +
      "  - 'Statute' / 'Law' = 'قانون'\n" +
      "  - 'norms' = 'قواعد' or 'أحكام'\n" +
      "  - 'Chat' = 'محادثة'\n" +
      "  - 'Bookmarks' = 'إشارات مرجعية'\n" +
      "  - 'legal advisor' = 'مستشار قانوني'\n" +
      "  - 'AI advisor' = 'مستشار ذكي'\n",
  };

  const hint = domainHints[langCode] ?? "";

  return `${hint}You are a professional translator specializing in legal technology and user interfaces. Translate UI strings for a German law search application from English to ${languageName}.

Rules:
1. Return ONLY valid JSON with the exact same keys as provided
2. Keep all placeholder patterns like {n} and {date} intact and in the same position
3. Keep all HTML-like tags intact (e.g., <em>, </em>)
4. Use natural, idiomatic ${languageName} suitable for a professional legal web application
5. Do NOT add any explanation, commentary, or markdown formatting
6. The JSON must be parseable — use \\" for escaped quotes inside strings
7. Translate the meaning, not word-by-word, but stay faithful to the original`.trim();
}

/**
 * Call Ollama and return the generated text.
 */
async function callOllama(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: systemPrompt,
      prompt: userPrompt,
      stream: false,
      options: {
        temperature: 0.1, // low temperature for consistency
        num_predict: 8192, // enough for ~90 translated keys per language
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Ollama API error (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as { response?: string };
  if (!data.response) {
    throw new Error("Ollama returned empty response");
  }

  return data.response;
}

/**
 * Try to extract a JSON object from the model's response.
 * Tries: direct parse, JSON code block extraction, brace-finding.
 */
function extractJson(raw: string): Record<string, string> | null {
  // Strip any non-JSON prefix (BOM, whitespace, explanatory text)
  let cleaned = raw.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch {
    // not valid JSON as-is
  }

  // Try extracting from a JSON code block
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]);
    } catch {
      // fall through
    }
  }

  // Try finding the first { and last } — recursively try shorter slices
  // in case there is trailing text after the JSON object
  let braceStart = cleaned.indexOf("{");
  let braceEnd = cleaned.lastIndexOf("}");
  while (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = cleaned.slice(braceStart, braceEnd + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // try a shorter slice
    }
    // Move braceEnd leftwards to find the next closing brace
    const nextBraceEnd = cleaned.lastIndexOf("}", braceEnd - 1);
    if (nextBraceEnd > braceStart && nextBraceEnd < braceEnd) {
      braceEnd = nextBraceEnd;
    } else {
      // No more closing braces before this one — give up on this start
      break;
    }
  }

  // Also try finding any JSON anywhere in the text using a loose regex
  // Match from first { to last } but with progressive trimming
  if (braceStart !== -1) {
    // Try from the first { to the very last }
    const fullCandidate = cleaned.slice(braceStart);
    // Try progressively smaller slices from the end
    for (let i = fullCandidate.length - 1; i > braceStart; i--) {
      if (fullCandidate[i] === "}") {
        try {
          const parsed = JSON.parse(fullCandidate.slice(0, i + 1));
          if (typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

/**
 * Verify the translation has all original keys and no corrupted placeholders.
 */
function verifyTranslation(
  original: TranslationMap,
  translated: TranslationMap,
  langCode: string,
): string[] {
  const issues: string[] = [];
  const placeholderPattern = /\{[a-z_]+\}/g;

  for (const key of Object.keys(original)) {
    if (!(key in translated)) {
      issues.push(`Missing key: "${key}"`);
      continue;
    }

    const origPlaceholders = original[key].match(placeholderPattern) ?? [];
    const transPlaceholders = translated[key].match(placeholderPattern) ?? [];

    if (origPlaceholders.join(",") !== transPlaceholders.join(",")) {
      issues.push(
        `Corrupted placeholders in "${key}": ` +
          `expected [${origPlaceholders.join(", ")}], ` +
          `got [${transPlaceholders.join(", ")}]`,
      );
    }
  }

  return issues;
}

/**
 * Write the translated TypeScript file.
 */
function writeTranslationFile(
  langCode: string,
  langName: string,
  translations: TranslationMap,
): void {
  const code = langCode.toUpperCase();
  const filePath = path.join(I18N_DIR, `${langCode}.ts`);

  const lines: string[] = [
    `// src/lib/i18n/${langCode}.ts — ${langName} UI Strings`,
    `import { EN } from "./en";`,
    "",
    `export const ${code}: Record<string, string> = {`,
  ];

  for (const [key, value] of Object.entries(translations)) {
    // Escape backslashes, backticks, and ${} but keep quotes as-is (we wrap in double quotes)
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    lines.push(`  "${key}": "${escaped}",`);
  }

  lines.push("};");
  lines.push(""); // trailing newline

  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  console.log(`  ✓ Wrote ${filePath}`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("German Law Vault — i18n Translation Script");
  console.log(`Ollama: ${OLLAMA_URL} | Model: ${OLLAMA_MODEL}\n`);

  // 1. Parse English source
  const enPath = path.join(I18N_DIR, "en.ts");
  if (!fs.existsSync(enPath)) {
    console.error(`✗ English source not found: ${enPath}`);
    process.exit(1);
  }

  const enKeys = parseEnglishFile(enPath);
  const keyCount = Object.keys(enKeys).length;
  console.log(`Found ${keyCount} keys in en.ts\n`);

  // Quick sanity: check Ollama is reachable
  try {
    const healthResp = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
    });
    if (!healthResp.ok) {
      throw new Error(`HTTP ${healthResp.status}`);
    }
    console.log("✓ Ollama is reachable\n");
  } catch (err) {
    console.error(
      `✗ Cannot reach Ollama at http://localhost:11434. Is it running?`,
    );
    console.error(`  ${err}`);
    process.exit(1);
  }

  const userPrompt = JSON.stringify(enKeys, null, 2);

  // Filter languages based on CLI args (if any)
  const languages =
    CLI_TARGETS.length > 0
      ? ALL_LANGUAGES.filter((l) => CLI_TARGETS.includes(l.code))
      : ALL_LANGUAGES;

  if (languages.length === 0) {
    console.log(`No matching languages for: ${CLI_TARGETS.join(", ")}`);
    console.log(`Available: ${ALL_LANGUAGES.map((l) => l.code).join(", ")}`);
    process.exit(0);
  }

  if (CLI_TARGETS.length > 0) {
    console.log(`Targeting: ${languages.map((l) => l.code).join(", ")}\n`);
  }

  for (const lang of languages) {
    console.log(`\n── Translating to ${lang.name} (${lang.code}) ──`);

    // Check if the file already has real translations (not the stub)
    const existingPath = path.join(I18N_DIR, `${lang.code}.ts`);
    if (fs.existsSync(existingPath) && CLI_TARGETS.length === 0) {
      const existingContent = fs.readFileSync(existingPath, "utf-8");
      // If file doesn't contain "...EN" spread, it might already be translated
      if (!existingContent.includes("...EN")) {
        console.log(
          `  ⚠ ${lang.code}.ts appears to already have real translations. Skipping.`,
        );
        continue;
      }
    }

    // 2. Call Ollama for translation
    const systemPrompt = buildSystemPrompt(lang.name, lang.code);

    console.log(`  Calling Ollama (${OLLAMA_MODEL})...`);
    let raw: string;
    try {
      raw = await callOllama(systemPrompt, userPrompt);
    } catch (err) {
      console.error(`  ✗ Ollama call failed for ${lang.code}: ${err}`);
      console.log(`  → Falling back to English values for ${lang.code}`);
      // Fallback: use the English values as-is
      writeTranslationFile(lang.code, lang.name, enKeys);
      continue;
    }

    // 3. Parse the response
    const parsed = extractJson(raw);
    if (!parsed || Object.keys(parsed).length === 0) {
      console.error(`  ✗ Failed to parse Ollama response for ${lang.code}`);
      console.error(`  Raw response preview: ${raw.slice(0, 300)}`);
      console.log(`  → Falling back to English values for ${lang.code}`);
      writeTranslationFile(lang.code, lang.name, enKeys);
      continue;
    }

    // 4. Verify
    const issues = verifyTranslation(enKeys, parsed, lang.code);
    if (issues.length > 0) {
      console.warn(`  ⚠ ${issues.length} issues found:`);
      for (const issue of issues.slice(0, 10)) {
        console.warn(`    - ${issue}`);
      }
      if (issues.length > 10) {
        console.warn(`    ... and ${issues.length - 10} more`);
      }

      // Fill in missing keys with English values
      let fixedCount = 0;
      for (const key of Object.keys(enKeys)) {
        if (!(key in parsed)) {
          parsed[key] = enKeys[key];
          fixedCount++;
        }
      }
      if (fixedCount > 0) {
        console.log(
          `  → Filled ${fixedCount} missing keys with English fallback`,
        );
      }
    }

    // 5. Write the file
    writeTranslationFile(lang.code, lang.name, parsed);
    console.log(
      `  ✓ ${Object.keys(parsed).length}/${keyCount} keys translated`,
    );
  }

  // Final summary
  console.log("\n── Summary ──");
  for (const lang of ALL_LANGUAGES) {
    const filePath = path.join(I18N_DIR, `${lang.code}.ts`);
    const content = fs.readFileSync(filePath, "utf-8");
    const keyCount = (content.match(/"([^"]+)":\s*"/g) || []).length;
    const hasENFallback = content.includes("...EN");
    console.log(
      `  ${lang.code}.ts: ${keyCount} keys` +
        (hasENFallback ? " (⚠ still has EN fallback)" : " ✓"),
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
