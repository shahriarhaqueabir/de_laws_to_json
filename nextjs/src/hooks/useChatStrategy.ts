import { useCallback } from "react";
import { ChatMode, CitedLaw, CloudProvider, ChatSettings } from "../lib/types";
import { useBrowserAI } from "./useBrowserAI";
import { stripThinkTags } from "../lib/prompt-format";

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
  brokerOnline: boolean | null;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setBrokerOnline: (online: boolean | null) => void;
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

// SSRF Protection: Broker URL validation
const BROKER_URL_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
function isValidBrokerUrl(url: string): boolean {
  return BROKER_URL_REGEX.test(url);
}

export function useChatStrategy({
  settings,
  mode,
  conversationId,
  brokerOnline,
  setMessages,
  setBrokerOnline,
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
          // --- LOCAL AI STRATEGY ---
          if (!isValidBrokerUrl(settings.brokerUrl)) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "⚠️ **Local AI Broker configuration rejected.**\n\nThe broker URL must be a localhost address.",
              },
            ]);
            setBrokerOnline(false);
            setLoading(false);
            return;
          }

          // Pre-flight health check
          try {
            const healthRes = await fetch(`${settings.brokerUrl}/health`, { signal: AbortSignal.timeout(3000) });
            if (!healthRes.ok) throw new Error("Offline");
          } catch {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "⚠️ **Local AI Broker is offline.**" },
            ]);
            setBrokerOnline(false);
            setLoading(false);
            return;
          }

          // Get context
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

          const brokerRes = await fetch(`${settings.brokerUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: userMsg,
              context: contextStr,
              conversationId: conversationId || undefined,
              model: settings.ollamaModel || undefined,
              language: "English",
              temperature: settings.ollamaParams?.temperature ?? 0.3,
              top_p: settings.ollamaParams?.top_p ?? 0.9,
              top_k: settings.ollamaParams?.top_k ?? 40,
              max_tokens: settings.ollamaParams?.max_tokens ?? 8192,
              system_prompt: settings.ollamaParams?.system_prompt || undefined,
              stream: true,
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!brokerRes.ok) throw new Error("Broker failed");

          setMessages((prev) => [...prev, { role: "assistant", content: "", citedLaws }]);
          setBrokerOnline(true);

          const reader = brokerRes.body?.getReader();
          if (!reader) throw new Error("Body not readable");
          const decoder = new TextDecoder();
          let accumulatedContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.response) {
                    accumulatedContent += parsed.response;
                    const { display, thinking } = getStreamingDisplay(accumulatedContent);
                    setMessages((prev) => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { ...updated[updated.length - 1], content: display, thinking };
                      return updated;
                    });
                  }
                } catch {}
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

          const workerResponse = await browserAI.generate(prompt, settings.browserModel);
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
        if (data.brokerAvailable !== undefined) setBrokerOnline(data.brokerAvailable);

      } catch (err) {
        console.error("Chat Error:", err);
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error." }]);
      } finally {
        setLoading(false);
      }
    },
    [settings, mode, conversationId, brokerOnline, setMessages, setBrokerOnline, setLoading, browserAI]
  );

  return { sendMessage, browserAIStatus: browserAI.status };
}
