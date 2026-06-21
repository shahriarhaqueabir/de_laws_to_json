import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { searchNorms } from "../../../lib/qdrant";

interface CheckResult {
  status: string;
  message: string;
}

export async function GET(req: NextRequest) {
  const checks: Record<string, CheckResult> = {};
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      QDRANT_URL: !!process.env.QDRANT_URL,
      QDRANT_API_KEY: !!process.env.QDRANT_API_KEY,
    },
    checks,
  };

  // 1. Check Supabase
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const { data, error } = await supabase
      .from("laws")
      .select("count")
      .limit(1);
    if (error) throw error;
    checks.supabase = {
      status: "ok",
      message: "Successfully queried laws table",
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Supabase query failed";
    checks.supabase = { status: "error", message };
  }

  // 2. Check Qdrant
  try {
    const qdrantResults = await searchNorms("test", undefined, 1);
    checks.qdrant = {
      status: "ok",
      message: `Successfully queried Qdrant via Universal Query API. Found ${qdrantResults.length} matches for 'test'.`,
    };
  } catch (err: unknown) {
    const qdrantMessage =
      err instanceof Error ? err.message : "Qdrant query failed";
    console.error("[Diagnostics] Qdrant check failed:", qdrantMessage);
    checks.qdrant = {
      status: "error",
      message: `Qdrant check failed: ${qdrantMessage}. Ensure COLLECTION '${process.env.COLLECTION || "german_norms"}' exists and Managed Inference is enabled.`,
    };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(results, { status: allOk ? 200 : 500 });
}
