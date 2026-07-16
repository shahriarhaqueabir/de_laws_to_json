import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { searchNorms } from "../../../lib/qdrant";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_SEARCH_RATE_LIMIT,
} from "../../../lib/rate-limiter";

interface CheckResult {
  status: string;
  message: string;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
    ip,
    DEFAULT_SEARCH_RATE_LIMIT,
  );
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  const checks: Record<string, CheckResult> = {};
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      QDRANT_URL: !!process.env.QDRANT_URL,
      QDRANT_API_KEY: !!process.env.QDRANT_API_KEY,
      COLLECTION: process.env.COLLECTION || "german_norms (default)",
      NEXT_PUBLIC_BROKER_URL: process.env.NEXT_PUBLIC_BROKER_URL || "(not set)",
      SERVER_ENCRYPTION_KEY: !!process.env.SERVER_ENCRYPTION_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    },
    checks,
  };

  // ── 1. Check Supabase ────────────────────────────────────────────────────
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const { data, error, count } = await supabase
      .from("laws")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    checks.supabase = {
      status: "ok",
      message: `Connected. ${count ?? "?"} law records in database.`,
    };
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    checks.supabase = { status: "error", message };
  }

  // ── 2. Check Qdrant ──────────────────────────────────────────────────────
  try {
    const qdrantResults = await searchNorms("test", undefined, 1);
    checks.qdrant = {
      status: "ok",
      message: `Connected via Universal Query API. ${qdrantResults.length} matches for probe query 'test'.`,
    };
  } catch (err: unknown) {
    const qdrantMessage = sanitizeErrorMessage(err);
    console.error("[Diagnostics] Qdrant check failed:", qdrantMessage);
    checks.qdrant = {
      status: "error",
      message: `Qdrant check failed: ${qdrantMessage}. Ensure collection '${process.env.COLLECTION || "german_norms"}' exists and Managed Inference is enabled.`,
    };
  }

  // ── 3. Check Ollama (server-side — works in dev, fails on Vercel) ────────
  try {
    const ollamaRes = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (ollamaRes.ok) {
      const ollamaData = await ollamaRes.json();
      const models: string[] = (ollamaData.models || []).map(
        (m: { name?: string }) => m.name || "?",
      );
      checks.ollama = {
        status: "ok",
        message: models.length > 0
          ? `Reachable. Models: ${models.join(", ")}`
          : "Reachable (no models installed yet)",
      };
    } else {
      checks.ollama = {
        status: "error",
        message: `Ollama returned HTTP ${ollamaRes.status}`,
      };
    }
  } catch {
    // Expected on Vercel — no localhost access
    checks.ollama = {
      status: "warn",
      message: "Not reachable from server (expected on Vercel). Browser-based Local AI still works.",
    };
  }

  // ── 4. Validate environment completeness ─────────────────────────────────
  const envIssues: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)
    envIssues.push("NEXT_PUBLIC_SUPABASE_URL missing");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    envIssues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
  if (!process.env.QDRANT_URL)
    envIssues.push("QDRANT_URL missing");
  if (!process.env.SERVER_ENCRYPTION_KEY)
    envIssues.push("SERVER_ENCRYPTION_KEY missing (API key encryption unavailable)");

  checks.env = {
    status: envIssues.length === 0 ? "ok" : "warn",
    message:
      envIssues.length === 0
        ? "All required variables set"
        : envIssues.join("; "),
  };

  // ── 5. RLS check — verify authenticated user can read laws ────────────────
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    const { error: anonError } = await supabase
      .from("laws")
      .select("key")
      .limit(1);

    checks.rls = {
      status: anonError ? "warn" : "ok",
      message: anonError
        ? `RLS may be blocking public reads: ${sanitizeErrorMessage(anonError)}`
        : "Public read access OK",
    };
  } catch {
    checks.rls = {
      status: "warn",
      message: "RLS check skipped (not authenticated)",
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(results, { status: allOk ? 200 : 500 });
}
