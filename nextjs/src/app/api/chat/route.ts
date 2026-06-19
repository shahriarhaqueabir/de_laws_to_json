import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getServerClient } from "../../../lib/supabase-server";
import { searchNorms } from "../../../lib/qdrant";
import { generateChatResponse } from "../../../lib/chat";
import type {
  ChatMode,
  CloudProvider,
  AppLanguage,
  CitedLaw,
} from "../../../lib/types";
import { LANGUAGE_NAMES } from "../../../lib/types";
import { errorResponse } from "../../../lib/api-utils";

const BROKER_URL =
  process.env.NEXT_PUBLIC_BROKER_URL || "http://localhost:9000";

const ChatBodySchema = z.object({
  message: z.string().min(1, "message is required"),
  conversationId: z.string().optional(),
  mode: z.string().optional(),
  provider: z.string().optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  customEndpoint: z.string().optional(),
  language: z.string().optional(),
  ollamaModel: z.string().optional(),
  ollamaParams: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
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
      provider,
      apiKey,
      model,
      customEndpoint,
      language,
      ollamaModel,
      ollamaParams,
    } = parsed.data;

    const mode = (rawMode as ChatMode) || "basic";
    const cookieStore = await cookies();
    const supabase = getServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Search Qdrant for relevant norms (always)
    // Safety: limit context to 10 norms or ~12k characters total for smaller model safety

    // Check if query needs translation for better Qdrant matching
    // (Only if not English/German and we have a way to detect/translate)
    // For now, we use the message directly as the multilingual-e5 model handles many languages.

    const norms = await searchNorms(message, undefined, 10);
    const contextStr = norms
      .map((n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 1200)}`)
      .join("\n\n");
    const citedLaws: CitedLaw[] = norms.map((n) => ({
      law_key: n.law_key,
      norm_id: n.norm_id,
      law_title: n.law_title || n.law_key,
    }));

    // 2. Generate response based on mode
    let response: string;
    let brokerAvailable: boolean | null = null;

    switch (mode) {
      case "local": {
        // Mode 1: Local Ollama via broker
        try {
          const langName = LANGUAGE_NAMES[language as AppLanguage] || "English";
          const brokerRes = await fetch(`${BROKER_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              context: contextStr,
              conversationId,
              model: ollamaModel || undefined,
              language: langName,
              temperature: ollamaParams?.temperature ?? 0.3,
              top_p: ollamaParams?.top_p ?? 0.9,
              top_k: ollamaParams?.top_k ?? 40,
              max_tokens: ollamaParams?.max_tokens ?? 1024,
              system_prompt: ollamaParams?.system_prompt || undefined,
            }),
            signal: AbortSignal.timeout(120000),
          });

          if (brokerRes.ok) {
            const data = await brokerRes.json();
            response = data.response;
            brokerAvailable = true;
          } else {
            throw new Error("Broker returned error");
          }
        } catch {
          response =
            `I found ${norms.length} relevant paragraphs, but your local AI broker is offline.\n\n` +
            `To use Local AI mode, start the broker:\n` +
            `\`\`\`bash\ncd broker && python broker.py\n\`\`\`\n\n` +
            `Or switch to another chat mode in Settings.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws
              .map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`)
              .join("\n");
          brokerAvailable = false;
        }
        break;
      }

      case "cloud": {
        // Mode 2: BYO API Key
        if (!apiKey) {
          response =
            `No API key configured. Please add your API key in **Settings → Cloud AI**.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws
              .map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`)
              .join("\n");
          brokerAvailable = null;
          break;
        }
        try {
          response = await generateChatResponse({
            provider: (provider as CloudProvider) || "openai",
            apiKey,
            model: model || "gpt-4o-mini",
            customEndpoint: customEndpoint || "",
            question: message,
            norms: citedLaws,
            context: contextStr,
            language: (language as AppLanguage) || "en",
            temperature: ollamaParams?.temperature as number,
            maxTokens: ollamaParams?.max_tokens as number,
            systemPrompt: ollamaParams?.system_prompt as string,
          });
          brokerAvailable = null;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          response =
            `Cloud AI call failed: ${errMsg}\n\n` +
            `Check your API key and provider settings.\n\n` +
            `**Relevant laws found:**\n` +
            citedLaws
              .map((l) => `- **${l.law_key}** ${l.norm_id} — ${l.law_title}`)
              .join("\n");
          brokerAvailable = null;
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
        brokerAvailable = null;
        break;
      }

      default:
        response = "Unknown chat mode selected. Please check your settings.";
    }

    // 3. Save to Supabase if we have a conversation
    if (conversationId && user) {
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
      brokerAvailable,
      mode,
      provider: mode === "cloud" ? provider : undefined,
    });
  } catch (err: unknown) {
    console.error("Chat API Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse("SERVER_ERROR", message, 500);
  }
}
