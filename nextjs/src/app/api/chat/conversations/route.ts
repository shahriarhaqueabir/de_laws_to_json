import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase-server";
import { errorResponse } from "../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../lib/sanitize";

const CreateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional().default("New Inquiry"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateConversationSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid title", 422);
    }
    const { title } = parsed.data;
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
    const message = sanitizeErrorMessage(err);
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
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}
