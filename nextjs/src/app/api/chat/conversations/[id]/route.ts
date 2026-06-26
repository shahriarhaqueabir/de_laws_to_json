import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../../lib/supabase-server";
import { errorResponse } from "../../../../../lib/api-utils";
import { sanitizeErrorMessage } from "../../../../../lib/sanitize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    // Verify the conversation belongs to this user
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return errorResponse("NOT_FOUND", "Conversation not found", 404);
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) throw msgError;

    return NextResponse.json({ conversation, messages });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
    }

    // Verify conversation ownership first
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!conv) {
      return errorResponse("NOT_FOUND", "Conversation not found", 404);
    }

    // Delete all messages (safe because we verified conversation ownership)
    const { error: msgError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", id);

    if (msgError) throw msgError;

    const { error: convError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (convError) throw convError;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = sanitizeErrorMessage(err);
    return errorResponse("DB_ERROR", message, 500);
  }
}
