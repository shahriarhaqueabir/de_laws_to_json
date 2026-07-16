import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { searchNorms, type SearchResult } from "../../../lib/qdrant";
import { generateChatResponse } from "../../../lib/chat";
import type { ChatMode, CloudProvider, CitedLaw } from "../../../lib/types";
import { errorResponse } from "../../../lib/api-utils";
import { decryptApiKey } from "../../../lib/encryption";
import { sanitizeErrorMessage } from "../../../lib/sanitize";
import { buildOllamaChatBody } from "../../../lib/ollama";
import { translateQueryToGerman } from "../../../lib/translate-server";
import { detectCategory } from "../../../lib/category-detect";
import { extractLawKeys, KNOWN_LAW_KEYS } from "../../../lib/law-keys";
import { ANALYSIS_MODEL } from "../../../lib/model-constants";
import {
  checkRateLimit,
  getClientIp,
  DEFAULT_AI_RATE_LIMIT,
} from "../../../lib/rate-limiter";

const OllamaParamsSchema = z
  .object({
    temperature: z.number().min(0).max(2).optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().min(0).optional(),
    max_tokens: z.number().int().min(1).max(16384).optional(),
    system_prompt: z.string().optional(),
  })
  .strict()
  .optional();

const ChatBodySchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: z.string().optional(),
  mode: z.string().optional(),
  model: z.string().optional(),
  customEndpoint: z.string().optional(),
  language: z.string().optional(),
  ollamaParams: OllamaParamsSchema,
});

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

    const parsed = ChatBodySchema.safeParse(body);
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
      message,
      conversationId,
      mode: rawMode,
      model,
      customEndpoint,
      language,
      ollamaParams,
    } = parsed.data;

    const mode = (rawMode as ChatMode) || "basic";
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // ── PHASE 0: Law Abbreviation Pre-Search ──
    // Before Qdrant, check for known German law abbreviations in the query.
    // This ensures queries like "StVG" or "car accident StVO" immediately
    // find the right law regardless of embedding quality.
    const matchedLawKeys = extractLawKeys(message);
    const preSearchLaws: SearchResult[] = [];

    if (matchedLawKeys.length > 0) {
      console.log(
        `[Chat API] Law abbreviation(s) detected: ${matchedLawKeys.join(", ")}`,
      );
      const supabase = getServerClient(cookieStore);
      try {
        const { data: laws, error: dbError } = await supabase
          .from("laws")
          .select("*")
          .in("key", matchedLawKeys)
          .limit(10);

        if (!dbError && laws && laws.length > 0) {
          for (const l of laws) {
            preSearchLaws.push({
              law_key: l.key,
              law_title: l.title,
              category: l.category,
              norm_id: "",
              norm_title: "",
              content: `${l.title} — ${l.alt_title || ""}`.trim(),
              score: 0.99, // Highest priority
            });
          }
          console.log(
            `[Chat API] Pre-search found ${preSearchLaws.length} exact law matches.`,
          );
        }
      } catch (lawErr) {
        console.error("[Chat API] Law abbreviation pre-search failed:", lawErr);
      }
    }

    // 1. Search Qdrant for relevant norms (always, unless strong abbreviation match)
    const searchQuery = await translateQueryToGerman(message);
    const detectedCategory = detectCategory(message);

    let norms: SearchResult[] = [...preSearchLaws];

    // Skip Qdrant only if the query is purely an abbreviation (≤3 chars)
    // or is just a single law abbreviation
    const words = message.trim().split(/\s+/);
    const skipQdrant =
      words.length <= 3 &&
      matchedLawKeys.length > 0 &&
      words.every((w) =>
        KNOWN_LAW_KEYS.has(w.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "")),
      );

    if (!skipQdrant) {
      try {
        const qdrantResults = await searchNorms(
          searchQuery,
          detectedCategory,
          50,
        );
        norms.push(...qdrantResults);

        if (qdrantResults.length > 0) {
          const maxScore = Math.max(...qdrantResults.map((n) => n.score));

          // Check homogeneity: does one law dominate the results?
          const lawCounts = new Map<string, number>();
          for (const n of qdrantResults)
            lawCounts.set(n.law_key, (lawCounts.get(n.law_key) || 0) + 1);
          const topLaw = [...lawCounts.entries()].sort(
            (a, b) => b[1] - a[1],
          )[0];
          const homogeneityRatio = topLaw
            ? topLaw[1] / qdrantResults.length
            : 0;

          const needsUnfiltered =
            (!detectedCategory && maxScore < 0.3) ||
            (detectedCategory && homogeneityRatio > 0.6 && maxScore < 0.6);

          if (needsUnfiltered) {
            console.log(
              `[Chat API] Homogeneous results (top: ${topLaw?.[0] || "?"} = ${(homogeneityRatio * 100).toFixed(0)}%), ` +
              `trying unfiltered search`,
            );
            const unfiltered = await searchNorms(searchQuery, undefined, 50);
            if (unfiltered.length > 0) {
              const existingKeys = new Set(norms.map((n) => n.law_key));
              for (const n of unfiltered) {
                if (!existingKeys.has(n.law_key)) {
                  norms.push(n);
                  existingKeys.add(n.law_key);
                }
              }
            }
          }
        }
      } catch (qdrantErr) {
        console.warn(
          "Qdrant search failed, continuing with pre-search context:",
          qdrantErr,
        );
      }
    } else {
      console.log(
        `[Chat API] Skipping Qdrant — abbreviation-only query. Using pre-search context.`,
      );
    }

    // After all search strategies, pick the top 10 most relevant
    // and diverse results for AI context (limit token usage)
    norms.sort((a, b) => b.score - a.score);
    const topNorms = norms.slice(0, 10);

    const contextStr = topNorms
      .map((n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 1200)}`)
      .join("\n\n");
    const citedLaws: CitedLaw[] = topNorms.map((n) => ({
      law_key: n.law_key,
      norm_id: n.norm_id,
      law_title: n.law_title || n.law_key,
      content: n.content.slice(0, 1200),
    }));

    // 2. Generate response based on mode
    let response: string;
    let providerUsed: string | undefined;
    let brokerAvailable: boolean | undefined;

    switch (mode) {
      case "local": {
        // Mode 1: Local Ollama — direct call from server to localhost:11434
        // This path works in development; on Vercel the client-side flow in
        // useChatStrategy.ts handles Local AI directly from the browser.
        try {
          const langName = "English";

          const ollamaBody = buildOllamaChatBody({
            message,
            context: contextStr,
            model: model || ANALYSIS_MODEL,
            systemPrompt: ollamaParams?.system_prompt,
            language: langName,
            temperature: ollamaParams?.temperature,
            top_p: ollamaParams?.top_p,
            top_k: ollamaParams?.top_k,
            max_tokens: ollamaParams?.max_tokens,
            stream: false,
          });
          const ollamaRes = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ollamaBody),
            signal: AbortSignal.timeout(120000),
          });

          if (!ollamaRes.ok) {
            throw new Error(`Ollama returned ${ollamaRes.status}`);
          }

          const data = await ollamaRes.json();
          // Ollama format: { message: { content: "..." } }
          response = data?.message?.content || data?.response || "";
          brokerAvailable = true;
        } catch (err) {
          console.warn("[Chat API] Local AI call failed:", err);
          brokerAvailable = false;
          response =
            `I found ${norms.length} relevant paragraphs, but your local AI is offline.\n\n` +
            `To use Local AI mode, ensure **Ollama** is running:\n` +
            `\`\`\`bash\nollama serve\n\`\`\`\n\n` +
            `Then try again. You can also switch to Browser AI or Cloud AI in Settings.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws
              .map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`)
              .join("\n");
        }
        break;
      }

      case "cloud": {
        // Mode 2: BYO API Key — stored encrypted server-side per user
        if (!user) {
          response = "Please sign in to use Cloud AI mode.";
          break;
        }

        const { data: keyRow } = await supabase
          .from("user_api_keys")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        let resolvedApiKey: string | undefined;
        let resolvedProvider: CloudProvider | undefined;
        let keyRotationDetected = false;

        if (keyRow) {
          try {
            resolvedApiKey = await decryptApiKey(keyRow.encrypted_key);
            resolvedProvider = keyRow.provider as CloudProvider;
          } catch {
            // Decryption failed — server encryption key was rotated
            keyRotationDetected = true;
          }
        }

        if (!resolvedApiKey) {
          response = keyRotationDetected
            ? `**Encryption Key Changed**\n\nYour stored API key was encrypted with a previous server encryption key and can no longer be decrypted. Please re-enter your API key in **Settings** to restore Cloud AI access.\n\n`
            : `No API key configured. Please add your API key in **Settings**.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws
              .map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`)
              .join("\n");
          break;
        }

        providerUsed = resolvedProvider || "openai";

        try {
          response = await generateChatResponse({
            provider: resolvedProvider || "openai",
            apiKey: resolvedApiKey,
            model: model || "gpt-4o-mini",
            customEndpoint: customEndpoint || "",
            question: message,
            norms: citedLaws,
            context: contextStr,
            language: "en",
            temperature: ollamaParams?.temperature ?? 0.3,
            maxTokens: ollamaParams?.max_tokens ?? 8192,
            systemPrompt: ollamaParams?.system_prompt as string,
          });
        } catch (err: unknown) {
          const errMsg = sanitizeErrorMessage(err);
          response =
            `Cloud AI call failed: ${errMsg}

` +
            `Check your API key and provider settings.

` +
            `**Relevant laws found:**
` +
            citedLaws
              .map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`)
              .join("\n");
        }
        break;
      }

      case "browser":
      case "basic": {
        // Mode 3 & 4: No server-side AI
        // For Browser AI mode, the client will run Transformers.js
        // For Basic mode, just show search results
        response =
          `**Relevant laws found (${norms.length} paragraphs):**\n\n` +
          norms
            .map(
              (n, i) =>
                `**${i + 1}. ${n.law_key} ${n.norm_id}** — ${n.law_title}\n` +
                `> ${n.content.slice(0, 300)}...`,
            )
            .join("\n\n");
        break;
      }

      default:
        response = "Unknown chat mode selected. Please check your settings.";
    }

    // 3. Save to Supabase if we have a conversation
    // Verify conversation ownership before saving (prevents IDOR)
    if (conversationId && user) {
      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .single();

      if (!conv) {
        console.warn(
          `[Chat] User ${user.id} attempted to save to conversation ${conversationId} (not found or not owned)`,
        );
        return errorResponse("NOT_FOUND", "Conversation not found", 404);
      }

      await supabase.from("messages").insert([
        { conversation_id: conversationId, role: "user", content: message },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: response,
          cited_laws: JSON.stringify(citedLaws),
        },
      ]);
    }

    return NextResponse.json({
      response,
      citedLaws,
      mode,
      provider: mode === "cloud" ? providerUsed : undefined,
      brokerAvailable,
    });
  } catch (err: unknown) {
    console.error("Chat API Error:", err);
    const message = sanitizeErrorMessage(err);
    return errorResponse("SERVER_ERROR", message, 500);
  }
}
