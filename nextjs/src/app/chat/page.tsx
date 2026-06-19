"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "../../components/chat-context";
import { useAuth } from "../../components/auth-context";
import {
  MessageSquare,
  Send,
  Loader2,
  Scale,
  Plug,
  Cloud,
  Brain,
  FileText,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import {
  ChatMode,
  CitedLaw,
  MODE_LABELS,
  LANGUAGE_NAMES,
} from "../../lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  citedLaws?: CitedLaw[];
}

const MODE_META: Record<
  ChatMode,
  { icon: typeof Plug; color: string; label: string }
> = {
  local: { icon: Plug, color: "text-[#888888]", label: "Local AI" },
  cloud: { icon: Cloud, color: "text-[#888888]", label: "Cloud AI" },
  browser: { icon: Brain, color: "text-[#888888]", label: "Browser AI" },
  basic: { icon: FileText, color: "text-[#888888]", label: "Basic Search" },
};

const LIMITATION_BANNERS: Record<ChatMode, string | null> = {
  local:
    "Local AI — only works when broker.py + Ollama are running on your machine.",
  cloud:
    "Cloud AI — uses your own API key. You are billed by your provider.",
  browser:
    "Browser AI — downloads a ~1GB model on first use. Fully private.",
  basic:
    "Basic Search — searches laws and shows relevant excerpts. No AI analysis.",
};

function ChatContent() {
  const { settings, mode } = useChat();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [brokerAvailable, setBrokerAvailable] = useState<boolean | null>(null);
  const [workerStatus, setWorkerStatus] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<{
    resolve: (v: string) => void;
    reject: (e: any) => void;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // ── Session Storage for Guests ──
  useEffect(() => {
    if (!user) {
      const saved = sessionStorage.getItem("glv_guest_chat");
      if (saved) setMessages(JSON.parse(saved));
    }
  }, [user]);

  useEffect(() => {
    if (!user && messages.length > 0) {
      sessionStorage.setItem("glv_guest_chat", JSON.stringify(messages));
    }
  }, [messages, user]);

  const modeMeta = MODE_META[mode];
  const ModeIcon = modeMeta.icon;

  // Check broker health in local mode
  useEffect(() => {
    if (mode !== "local") {
      setBrokerAvailable(null);
      return;
    }
    const check = () => {
      fetch(`${settings.brokerUrl}/health`)
        .then((r) => setBrokerAvailable(r.ok))
        .catch(() => setBrokerAvailable(false));
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [mode, settings.brokerUrl]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Browser AI: Initialize worker ──
  useEffect(() => {
    if (mode !== "browser") {
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }
    if (workerRef.current) return;

    const worker = new Worker(
      new URL("../../workers/chat.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event) => {
      const { status, output, error } = event.data;
      if (status === "progress") {
        if (event.data.status === "download") {
          setWorkerStatus(
            `Downloading core... ${Math.round((event.data.loaded / event.data.total) * 100)}%`,
          );
        } else {
          setWorkerStatus(`Generating...`);
        }
      } else if (status === "complete") {
        setWorkerStatus(null);
        pendingRef.current?.resolve(output);
        pendingRef.current = null;
      } else if (status === "error") {
        setWorkerStatus(`Error: ${error}`);
        pendingRef.current?.reject(new Error(error));
        pendingRef.current = null;
      }
    };

    workerRef.current = worker;
    setWorkerStatus("AI model ready");

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [mode]);

  const handleSend = useCallback(
    async (e: React.FormEvent | null, overrideInput?: string) => {
      if (e) e.preventDefault();
      const userMsg = overrideInput || input;
      if (!userMsg.trim() || loading) return;

      if (!overrideInput) setInput("");
      setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
      setLoading(true);

      try {
        let currentConvId = conversationId;

        // Auto-create conversation for logged-in users if not exists
        if (user && !currentConvId) {
          const createRes = await fetch("/api/chat/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: userMsg.slice(0, 50) }),
          });
          if (createRes.ok) {
            const conv = await createRes.json();
            currentConvId = conv.id;
            setConversationId(conv.id);
          }
        }

        // Build request body based on mode
        const body: Record<string, any> = {
          message: userMsg,
          mode,
          language: settings.language,
          conversationId: currentConvId || undefined,
        };

        if (mode === "cloud") {
          body.provider = settings.provider;
          body.apiKey = settings.apiKey;
          body.model = settings.model;
          body.customEndpoint = settings.customEndpoint;
        }

        if (mode === "local") {
          // Mode 1: Local Ollama via broker (CLIENT SIDE)
          const langName = LANGUAGE_NAMES[settings.language] || "English";

          // Get Qdrant results from server first (no AI generation)
          const searchRes = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, mode: "basic" }),
          });
          const searchData = await searchRes.json();
          const contextStr = (searchData.citedLaws || [])
            .map((l: CitedLaw) => `[${l.law_key} ${l.norm_id}] ${l.law_title}`)
            .join("\n\n");

          const brokerRes = await fetch(`${settings.brokerUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: userMsg,
              context: contextStr,
              conversationId: currentConvId || undefined,
              model: settings.ollamaModel || undefined,
              language: langName,
              temperature: settings.ollamaParams?.temperature ?? 0.3,
              top_p: settings.ollamaParams?.top_p ?? 0.9,
              top_k: settings.ollamaParams?.top_k ?? 40,
              max_tokens: settings.ollamaParams?.max_tokens ?? 1024,
              system_prompt: settings.ollamaParams?.system_prompt || undefined,
            }),
          });

          if (!brokerRes.ok) {
            throw new Error(`Local broker error: ${brokerRes.status}`);
          }

          const localData = await brokerRes.json();

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: localData.response + "\n\n---\n*Generated by Local AI (Ollama).* ",
              citedLaws: searchData.citedLaws || [],
            },
          ]);
          setBrokerAvailable(true);
          setLoading(false);
          return;
        }

        if (mode === "browser") {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, mode: "basic" }),
          });
          const data = await res.json();
          const langName = LANGUAGE_NAMES[settings.language] || "English";
          const baseSystem = settings.ollamaParams?.system_prompt || "";

          const prompt = `${baseSystem}\n\nThe user's language is: ${langName}. Always respond in ${langName}.\n\nContext from German laws:\n${(data.citedLaws || []).map((l: CitedLaw) => `[${l.law_key} ${l.norm_id}] ${l.law_title}`).join("\n")}\n\nUser situation:\n${userMsg}\n\nProvide guidance based on the relevant laws above. Include citations.`;

          let workerResponse: string;
          if (workerRef.current) {
            workerResponse = await new Promise<string>((resolve, reject) => {
              const id = crypto.randomUUID();
              pendingRef.current = { resolve, reject };
              workerRef.current?.postMessage({
                id,
                prompt,
                model: settings.browserModel,
              });
            });
          } else {
            workerResponse = "Browser AI worker not available.";
          }

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: workerResponse + "\n\n---\n*Generated by Browser AI.*",
              citedLaws: data.citedLaws || [],
            },
          ]);
          setLoading(false);
          return;
        }

        // All other modes: server generates the response (Cloud / Basic)
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error?.message || data.error || "Unknown error";
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `⚠️ **API Error (${res.status}):** ${errMsg}`,
            },
          ]);
          setLoading(false);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response || "No response received.",
            citedLaws: data.citedLaws || [],
          },
        ]);
        if (data.brokerAvailable !== undefined) setBrokerAvailable(data.brokerAvailable);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, mode, settings, user, conversationId],
  );

  // Initial trigger from search param
  useEffect(() => {
    if (initialQuery && !initializedRef.current) {
      initializedRef.current = true;
      handleSend(null, initialQuery);
    }
  }, [initialQuery, handleSend]);

  return (
    <main className="flex flex-col h-[calc(100vh-64px)] bg-transparent">
      {/* ── Header ── */}
      <div className="glass-panel-heavy border-b border-white/5 p-6 relative z-20">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Scale className="w-6 h-6 text-accent-gold-bright" />
            <div className="flex flex-col">
              <h1 className="font-serif font-bold text-2xl text-white leading-tight tracking-tight">
                Legal Advisor
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 bg-accent-gold/10 text-accent-gold border border-accent-gold/20`}
                >
                  <ModeIcon className="w-2.5 h-2.5" />
                  {modeMeta.label}
                </span>
                {mode === "local" && brokerAvailable === true && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-accent-gold-bright uppercase tracking-widest">
                    <div className="w-1 h-1 rounded-full bg-accent-gold-bright animate-pulse" />
                    Online
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            href="/settings"
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-accent-gold transition-colors duration-300 flex items-center gap-2"
          >
            Terminal Config <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── Mode Limitation Banner ── */}
      <div className="bg-accent-gold/5 border-b border-accent-gold/10 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.3em] text-center text-accent-gold opacity-60">
        {LIMITATION_BANNERS[mode]}
      </div>

      {/* ── Chat Messages ── */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
        <div className="max-w-4xl mx-auto space-y-12 pb-32">
          {messages.length === 0 && (
            <div className="text-center py-32 animate-fade-in">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-10 border border-accent-gold/20 bg-accent-gold/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-accent-gold/5 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <MessageSquare className="w-10 h-10 text-accent-gold/40 group-hover:text-accent-gold transition-colors duration-500" />
              </div>
              <p className="monumental-type opacity-40 mb-4">Consult the Vault</p>
              <h2 className="text-3xl font-serif font-bold text-white mb-6 tracking-tight">
                Legal Inquiry Terminal
              </h2>
              <p className="text-zinc-500 max-w-sm mx-auto mb-10 legal-text italic font-serif leading-relaxed">
                Provide a factual scenario for precise statute retrieval and
                authoritative guidance.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] relative group ${
                  m.role === "user"
                    ? "px-6 py-4 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold-bright"
                    : "px-8 py-8 glass-panel text-zinc-300"
                }`}
              >
                {m.role === "assistant" && (
                  <>
                    <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-accent-gold/30" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-accent-gold/30" />
                    <div className="monumental-type opacity-20 mb-6 text-[8px]">
                      VAULT RESPONSE // REF {i.toString().padStart(4, "0")}
                    </div>
                  </>
                )}

                <div
                  className={`legal-text text-inherit whitespace-pre-wrap ${m.role === "assistant" ? "font-serif" : "font-sans font-semibold italic"}`}
                >
                  {m.content}
                </div>

                {m.citedLaws && m.citedLaws.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-white/5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-600 mb-6 flex items-center gap-3">
                      <Scale className="w-3 h-3" /> Referenced Statutes
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {m.citedLaws.map((law, j) => (
                        <Link
                          key={j}
                          href={`/laws/${law.law_key}`}
                          className="text-[10px] font-bold px-3 py-2 bg-white/5 border border-white/5 text-zinc-500 hover:bg-accent-gold/10 hover:text-accent-gold-bright hover:border-accent-gold/30 transition-all duration-500"
                        >
                          {law.law_key} {law.norm_id}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="glass-panel border-accent-gold/20 px-6 py-4 flex items-center gap-4">
                <div className="relative w-5 h-5">
                  <Loader2 className="absolute inset-0 w-5 h-5 text-accent-gold animate-spin" />
                  <Loader2 className="absolute inset-0 w-5 h-5 text-accent-gold animate-ping opacity-20" />
                </div>
                {mode === "browser" && workerStatus ? (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-gold">
                    {workerStatus}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Retrieving Statutes...
                  </span>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="glass-panel-heavy border-t border-white/5 p-8 relative z-20">
        <form onSubmit={(e) => handleSend(e)} className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "basic"
                ? "SEARCH STATUTE CODE..."
                : "DESCRIBE SCENARIO FOR ANALYSIS..."
            }
            className="w-full bg-white/5 border border-white/10 px-8 py-5 pr-20 focus:outline-none focus:border-accent-gold/40 focus:bg-white/[0.07] text-white placeholder:text-zinc-600 transition-all duration-500 font-bold tracking-wide"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold-bright disabled:opacity-20 transition-all duration-300 flex items-center justify-center group/btn active:scale-95 border border-accent-gold/10"
          >
            <Send className="w-5 h-5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
          </button>
        </form>

        {mode === "local" && brokerAvailable === false && (
          <p className="text-[9px] text-center text-red-500 mt-4 uppercase tracking-[0.2em] font-black animate-pulse">
            Local Node Offline — Ensure Ollama and Broker are running
          </p>
        )}

        <p className="text-[8px] text-center text-zinc-700 mt-5 uppercase tracking-[0.5em] font-bold">
          The Vault provides statutory analysis. This is not legally binding.
        </p>
      </div>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse">
            <Loader2 className="w-12 h-12 text-accent-gold animate-spin mb-4" />
            <p className="monumental-type opacity-40">Initializing Channel...</p>
        </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
