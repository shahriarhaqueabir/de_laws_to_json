import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { searchNorms } from "../../../lib/qdrant";

export async function GET(req: NextRequest) {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      QDRANT_URL: !!process.env.QDRANT_URL,
      QDRANT_API_KEY: !!process.env.QDRANT_API_KEY,
    },
    checks: {},
  };

  // 1. Check Supabase
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const { data, error } = await supabase.from("norms").select("count").limit(1);
    if (error) throw error;
    results.checks.supabase = { status: "ok", message: "Successfully queried norms table" };
  } catch (err: any) {
    results.checks.supabase = { status: "error", message: err.message };
  }

  // 2. Check Qdrant
  try {
    const qdrantResults = await searchNorms("test", undefined, 1);
    results.checks.qdrant = {
      status: "ok",
      message: `Successfully queried Qdrant. Found ${qdrantResults.length} matches for 'test'.`,
    };
  } catch (err: any) {
    results.checks.qdrant = { status: "error", message: err.message };
  }

  const allOk = Object.values(results.checks).every((c: any) => c.status === "ok");

  return NextResponse.json(results, { status: allOk ? 200 : 500 });
}
