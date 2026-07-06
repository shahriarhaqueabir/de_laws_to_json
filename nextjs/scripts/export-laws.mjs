/**
 * Export laws from Supabase.
 * Uses env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * or falls back to --linked CLI query and parses table output.
 */
import { execSync } from "child_process";

async function main() {
  // Try env vars first
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    console.error("Using env vars: REST API");
    const apiUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const res = await fetch(
      `${apiUrl}/rest/v1/laws?select=key,category&order=key.asc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    console.log(JSON.stringify(rows));
  } else {
    // Fallback: parse CLI table output into JSON
    console.error("Using CLI --linked fallback...");
    const stdout = execSync(
      'npx supabase db query --linked "SELECT key, category FROM public.laws ORDER BY key;"',
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30000,
        shell: true,
      },
    );

    // Parse the table format into JSON
    const lines = stdout.split("\n").filter((l) => l.trim());
    const dataStart = lines.findIndex((l) => l.includes("key") && l.includes("│"));
    const dataEnd = lines.findIndex((l) => l.startsWith("└"));
    if (dataStart === -1 || dataEnd === -1) {
      console.error("Could not parse CLI output. First 10 lines:", lines.slice(0, 10));
      process.exit(1);
    }

    const rows = [];
    for (let i = dataStart + 1; i < dataEnd; i++) {
      const parts = lines[i]
        .split("│")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        rows.push({ key: parts[0], category: parts[1] });
      }
    }
    console.log(JSON.stringify(rows));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
