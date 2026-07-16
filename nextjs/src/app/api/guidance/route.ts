import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-utils";
import { searchNorms } from "@/lib/qdrant";
import { translateQueryToGerman } from "@/lib/translate-server";
import {
  generateGuidancePaths,
  buildGuidancePrompts,
  type GenerateGuidanceParams,
  type FolderContext,
} from "@/lib/guidance";
import { decryptApiKey } from "@/lib/encryption";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { isValidBrokerUrl } from "@/lib/ollama";
import { ANALYSIS_MODEL } from "@/lib/model-constants";
import { translateFromGerman } from "@/lib/translate-server";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_AI_RATE_LIMIT,
} from "@/lib/rate-limiter";

// ── Validation ─────────────────────────────────────────────────────────────

const GuidanceRequestSchema = z.object({
  situation: z
    .string()
    .min(
      10,
      "Please describe your situation in more detail (at least 10 characters)",
    )
    .max(10000),
  language: z.string().default("en"),
  folder_id: z.string().uuid().nullable().optional(),
  folder_context: z
    .object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      incident_date: z.string().nullable(),
      dispute_value: z.number(),
      status: z.string(),
      opposing_party: z.string(),
      deadline_date: z.string().nullable(),
      court_name: z.string(),
      case_number: z.string(),
      notes: z.string(),
    })
    .nullable()
    .optional(),
  provider: z.string().default("openai"),
  model: z.string().default("gpt-4o-mini"),
  mode: z.string().optional(),
  brokerUrl: z.string().optional(),
});

// ── Execute SQL for guidance_paths insert ──────────────────────────────────

async function saveGuidancePaths(
  supabase: ReturnType<typeof getServerClient>,
  caseFileId: string,
  paths: Array<{
    path_number: number;
    title: string;
    summary: string;
    detailed_analysis: string;
    laws_cited: Array<{ law_key: string; norm_id: string; law_title: string }>;
    risk_level: string;
    cost_estimate: number | null;
    recommended_actions: string[];
  }>,
) {
  for (const path of paths) {
    const { error } = await supabase.from("guidance_paths").insert({
      case_file_id: caseFileId,
      path_number: path.path_number,
      title: path.title,
      summary: path.summary,
      detailed_analysis: path.detailed_analysis,
      laws_cited: JSON.stringify(path.laws_cited),
      risk_level: path.risk_level,
      cost_estimate: path.cost_estimate,
      recommended_actions: JSON.stringify(path.recommended_actions),
    });
    if (error) console.error("Failed to save guidance path:", error);
  }
}

// ── POST /api/guidance ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const { allowed, headers: rateLimitHeaders } = await checkRateLimit(
      ip,
      DEFAULT_AI_RATE_LIMIT,
    );
    if (!allowed) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests. Please wait before trying again.",
        429,
        undefined,
        rateLimitHeaders,
      );
    }

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse body
    const body = await req.json();
    const parsed = GuidanceRequestSchema.safeParse(body);

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

    const {
      situation,
      language,
      folder_context,
      provider,
      model,
      mode,
      brokerUrl,
    } = parsed.data;

    // 1. Get API key from Supabase (if user is signed in)
    let apiKey = "";
    let resolvedProvider = provider as GenerateGuidanceParams["provider"];
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
          resolvedProvider =
            keyRow.provider as GenerateGuidanceParams["provider"];
        } catch {
          // Decryption failed — key rotation
        }
      }
    }

    // ── SUGGEST MODE: Return assembled prompts for client-side AI ──
    if (mode === "suggest") {
      const translatedSituation = await translateQueryToGerman(situation);
      const norms = await searchNorms(
        translatedSituation,
        folder_context?.category,
        15,
      );

      const qdrantResults = norms.map((n) => ({
        law_key: n.law_key,
        norm_id: n.norm_id,
        law_title: n.law_title,
      }));

      const qdrantContext = norms
        .map((n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 1500)}`)
        .join("\n\n");

      let folderCtx: FolderContext | null = null;
      if (folder_context) {
        folderCtx = {
          id: folder_context.id,
          name: folder_context.name,
          category: folder_context.category,
          incident_date: folder_context.incident_date,
          dispute_value: folder_context.dispute_value,
          status: folder_context.status as FolderContext["status"],
          opposing_party: folder_context.opposing_party,
          deadline_date: folder_context.deadline_date,
          court_name: folder_context.court_name,
          case_number: folder_context.case_number,
          notes: folder_context.notes,
        };
      }

      const prompts = await buildGuidancePrompts({
        situation,
        language: "en" as const,
        folderContext: folderCtx,
        bookmarkedLaws: [],
        qdrantResults,
        qdrantContext,
      });

      return successResponse({
        status: "suggest",
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        qdrantResults,
        qdrantContext,
        folderContext: folderCtx,
        generated_at: new Date().toISOString(),
      });
    }

    // LOCAL MODE — skip API key, use local broker
    if (mode === "local" && brokerUrl && isValidBrokerUrl(brokerUrl)) {
      const translatedSituation = await translateQueryToGerman(situation);
      const norms = await searchNorms(
        translatedSituation,
        folder_context?.category,
        15,
      );

      const qdrantResults = norms.map((n) => ({
        law_key: n.law_key,
        norm_id: n.norm_id,
        law_title: n.law_title,
      }));

      const qdrantContext = norms
        .map((n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 1500)}`)
        .join("\n\n");

      const lang = "en";
      const params: GenerateGuidanceParams = {
        situation,
        language: lang,
        folderContext: folder_context as FolderContext | null,
        bookmarkedLaws: [],
        qdrantResults,
        qdrantContext,
        provider: "local",
        apiKey: "",
        model: ANALYSIS_MODEL,
        customEndpoint: "",
        brokerUrl,
      };

      const paths = await generateGuidancePaths(params);

      return successResponse({
        session_id: null,
        paths,
        folder_context,
        generated_at: new Date().toISOString(),
        language: lang,
      });
    }

    // If no API key, use basic mode (just search results translated to user's language)
    if (!apiKey) {
      const translatedSituation = await translateQueryToGerman(situation);
      const norms = await searchNorms(translatedSituation, undefined, 10);
      const appLang = "en";

      // Translate norms from German to user's language
      const translatedPaths = await Promise.all(
        norms.map(async (n, i) => {
          const [translatedTitle, translatedSummary, translatedAnalysis] =
            await Promise.all([
              translateFromGerman(n.law_title || n.law_key, appLang),
              translateFromGerman(n.content.slice(0, 300), appLang),
              translateFromGerman(n.content, appLang),
            ]);

          return {
            path_number: i + 1,
            title: `${n.law_key} ${n.norm_id} — ${translatedTitle}`,
            summary: translatedSummary,
            detailed_analysis: translatedAnalysis,
            laws_cited: [
              {
                law_key: n.law_key,
                norm_id: n.norm_id,
                law_title: translatedTitle,
              },
            ],
            risk_level: "medium" as const,
            risk_reason:
              "Sign in and configure an AI provider to get risk assessment.",
            cost_estimate: null,
            cost_breakdown: null,
            recommended_actions: [
              "Sign in and add an API key in Settings to enable AI-powered guidance",
              "Review the relevant laws above",
              "Consult a licensed German attorney (Rechtsanwalt)",
            ],
            estimated_timeline: "Varies",
            success_probability: 0.5,
          };
        }),
      );

      return successResponse({
        session_id: null,
        paths: translatedPaths,
        folder_context,
        generated_at: new Date().toISOString(),
        language,
      });
    }

    // 2. Search Qdrant for relevant norms (translate non-German queries)
    const translatedSituation = await translateQueryToGerman(situation);
    const norms = await searchNorms(
      translatedSituation,
      folder_context?.category,
      15,
    );

    const qdrantResults = norms.map((n) => ({
      law_key: n.law_key,
      norm_id: n.norm_id,
      law_title: n.law_title,
    }));

    const qdrantContext = norms
      .map((n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 1500)}`)
      .join("\n\n");

    // 3. Build folder context
    let folderCtx: FolderContext | null = null;
    if (folder_context) {
      folderCtx = {
        id: folder_context.id,
        name: folder_context.name,
        category: folder_context.category,
        incident_date: folder_context.incident_date,
        dispute_value: folder_context.dispute_value,
        status: folder_context.status as FolderContext["status"],
        opposing_party: folder_context.opposing_party,
        deadline_date: folder_context.deadline_date,
        court_name: folder_context.court_name,
        case_number: folder_context.case_number,
        notes: folder_context.notes,
      };
    }

    // 4. Get bookmarked laws for this folder
    let bookmarkedLaws: Array<{
      law_key: string;
      norm_id: string;
      law_title: string;
    }> = [];
    if (user && folder_context?.id) {
      const { data: folderBookmarks } = await supabase
        .from("bookmarks")
        .select("law_key, norm_id")
        .eq("user_id", user.id)
        .eq("folder_id", folder_context.id);

      if (folderBookmarks) {
        bookmarkedLaws = folderBookmarks.map((b) => ({
          law_key: b.law_key,
          norm_id: b.norm_id || "",
          law_title: b.law_key,
        }));
      }
    }

    // 5. Generate guidance paths
    const lang = "en";
    const customEndpoint = ""; // Use default for each provider

    const params: GenerateGuidanceParams = {
      situation,
      language: lang,
      folderContext: folderCtx,
      bookmarkedLaws,
      qdrantResults,
      qdrantContext,
      provider: resolvedProvider,
      apiKey,
      model: resolvedModel,
      customEndpoint,
    };

    const paths = await generateGuidancePaths(params);

    // 6. Create case_file and save paths to DB (if user is signed in)
    let sessionId: string | null = null;
    if (user && folder_context?.id) {
      const { data: caseFile } = await supabase
        .from("case_files")
        .insert({
          user_id: user.id,
          title: `Guidance — ${situation.slice(0, 80)}`,
          category: folder_context?.category || "other",
          situation_data: {
            situation,
            language,
            folder_id: folder_context?.id,
          },
          status: "active",
          incident_date: folder_context?.incident_date || null,
          dispute_value: folder_context?.dispute_value || 0,
        })
        .select()
        .single();

      if (caseFile) {
        sessionId = caseFile.id;
        await saveGuidancePaths(supabase, caseFile.id, paths);
      }
    }

    return successResponse({
      session_id: sessionId,
      paths,
      folder_context: folderCtx,
      generated_at: new Date().toISOString(),
      language: lang,
    });
  } catch (err: unknown) {
    console.error("Guidance API Error:", err);
    const message =
      err instanceof Error
        ? sanitizeErrorMessage(err)
        : "Internal server error";
    return errorResponse("SERVER_ERROR", message, 500);
  }
}
