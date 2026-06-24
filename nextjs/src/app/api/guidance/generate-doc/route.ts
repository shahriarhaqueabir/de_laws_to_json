import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { generateDocument } from "@/lib/guidance";
import { decryptApiKey } from "@/lib/encryption";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import type { CloudProvider } from "@/lib/types";
import type { FolderContext } from "@/lib/guidance";
import type { BookmarkFolder } from "@/lib/bookmarks-v2";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_AI_RATE_LIMIT,
} from "@/lib/rate-limiter";

// ── Validation ─────────────────────────────────────────────────────────────

const GenerateDocSchema = z.object({
  template_slug: z.string().min(1, "Template slug is required"),
  folder_id: z.string().uuid(),
  situation: z.string().min(1, "Situation description is required"),
  provider: z.string().default("openai"),
  model: z.string().default("gpt-4o-mini"),
});

// ── POST /api/guidance/generate-doc ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const { allowed, headers: rateLimitHeaders } = checkRateLimit(
      ip,
      DEFAULT_AI_RATE_LIMIT,
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please wait before trying again.",
          },
        },
        { status: 429, headers: rateLimitHeaders },
      );
    }

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse body
    const body = await req.json();
    const parsed = GenerateDocSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid request body",
        422,
        parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      );
    }

    const { template_slug, folder_id, situation, provider, model } =
      parsed.data;

    // 1. Get the folder (from Supabase or localStorage)
    let folderData: BookmarkFolder | null = null;

    if (user) {
      const { data: folder } = await supabase
        .from("bookmark_folders")
        .select("*")
        .eq("id", folder_id)
        .eq("user_id", user.id)
        .single();

      if (folder) folderData = folder;
    }

    if (!folderData) {
      return errorResponse(
        "NOT_FOUND",
        "Folder not found. Please create a folder first.",
        404,
      );
    }

    // 2. Get the template
    const { data: template } = await supabase
      .from("document_templates")
      .select("*")
      .eq("slug", template_slug)
      .single();

    if (!template) {
      return errorResponse(
        "NOT_FOUND",
        `Template "${template_slug}" not found. Available templates: widerspruch, mahnung, kuendigung, einspruch, klage`,
        404,
      );
    }

    // 3. Get API key
    let apiKey = "";
    let resolvedProvider = provider;
    let resolvedModel = model;

    if (user) {
      const { data: keyRow } = await supabase
        .from("user_api_keys")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (keyRow) {
        try {
          apiKey = await decryptApiKey(keyRow.encrypted_key);
          resolvedProvider = keyRow.provider;
        } catch {
          // Key rotation — fall through to AI-less mode
        }
      }
    }

    // 4. Build folder context for document generation
    const folderContext: FolderContext = {
      id: folderData.id,
      name: folderData.name,
      category: folderData.category,
      incident_date: folderData.incident_date || null,
      dispute_value: Number(folderData.dispute_value) || 0,
      status: folderData.status,
      opposing_party: folderData.opposing_party || "",
      deadline_date: folderData.deadline_date || null,
      court_name: folderData.court_name || "",
      case_number: folderData.case_number || "",
      notes: folderData.notes || "",
    };

    // 5. Generate document (AI-less fallback)
    if (!apiKey) {
      // Fill template manually using folder properties
      const placeholders: Record<string, string> = {
        name: folderContext.name,
        incident_date: folderContext.incident_date || "[Datum]",
        dispute_value: String(folderContext.dispute_value),
        status: folderContext.status,
        opposing_party: folderContext.opposing_party || "[Gegner]",
        deadline_date: folderContext.deadline_date || "[Frist]",
        court_name: folderContext.court_name || "[Gericht]",
        case_number: folderContext.case_number || "[Aktenzeichen]",
        notes: folderContext.notes || "",
        situation,
      };

      let content = template.content_template;
      for (const [key, value] of Object.entries(placeholders)) {
        content = content.replace(
          new RegExp(`\\{\\{${key}\\}\\}`, "g"),
          value || `[${key}]`,
        );
      }

      return successResponse({
        title: `${template.title}`,
        content,
        template_slug,
        placeholders_filled: placeholders,
      });
    }

    // 6. Generate document via AI
    const doc = await generateDocument({
      templateSlug: template_slug,
      folderContext,
      situation,
      provider: resolvedProvider as CloudProvider,
      apiKey,
      model: resolvedModel,
      customEndpoint: "",
    });

    return successResponse(doc);
  } catch (err: unknown) {
    console.error("Document generation error:", err);
    const message =
      err instanceof Error
        ? sanitizeErrorMessage(err)
        : "Internal server error";
    return errorResponse("SERVER_ERROR", message, 500);
  }
}
