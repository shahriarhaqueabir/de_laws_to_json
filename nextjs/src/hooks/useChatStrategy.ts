import { useCallback } from "react";
import { ChatMode, CitedLaw, CloudProvider, ChatSettings } from "../lib/types";
import { ANALYSIS_MODEL } from "../lib/model-constants";
import { useBrowserAI } from "./useBrowserAI";
import { stripThinkTags } from "../lib/prompt-format";
import { buildOllamaChatBody, parseOllamaStreamLine } from "../lib/ollama";

interface Message {
  role: "user" | "assistant";
  content: string;
  citedLaws?: CitedLaw[];
  thinking?: boolean;
}

interface ChatStrategyProps {
  settings: ChatSettings;
  mode: ChatMode;
  conversationId: string | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setLoading: (loading: boolean) => void;
}

/**
 * Check if the streamed text is currently inside an unclosed <think> block.
 */
function isInThinkBlock(text: string): boolean {
  const lastOpen = text.lastIndexOf("<think>");
  const lastClose = text.lastIndexOf("</think>");
  if (lastOpen === -1) return false;
  return lastOpen > lastClose;
}

/**
 * During streaming, determine what to display:
 * - If inside an unclosed <think> block, show animated "Thinking..." placeholder
 * - Otherwise, strip completed <think> blocks and show real content
 */
function getStreamingDisplay(text: string): { display: string; thinking: boolean } {
  if (isInThinkBlock(text)) {
    return { display: "Thinking...", thinking: true };
  }
  const stripped = stripThinkTags(text);
  if (stripped) {
    return { display: stripped, thinking: false };
  }
  if (text.includes("<think>")) {
    return { display: "Thinking...", thinking: true };
  }
  return { display: text, thinking: false };
}

// SSRF Protection: Only allow localhost URLs for Ollama connections
const OLLAMA_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function isValidOllamaUrl(url: string): boolean {
  return OLLAMA_URL_REGEX.test(url);
}

export function useChatStrategy({
  settings,
  mode,
  conversationId,
  setMessages,
  setLoading,
}: ChatStrategyProps) {
  const browserAI = useBrowserAI(mode === "browser");

  const sendMessage = useCallback(
    async (userMsg: string) => {
      const body = {
        message: userMsg,
        mode,
        language: settings.language,
        conversationId: conversationId || undefined,
      };

      try {
        if (mode === "local") {
          // --- LOCAL AI STRATEGY (Direct Ollama) ---
          const ollamaUrl = settings.brokerUrl || "http://localhost:11434";

          // Validate URL (SSRF protection)
          if (!isValidOllamaUrl(ollamaUrl)) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "⚠️ **Ollama URL rejected.**\n\nThe URL must be a localhost address (e.g. http://localhost:11434).",
              },
            ]);
            setLoading(false);
            return;
          }

          // Step 1: Search laws via server (Qdrant) — works on Vercel
          // Note: no separate pre-flight check for Ollama here because when the
          // app is served over HTTPS (e.g. Vercel), CORS blocks fetch to localhost.
          // We go straight to the actual Ollama call and handle errors gracefully.
          const searchRes = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, mode: "basic" }),
          });
          const searchData = await searchRes.json();
          const citedLaws = searchData.citedLaws || [];
          const contextStr = citedLaws.map((l: CitedLaw) =>
            l.content ? `[${l.law_key} ${l.norm_id}] ${l.law_title}\n${l.content}` : `[${l.law_key} ${l.norm_id}] ${l.law_title}`
          ).join("\n\n");

          // Step 2: Call Ollama directly from the browser.
          // The browser-to-localhost fetch works even over HTTPS (Vercel) because
          // modern browsers allow fetch to localhost from secure origins.
          // If it fails, it's likely CORS — Ollama needs OLLAMA_ORIGINS set.
          let ollamaRes: Response;
          try {
            const ollamaBody = buildOllamaChatBody({
              message: userMsg,
              context: contextStr,
              model: settings.model || ANALYSIS_MODEL,
              systemPrompt: settings.ollamaParams?.system_prompt,
              language: "English",
              temperature: settings.ollamaParams?.temperature,
              top_p: settings.ollamaParams?.top_p,
              top_k: settings.ollamaParams?.top_k,
              max_tokens: settings.ollamaParams?.max_tokens,
              stream: true,
            });

            ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ollamaBody),
              signal: AbortSignal.timeout(120000),
            });

            if (!ollamaRes.ok) {
              const errText = await ollamaRes.text().catch(() => "Unknown error");
              throw new Error(`Ollama returned ${ollamaRes.status}: ${errText}`);
            }
          } catch (ollamaErr) {
            const isNetworkError = ollamaErr instanceof TypeError && ollamaErr.message === "Failed to fetch";
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "⚠️ **Local AI unavailable.**\n\n" +
                  (isNetworkError
                    ? "Connection refused by the browser (CORS) or Ollama is not running.\n\n" +
                    "**If Ollama is running**, start it with CORS allowed:\n" +
                    "```\nOLLAMA_ORIGINS=* ollama serve\n```\n\n" +
                    "Then refresh this page and try again.\n\n"
                    : `Error: ${ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr)}\n\n`) +
                  "**Alternatively**, switch to **Browser AI** mode (Settings → AI Mode) which runs entirely in your browser with no external setup.",
              },
            ]);
            setLoading(false);
            return;
          }

          setMessages((prev) => [...prev, { role: "assistant", content: "", citedLaws }]);

          // Step 3: Stream the NDJSON response from Ollama
          const reader = ollamaRes.body?.getReader();
          if (!reader) throw new Error("Body not readable");
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const parsed = parseOllamaStreamLine(trimmed);
              if (parsed) {
                if (parsed.done) break;
                accumulatedContent += parsed.content;
                const { display, thinking } = getStreamingDisplay(accumulatedContent);
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...updated[updated.length - 1], content: display, thinking };
                  return updated;
                });
              }
            }
          }

          setMessages((prev) => {
            const updated = [...prev];
            const finalContent = stripThinkTags(accumulatedContent);
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: (finalContent || "(no response)") + "\n\n---\n*Generated by Local AI (Ollama).*",
              thinking: false,
            };
            return updated;
          });
          setLoading(false);
          return;
        }

        if (mode === "browser") {
          // --- BROWSER AI STRATEGY ---
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, mode: "basic" }),
          });
          const data = await res.json();
          const baseSystem = settings.ollamaParams?.system_prompt || "";
          const currentModel = settings.browserModel || "onnx-community/Qwen3-0.6B-ONNX";
          const isGemma = currentModel.toLowerCase().includes("gemma");

          const systemContent = `${baseSystem}\n\nRespond in English.`;
          const userContent = `Context:\n${(data.citedLaws || []).map((l: CitedLaw) => `[${l.law_key} ${l.norm_id}] ${l.law_title}`).join("\n")}\n\nUser: ${userMsg}`;
          const prompt = isGemma
            ? `<start_of_turn>system\n${systemContent}<end_of_turn>\n<start_of_turn>user\n${userContent}<end_of_turn>\n<start_of_turn>model\n`
            : `<|im_start|>system\n${systemContent}<|im_end|>\n<|im_start|>user\n${userContent}<|im_end|>\n<|im_start|>assistant\n`;

          const workerResponse = await browserAI.generate(
            prompt,
            settings.browserModel,
            {
              temperature: settings.ollamaParams?.temperature,
              max_tokens: settings.ollamaParams?.max_tokens,
              top_p: settings.ollamaParams?.top_p,
              top_k: settings.ollamaParams?.top_k,
            },
          );
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: stripThinkTags(workerResponse) + "\n\n---\n*Generated by Browser AI.*", citedLaws: data.citedLaws || [] },
          ]);
          setLoading(false);
          return;
        }

        // --- CLOUD / BASIC STRATEGY ---
        const cloudBody = mode === "cloud" ? {
          ...body,
          provider: settings.provider,
          model: settings.model,
          customEndpoint: settings.customEndpoint,
          ollamaParams: settings.ollamaParams, // Include parameters for Cloud mode too
        } : body;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cloudBody),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "API Error");

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: stripThinkTags(data.response) || "No response.", citedLaws: data.citedLaws || [] },
        ]);
      } catch (err) {
        console.error("Chat Error:", err);
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error." }]);
      } finally {
        setLoading(false);
      }
    },
    [settings, mode, conversationId, setMessages, setLoading, browserAI]
  );

  return { sendMessage, browserAIStatus: browserAI.status };
}
