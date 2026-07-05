import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { createAdminClient } from "../../../lib/supabase-admin";
import { generateNormExplanation } from "../../../lib/chat";
import { decryptApiKey } from "../../../lib/encryption";
import { LANGUAGE_NAMES, type AppLanguage, type CloudProvider } from "../../../lib/types";
import { errorResponse } from "../../../lib/api-utils";
import { isValidBrokerUrl, resolveBrokerUrl } from "../../../lib/broker";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_AI_RATE_LIMIT,
} from "../../../lib/rate-limiter";

function extractPlainTranslation(raw: unknown): string {
  if (typeof raw !== "string") return "";

  // 1. Strip <think> tags (common in Qwen/DeepSeek models)
  let text = raw.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();

  // 2. Try code fences first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) text = codeBlockMatch[1].trim();

  // 3. Try to find and parse a JSON object anywhere in the text
  //    Handles cases where extra text follows the JSON.
  const jsonMatch = text.match(/\{[\s\S]*?"translation"\s*:\s*"[\s\S]*?"[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { translation?: unknown };
      if (typeof parsed.translation === "string") {
        return parsed.translation.trim();
      }
    } catch {
      // Fall through
    }
  }

  // 4. Try parsing the whole text as JSON
  try {
    const parsed = JSON.parse(text) as { translation?: unknown };
    if (typeof parsed.translation === "string") {
      return parsed.translation.trim();
    }
  } catch {
    // Not JSON — use the cleaned text as-is.
  }

  // 5. Return as-is (already stripped think tags and code fences)
  return text;
}

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
  const startTime = Date.now();
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
      const elapsed = Date.now() - startTime;
      console.log(
        `[Explain] Cache hit for ${normCacheId} (${lang}): ${elapsed}ms`,
      );
      return NextResponse.json({
        norm_id: normId,
        law_key: lawKey,
        law_title: lawTitle || "",
        lang,
        translation: extractPlainTranslation(cached.translation),
        summary: "",
        implications: "",
        next_steps: "",
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
      const langName = LANGUAGE_NAMES[lang as AppLanguage] || "English";

      const explainPrompt = `Translate this German legal text to ${langName}. ONLY the translation, nothing else. No thinking, no analysis, no JSON, no notes.\n\n${content}`;

      let brokerRes: Response;
      let usedDirectOllama = false;
      try {
        brokerRes = await fetch(`${brokerUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: explainPrompt,
            model: "qwen2.5:1.5b-translate",
            language: langName,
            temperature: 0,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(15000),
        });
      } catch (fetchErr) {
        console.error("[Explain] Broker fetch failed, trying direct Ollama:", fetchErr);
        // Broker unreachable — fall back to direct Ollama (port 11434)
        try {
          const ollamaBody = {
            model: "qwen2.5:1.5b-translate",
            prompt: explainPrompt,
            stream: false,
            options: { temperature: 0, num_predict: 2048 },
          };
          const directRes = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ollamaBody),
            signal: AbortSignal.timeout(30000),
          });
          if (!directRes.ok) {
            throw new Error(`Ollama returned ${directRes.status}`);
          }
          const rawData = await directRes.json();
          brokerRes = {
            ok: true,
            json: async () => ({ response: rawData.response }),
          } as Response;
          usedDirectOllama = true;
        } catch (ollamaErr) {
          console.error("[Explain] Direct Ollama also failed:", ollamaErr);
          return NextResponse.json({
            norm_id: normId,
            law_key: lawKey,
            law_title: lawTitle || "",
            lang,
            translation: "",
            summary: "Local AI unavailable. Ensure Ollama is running (ollama serve) on port 11434, or start the broker on port 9000.",
            implications: "",
            next_steps: "",
            disclaimer: "",
          });
        }
      }

      if (!brokerRes.ok) {
        throw new Error("Broker returned error");
      }

      const data = await brokerRes.json();
      const translation = extractPlainTranslation(data.response);

      if (usedDirectOllama) {
        console.log("[Explain] Translation via direct Ollama (port 11434)");
      }

      // Cache in Supabase
      try {
        const adminSupabase = createAdminClient();
        if (translation && translation.length > 10) {
          await adminSupabase.from("norm_explanations").insert({
            norm_id: normCacheId,
            law_key: lawKey,
            lang,
            translation,
            summary: "",
            implications: "",
            next_steps: "",
          }).maybeSingle();
        }
      } catch (cacheErr) {
        console.warn("[Explain] Failed to cache local translation:", cacheErr);
        // Non-fatal
      }

      const elapsed = Date.now() - startTime;
      console.log(
        `[Explain] Local translation (${lang}) for ${normCacheId}: ${elapsed}ms`,
      );

      return NextResponse.json({
        norm_id: normId,
        law_key: lawKey,
        law_title: lawTitle || "",
        lang,
        translation,
        summary: "",
        implications: "",
        next_steps: "",
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

    const elapsed = Date.now() - startTime;
    console.log(
      `[Explain] Cloud (${provider}) ${mode} for ${normCacheId} (${lang}): ${elapsed}ms`,
    );

    return NextResponse.json({
      ...explanation,
      law_title: lawTitle || "",
    });
  } catch (err: unknown) {
    const elapsed = Date.now() - startTime;
    console.error(`[Explain] Error after ${elapsed}ms:`, err);
    const message =
      err instanceof Error
        ? sanitizeErrorMessage(err)
        : "Failed to generate explanation";
    return errorResponse("EXPLAIN_FAILED", message, 500);
  }
}
