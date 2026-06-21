import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse } from "../../../../lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert([{ title: title || "New Inquiry", user_id: user.id }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}
