import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { createAdminClient } from "../../../lib/supabase-admin";
import { generateNormExplanation } from "../../../lib/chat";
import { decryptApiKey } from "../../../lib/encryption";
import type { AppLanguage, CloudProvider } from "../../../lib/types";
import { errorResponse } from "../../../lib/api-utils";
import { isValidBrokerUrl, resolveBrokerUrl } from "../../../lib/broker";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_AI_RATE_LIMIT,
} from "../../../lib/rate-limiter";

const ExplainBodySchema = z.object({
  normId: z.string().min(1, "normId is required").max(100),
  lawKey: z.string().min(1, "lawKey is required").max(100),
  content: z
    .string()
    .min(1, "content is required")
    .max(50000, "Content too large"),
  lang: z.string().min(1, "lang is required").max(10),
  lawTitle: z.string().max(500).optional(),
  mode: z.string().max(20).optional(),
  provider: z.string().max(30).optional(),
  model: z.string().max(100).optional(),
  customEndpoint: z.string().max(500).optional(),
  brokerUrl: z.string().max(500).optional(),
  ollamaModel: z.string().max(100).optional(),
  ollamaParams: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Resolve the API key from server-side storage only.
 * Never accepts client-supplied keys directly to prevent
 * the endpoint from being used as an open AI proxy.
 */
async function resolveApiKey(
  supabase: ReturnType<typeof getServerClient>,
): Promise<{ apiKey: string; provider: CloudProvider }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: keyRow } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (keyRow) {
      try {
        const decrypted = await decryptApiKey(keyRow.encrypted_key);
        return {
          apiKey: decrypted,
          provider: keyRow.provider as CloudProvider,
        };
      } catch {
        // Decryption failed — key was rotated, fall through
      }
    }
  }

  return { apiKey: "", provider: "openai" };
}

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

    const body = await req.json();

    const parsed = ExplainBodySchema.safeParse(body);
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
      normId,
      lawKey,
      lawTitle,
      content,
      lang,
      mode,
      provider,
      model,
      customEndpoint,
      brokerUrl: bodyBrokerUrl,
      ollamaModel,
      ollamaParams,
    } = parsed.data;

    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const normCacheId = `${lawKey}-${normId}`;

    // 1. Check Supabase norm_explanations cache
    const { data: cached } = await supabase
      .from("norm_explanations")
      .select("*")
      .eq("norm_id", normCacheId)
      .eq("lang", lang)
      .single();

    if (cached) {
      console.log(`[Cache Hit] Explanation found for ${normCacheId} (${lang})`);
      return NextResponse.json({
        norm_id: normId,
        law_key: lawKey,
        law_title: lawTitle || "",
        lang,
        translation: cached.translation,
        summary: cached.summary,
        implications: cached.implications,
        next_steps: cached.next_steps,
        disclaimer: "",
        is_official: cached.is_official,
      });
    }

    console.log(
      `[Cache Miss] Generating explanation for ${normCacheId} (${lang})`,
    );

    // 2. Generate via AI
    if (mode === "local") {
      const brokerUrl = resolveBrokerUrl(bodyBrokerUrl);
      const langName = "English";

      const explainPrompt = `Explain this German law section. Respond in ${langName}.

German text: ${content}

Return STRICT JSON with these exact fields:
{
  "translation": "accurate legal translation of the German text",
  "summary": "what this means in simple terms in the user's language",
  "implications": "what this means practically for the person involved, written in the user's language",
  "next_steps": "concrete recommended actions the person can take, written in the user's language"
}`;

      const brokerRes = await fetch(`${brokerUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: explainPrompt,
          context: content,
          model: ollamaModel || undefined,
          language: langName,
          temperature: ollamaParams?.temperature ?? 0.3,
          top_p: ollamaParams?.top_p ?? 0.9,
          top_k: ollamaParams?.top_k ?? 40,
          max_tokens: ollamaParams?.max_tokens ?? 2048,
          system_prompt: ollamaParams?.system_prompt || undefined,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!brokerRes.ok) {
        throw new Error("Broker returned error");
      }

      const data = await brokerRes.json();
      let jsonStr = data.response.trim();
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        parsed = {
          translation: jsonStr,
          summary: jsonStr,
          implications: jsonStr,
          next_steps: jsonStr,
        };
      }

      return NextResponse.json({
        norm_id: normId,
        law_key: lawKey,
        law_title: lawTitle || "",
        lang,
        translation: parsed.translation || "",
        summary: parsed.summary || "",
        implications: parsed.implications || "",
        next_steps: parsed.next_steps || "",
        disclaimer: "",
      });
    }

    // Resolve API key from server-side storage only
    const { apiKey: resolvedKey, provider: resolvedProvider } =
      await resolveApiKey(supabase);

    // If no API key is available, return a basic response without AI
    if (!resolvedKey) {
      const langName = "English";
      return NextResponse.json({
        norm_id: normId,
        law_key: lawKey,
        law_title: lawTitle || "",
        lang,
        translation: `[${content}]`,
        summary:
          "Sign in and configure an AI provider in Settings to get an AI-powered explanation of this legal text.",
        implications:
          "Configure an API key in Settings → API Key to enable AI-powered legal explanations.",
        next_steps: [
          "Sign in to your account",
          "Go to Settings → API Key",
          "Add your OpenAI or Anthropic API key",
          "Return to this page to see the AI explanation",
        ].join("\n"),
        disclaimer: "",
        is_official: false,
      });
    }

    const explanation = await generateNormExplanation({
      provider: (provider as CloudProvider) || resolvedProvider || "openai",
      apiKey: resolvedKey || "",
      model: model || "gpt-4o-mini",
      customEndpoint: customEndpoint || "",
      normId,
      lawKey,
      content,
      lang: lang as AppLanguage,
    });

    // 3. Cache in Supabase (admin client — RLS INSERT revoked from anon/authenticated)
    let insertError: any = null;
    try {
      const adminSupabase = createAdminClient();
      const { error: err } = await adminSupabase
        .from("norm_explanations")
        .insert({
          norm_id: normCacheId,
          law_key: lawKey,
          lang,
          translation: explanation.translation,
          summary: explanation.summary,
          implications: explanation.implications,
          next_steps: explanation.next_steps,
        });
      insertError = err;
    } catch (adminErr) {
      console.warn(
        "[Explain] Admin client unavailable, using regular client:",
        adminErr,
      );
      const { error: err } = await supabase.from("norm_explanations").insert({
        norm_id: normCacheId,
        law_key: lawKey,
        lang,
        translation: explanation.translation,
        summary: explanation.summary,
        implications: explanation.implications,
        next_steps: explanation.next_steps,
      });
      insertError = err;
    }

    if (insertError) {
      console.error("Failed to cache norm_explanation:", insertError);
      // Non-fatal — return the generated explanation anyway
    }

    return NextResponse.json({
      ...explanation,
      law_title: lawTitle || "",
    });
  } catch (err: unknown) {
    console.error("Explain API Error:", err);
    const message =
      err instanceof Error
        ? sanitizeErrorMessage(err)
        : "Failed to generate explanation";
    return errorResponse("EXPLAIN_FAILED", message, 500);
  }
}
