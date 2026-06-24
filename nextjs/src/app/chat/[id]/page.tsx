"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ky from "ky";
import { useAuth } from "../../../components/auth-context";
import { useChat } from "../../../components/chat-context";
import ConversationList from "../../../components/conversation-list";
import { ChatMessageBubble } from "../../../components/chat-message-bubble";
import {
  Loader2,
  Send,
  Scale,
  MessageSquare,
  ArrowRight,
  Menu,
  Plug,
  Cloud,
  Brain,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { CitedLaw, ChatMode } from "../../../lib/types";

// ── Types ──

interface MessageData {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  cited_laws: unknown;
  created_at: string;
}

interface ConversationData {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationResponse {
  conversation: ConversationData;
  messages: MessageData[];
}

interface ChatApiResponse {
  response: string;
  citedLaws: CitedLaw[];
  brokerAvailable?: boolean | null;
  mode?: string;
}

// ── Helpers ──

const MODE_META: Record<ChatMode, { icon: typeof Plug; label: string }> = {
  local: { icon: Plug, label: "Local AI" },
  cloud: { icon: Cloud, label: "Cloud AI" },
  browser: { icon: Brain, label: "Browser AI" },
  basic: { icon: FileText, label: "Basic Search" },
};

function mapMessage(msg: MessageData) {
  let citedLaws: CitedLaw[] = [];
  if (Array.isArray(msg.cited_laws)) {
    citedLaws = msg.cited_laws as CitedLaw[];
  }
  return {
    role: msg.role,
    content: msg.content,
    citedLaws,
  };
}

// ── Component ──

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user } = useAuth();
  const { settings, mode } = useChat();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversation + messages
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const res = await ky.get(`/api/chat/conversations/${id}`);
      return await res.json<ConversationResponse>();
    },
    enabled: !!user && !!id,
  });

  const conversation = data?.conversation;
  const rawMessages = data?.messages ?? [];

  // Map DB snake_case to camelCase
  const messages = rawMessages.map(mapMessage);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, rawMessages.length]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const body: Record<string, unknown> = {
        message,
        mode: settings.mode,
        language: settings.language,
        conversationId: id,
      };

      if (settings.mode === "cloud") {
        body.provider = settings.provider;
        body.model = settings.model;
        body.customEndpoint = settings.customEndpoint;
      }

      const res = await ky.post("/api/chat", { json: body });
      return await res.json<ChatApiResponse>();
    },
    onSuccess: () => {
      // Refetch to get both user message and AI response from DB
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      // Also refresh sidebar list (updated_at changed)
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: () => {
      toast.error("Failed to send message");
    },
  });

  const handleSend = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || sendMutation.isPending) return;
      const msg = input;
      setInput("");
      sendMutation.mutate(msg);
    },
    [input, sendMutation],
  );

  const ModeIcon = MODE_META[mode]?.icon ?? FileText;

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <ConversationList
          currentConversationId={id}
          onSelect={(convId) => router.push(`/chat/${convId}`)}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((p) => !p)}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 animate-pulse">
            <Loader2 className="w-10 h-10 text-accent-gold animate-spin" />
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
              Loading conversation...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not Found / Error State ──
  if (isError || !conversation) {
    const isNotFound = error instanceof Error && error.message.includes("404");
    return (
      <div className="flex h-[calc(100vh-64px)]">
        <ConversationList
          currentConversationId={id}
          onSelect={(convId) => router.push(`/chat/${convId}`)}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((p) => !p)}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            {isNotFound ? (
              <>
                <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                <h2 className="text-xl font-serif font-bold text-white mb-2">
                  Conversation Not Found
                </h2>
                <p className="text-sm text-zinc-500 mb-6">
                  This conversation doesn&apos;t exist or has been deleted.
                </p>
                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-accent-gold-body hover:text-accent-gold-bright transition-colors"
                >
                  Start New Chat <ArrowRight className="w-3 h-3" />
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-xl font-serif font-bold text-white mb-2">
                  Something went wrong
                </h2>
                <p className="text-sm text-zinc-500 mb-6">
                  Failed to load this conversation.
                </p>
                <button
                  onClick={() => refetch()}
                  className="text-xs font-bold uppercase tracking-[0.3em] text-accent-gold-body hover:text-accent-gold-bright transition-colors"
                >
                  Try Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Normal Render ──
  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <ConversationList
        currentConversationId={id}
        onSelect={(convId) => router.push(`/chat/${convId}`)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((p) => !p)}
      />

      {/* Main chat area */}
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
                <h1 className="font-serif font-bold text-2xl text-white leading-tight tracking-tight truncate max-w-[200px] sm:max-w-[400px]">
                  {conversation.title}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] px-2 py-0.5 bg-accent-gold/10 text-accent-gold-body border border-accent-gold/20">
                    <ModeIcon className="w-2.5 h-2.5" />
                    {MODE_META[mode]?.label ?? mode}
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/settings"
              className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-accent-gold transition-colors duration-300 flex items-center gap-2"
            >
              Settings <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* ── Chat Messages ── */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          <div className="max-w-4xl mx-auto space-y-12 pb-32">
            {messages.length === 0 && (
              <div className="text-center py-32 animate-fade-in">
                <div className="w-24 h-24 flex items-center justify-center mx-auto mb-10 border border-accent-gold/20 bg-accent-gold/5">
                  <MessageSquare className="w-10 h-10 text-accent-gold/40" />
                </div>
                <p className="monumental-type opacity-40 mb-4">Continue</p>
                <h2 className="text-3xl font-serif font-bold text-white mb-6 tracking-tight">
                  {conversation.title}
                </h2>
                <p className="text-zinc-500 max-w-sm mx-auto mb-10 legal-text italic font-serif leading-relaxed">
                  Send a message to continue this legal inquiry.
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessageBubble
                key={i}
                role={msg.role}
                content={msg.content}
                citedLaws={msg.citedLaws}
                index={i}
              />
            ))}

            {sendMutation.isPending && (
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
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Retrieving Statutes...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input Area ── */}
        <div className="glass-panel-heavy border-t border-white/5 p-8 relative z-20">
          <form
            onSubmit={handleSend}
            className="max-w-4xl mx-auto relative group"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Chat message"
              placeholder={
                mode === "basic"
                  ? "SEARCH STATUTE CODE..."
                  : "DESCRIBE SCENARIO FOR ANALYSIS..."
              }
              className="w-full bg-white/5 border border-white/10 px-8 py-5 pr-20 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-gold focus:border-accent-gold/40 focus:bg-white/[0.07] text-white placeholder:text-zinc-400 transition-all duration-500 font-bold tracking-wide"
              disabled={sendMutation.isPending}
            />
            <button
              type="submit"
              disabled={sendMutation.isPending || !input.trim()}
              className="absolute right-2 top-2 bottom-2 aspect-square bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold-bright disabled:opacity-20 transition-all duration-300 flex items-center justify-center group/btn active:scale-95 border border-accent-gold/10"
              aria-label="Send message"
            >
              <Send className="w-5 h-5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
            </button>
          </form>

          <p className="text-xs text-center text-zinc-700 mt-5 uppercase tracking-[0.5em] font-bold">
            AI-generated analysis for informational purposes. Not legally
            binding.
          </p>
        </div>
      </main>
    </div>
  );
}
