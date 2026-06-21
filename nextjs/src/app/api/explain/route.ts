import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { generateNormExplanation } from "../../../lib/chat";
import { decryptApiKey } from "../../../lib/encryption";
import type { AppLanguage, CloudProvider } from "../../../lib/types";
import { LANGUAGE_NAMES } from "../../../lib/types";
import { errorResponse } from "../../../lib/api-utils";

const ExplainBodySchema = z.object({
  normId: z.string().min(1, "normId is required"),
  lawKey: z.string().min(1, "lawKey is required"),
  content: z.string().min(1, "content is required"),
  lang: z.string().min(1, "lang is required"),
  lawTitle: z.string().optional(),
  mode: z.string().optional(),
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  customEndpoint: z.string().optional(),
  brokerUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  ollamaParams: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Resolve the API key from either the request body or server-side storage.
 * For cloud modes, prefer server-side encrypted key first to avoid
 * sending keys over the wire unnecessarily.
 */
async function resolveApiKey(
  bodyApiKey: string | undefined,
  supabase: ReturnType<typeof getServerClient>,
): Promise<{ apiKey: string; provider: CloudProvider }> {
  // If client provided a key, use it directly (backward compatibility)
  if (bodyApiKey) {
    return { apiKey: bodyApiKey, provider: "openai" };
  }

  // Try server-side stored key
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
      apiKey,
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
      const brokerUrl =
        bodyBrokerUrl ||
        process.env.NEXT_PUBLIC_BROKER_URL ||
        "http://localhost:9000";
      const langName = LANGUAGE_NAMES[lang as AppLanguage] || "English";

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

    // Resolve API key from server-side storage (preferred) or client body
    const { apiKey: resolvedKey, provider: resolvedProvider } =
      await resolveApiKey(apiKey, supabase);

    const explanation = await generateNormExplanation({
      provider: (provider as CloudProvider) || resolvedProvider || "openai",
      apiKey: resolvedKey || apiKey || "",
      model: model || "gpt-4o-mini",
      customEndpoint: customEndpoint || "",
      normId,
      lawKey,
      content,
      lang: (lang as AppLanguage) || "en",
    });

    // 3. Cache in Supabase
    const { error: insertError } = await supabase
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
      err instanceof Error ? err.message : "Failed to generate explanation";
    return errorResponse("EXPLAIN_FAILED", message, 500);
  }
}
