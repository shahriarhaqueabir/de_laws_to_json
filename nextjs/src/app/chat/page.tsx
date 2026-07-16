"use client";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChat } from "../../components/chat-context";
import { useAuth } from "../../components/auth-context";
import { SystemStatus } from "../../components/system-status";
import { FeatureGate } from "../../components/feature-gate";
import { useApiKeyStatus } from "../../hooks/useApiKeyStatus";
import ConversationList from "../../components/conversation-list";
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
  Menu,
} from "lucide-react";
import Link from "next/link";
import { ChatMode, CitedLaw, CloudProvider } from "../../lib/types";
import { useLanguage } from "../../hooks/useLanguage";

import { useChatStrategy } from "../../hooks/useChatStrategy";

interface Message {
  role: "user" | "assistant";
  content: string;
  citedLaws?: CitedLaw[];
  thinking?: boolean;
}

const MODE_META: Record<
  ChatMode,
  { icon: typeof Plug; color: string; tKey: string }
> = {
  local: { icon: Plug, color: "text-[#888888]", tKey: "chat.mode_local" },
  cloud: { icon: Cloud, color: "text-[#888888]", tKey: "chat.mode_cloud" },
  browser: { icon: Brain, color: "text-[#888888]", tKey: "chat.mode_browser" },
  basic: { icon: FileText, color: "text-[#888888]", tKey: "chat.mode_basic" },
};

function ChatContent() {
  const { settings, mode } = useChat();
  const { user } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  const { sendMessage, browserAIStatus } = useChatStrategy({
    settings,
    mode,
    conversationId,
    setMessages,
    setLoading,
  });

  const { hasStoredKey } = useApiKeyStatus();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // ── SEO: Set page title ──
  useEffect(() => {
    document.title = "AI Chat — German Law Vault";
  }, []);

  // ── Session Storage for Guests ──
  useEffect(() => {
    if (!user) {
      try {
        const saved = sessionStorage.getItem("glv_guest_chat");
        if (saved) setMessages(JSON.parse(saved));
      } catch { }
    }
  }, [user]);

  useEffect(() => {
    if (!user && messages.length > 0) {
      sessionStorage.setItem("glv_guest_chat", JSON.stringify(messages));
    }
  }, [messages, user]);

  // Poll Ollama health when in local mode
  useEffect(() => {
    if (mode !== "local") return;
    const check = () => {
      fetch(`${settings.brokerUrl}/api/tags`)
        .then((r) => setOllamaOk(r.ok))
        .catch(() => setOllamaOk(false));
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [mode, settings.brokerUrl]);

  const modeMeta = MODE_META[mode];
  const ModeIcon = modeMeta.icon;

  const handleSend = useCallback(
    async (e: React.FormEvent | null, overrideInput?: string) => {
      if (e) e.preventDefault();
      const userMsg = overrideInput || input;
      if (!userMsg.trim() || loading) return;

      if (!overrideInput) setInput("");
      setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
      setLoading(true);

      if (user && !conversationId) {
        const createRes = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userMsg.slice(0, 50) }),
        });
        if (createRes.ok) {
          const conv = await createRes.json();
          setConversationId(conv.id);
          router.push(`/chat/${conv.id}?initialMsg=${encodeURIComponent(userMsg)}`);
          return;
        }
      }

      await sendMessage(userMsg);

      // Save to Supabase (only for Basic/Cloud/Browser since Local saves in its own flow if needed,
      // but here we just need to ensure the assistant message is persisted if it didn't redirect)
      if (conversationId && user) {
        // Conversation save logic is already handled in API for Cloud/Basic,
        // but for Browser/Local we might need a sync call if not handled in useChatStrategy.
        // For simplicity and decoupling, we assume the API handles it or useChatStrategy does.
      }
    },
    [input, loading, mode, user, conversationId, router, sendMessage],
  );

  // Initial trigger from search param
  useEffect(() => {
    if (initialQuery && !initializedRef.current) {
      initializedRef.current = true;
      handleSend(null, initialQuery);
    }
  }, [initialQuery, handleSend]);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <ConversationList
        currentConversationId={conversationId ?? undefined}
        onSelect={(id) => router.push(`/chat/${id}`)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((p) => !p)}
      />
      <main className="flex flex-col flex-1 min-w-0 bg-transparent">
        {/* ── Header ── */}
        <div className="glass-panel-heavy border-b border-white/5 p-6 relative z-20">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              {/* Mobile hamburger */}
              <button
                onClick={() => setSidebarOpen((p) => !p)}
                className="lg:hidden text-zinc-500 hover:text-white transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <Scale className="w-6 h-6 text-accent-gold-bright" />
              <div className="flex flex-col">
                <h1 className="font-serif font-bold text-2xl text-white leading-tight tracking-tight">
                  {t("chat.title")}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] px-2 py-0.5 bg-accent-gold/10 text-accent-gold-body border border-accent-gold/20`}
                  >
                    <ModeIcon className="w-2.5 h-2.5" />
                    {t(modeMeta.tKey)}
                  </span>
                  <SystemStatus compact />
                </div>
              </div>
            </div>
            <Link
              href="/settings"
              className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-accent-gold transition-colors duration-300 flex items-center gap-2"
            >
              {t("chat.settings")} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* ── Mode Limitation Banner ── */}
        <div className="bg-accent-gold/5 border-b border-accent-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-center text-accent-gold-body opacity-60">
          {t("chat.limitation_" + mode)}
        </div>

        {/* ── Chat Messages ── */}
        <div
          className="flex-1 overflow-y-auto p-6 custom-scrollbar relative"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
        >
          <div className="max-w-4xl mx-auto space-y-12 pb-32">
            {messages.length === 0 && (
              <div className="text-center py-32 animate-fade-in">
                <div className="w-24 h-24 flex items-center justify-center mx-auto mb-10 border border-accent-gold/20 bg-accent-gold/5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-accent-gold/5 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <MessageSquare className="w-10 h-10 text-accent-gold/40 group-hover:text-accent-gold transition-colors duration-500" />
                </div>
                <p className="monumental-type opacity-40 mb-4">Legal Advice</p>
                <h2 className="text-3xl font-serif font-bold text-white mb-6 tracking-tight">
                  {t("chat.title")}
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
                  className={`max-w-[85%] relative group ${m.role === "user"
                    ? "px-6 py-4 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold-bright"
                    : "px-8 py-8 glass-panel text-zinc-300"
                    }`}
                >
                  {m.role === "assistant" && (
                    <>
                      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-accent-gold/30" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-accent-gold/30" />
                    </>
                  )}

                  <div
                    className={`legal-text text-inherit whitespace-pre-wrap ${m.role === "assistant" ? "font-serif" : "font-sans font-semibold italic"}`}
                  >
                    {m.thinking ? (
                      <span className="inline-flex items-center gap-2 text-zinc-500">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-gold/40" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-gold/60" />
                        </span>
                        <span className="text-sm font-mono tracking-wider">
                          Thinking
                          <span className="inline-flex overflow-hidden ml-0.5">
                            <span className="animate-[bounce_1.4s_infinite_0ms]">.</span>
                            <span className="animate-[bounce_1.4s_infinite_200ms]">.</span>
                            <span className="animate-[bounce_1.4s_infinite_400ms]">.</span>
                          </span>
                        </span>
                      </span>
                    ) : (
                      m.content
                    )}
                  </div>

                  {m.citedLaws && m.citedLaws.length > 0 && (
                    <div className="mt-10 pt-8 border-t border-white/5">
                      <p className="text-xs font-bold uppercase tracking-[0.4em] text-zinc-400 mb-6 flex items-center gap-3">
                        <Scale className="w-3 h-3" /> Referenced Statutes
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {m.citedLaws.map((law, j) => (
                          <Link
                            key={j}
                            href={`/laws/${encodeURIComponent(law.law_key)}`}
                            className="text-xs font-bold px-3 py-2 bg-white/5 border border-white/5 text-zinc-500 hover:bg-accent-gold/10 hover:text-accent-gold-bright hover:border-accent-gold/30 transition-colors duration-500"
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
              <div
                className="flex justify-start"
                role="status"
                aria-live="polite"
              >
                <div className="glass-panel border-accent-gold/20 px-6 py-4 flex items-center gap-4">
                  <div className="relative w-5 h-5">
                    <Loader2 className="absolute inset-0 w-5 h-5 text-accent-gold animate-spin" />
                    <Loader2 className="absolute inset-0 w-5 h-5 text-accent-gold animate-ping opacity-20" />
                  </div>
                  {mode === "browser" && browserAIStatus ? (
                    <span className="text-xs font-bold uppercase tracking-widest text-accent-gold-body">
                      {browserAIStatus}
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                      Searching laws...
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
          <form
            onSubmit={(e) => handleSend(e)}
            className="max-w-4xl mx-auto relative group"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={t("chat.placeholder")}
              placeholder={
                mode === "basic"
                  ? "Search statute code..."
                  : t("chat.placeholder")
              }
              className="w-full bg-white/5 border border-white/10 px-8 py-5 pr-20 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-gold/40 focus:bg-white/[0.07] text-white placeholder:text-zinc-400 transition-colors duration-500 font-bold tracking-wide"
              disabled={loading}
            />
            {/* ── Send button with mode-aware gating ── */}
            {(() => {
              const btn = (
                <button
                  type="submit"
                  aria-label={t("chat.send")}
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-2 bottom-2 aspect-square bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold-bright disabled:opacity-20 transition-colors duration-300 transition-transform duration-300 flex items-center justify-center group/btn active:scale-95 border border-accent-gold/10"
                >
                  <Send className="w-5 h-5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </button>
              );

              if (mode === "cloud") {
                return (
                  <FeatureGate
                    requirement="api-key"
                    message="Configure an API key in Settings to use Cloud AI"
                    met={hasStoredKey}
                    action={() => router.push("/settings")}
                  >
                    {btn}
                  </FeatureGate>
                );
              }

              if (mode === "local") {
                return (
                  <FeatureGate
                    requirement="ai-mode-local"
                    message="Ensure Ollama is running (ollama serve)"
                    met={ollamaOk === true}
                    action={() => router.push("/settings")}
                  >
                    {btn}
                  </FeatureGate>
                );
              }

              return btn;
            })()}
          </form>

          {mode === "local" && ollamaOk === false && (
            <p className="text-xs text-center text-red-500 mt-4 uppercase tracking-[0.2em] font-black animate-pulse">
              {t("chat.local_offline")} — Ensure Ollama is running (ollama serve)
            </p>
          )}

          <p className="text-xs text-center text-zinc-700 mt-5 uppercase tracking-[0.5em] font-bold">
            AI-generated analysis for informational purposes. Not legally
            binding.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex flex-col items-center justify-center min-h-[60vh] animate-pulse"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-12 h-12 text-accent-gold animate-spin mb-4" />
          <p className="monumental-type opacity-40">Loading...</p>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
