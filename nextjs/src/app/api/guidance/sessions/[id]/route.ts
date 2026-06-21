import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
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

    // Get the case file
    const { data: caseFile, error: cfError } = await supabase
      .from("case_files")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (cfError || !caseFile) {
      return errorResponse("NOT_FOUND", "Guidance session not found", 404);
    }

    // Get the guidance paths
    const { data: paths, error: pError } = await supabase
      .from("guidance_paths")
      .select("*")
      .eq("case_file_id", id)
      .order("path_number", { ascending: true });

    if (pError) throw pError;

    return successResponse({
      session: caseFile,
      paths: paths || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}

export async function DELETE(
  req: NextRequest,
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

    const { error } = await supabase
      .from("case_files")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return successResponse({ deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    return errorResponse("DB_ERROR", message, 500);
  }
}
