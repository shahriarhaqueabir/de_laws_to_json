'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  ShieldAlert,
  Scale,
  Plug,
  Cloud,
  Brain,
  FileText,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react';
import Link from 'next/link';
import {
  ChatMode,
  ChatSettings,
  CitedLaw,
  DEFAULT_CHAT_SETTINGS,
  MODE_LABELS,
} from '../../lib/types';

const STORAGE_KEY = 'glv_chat_settings';

function loadSettings(): ChatSettings {
  if (typeof window === 'undefined') return DEFAULT_CHAT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CHAT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CHAT_SETTINGS;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citedLaws?: CitedLaw[];
}

const MODE_META: Record<ChatMode, { icon: typeof Plug; color: string; label: string }> = {
  local: { icon: Plug, color: 'text-blue-600', label: 'Local AI' },
  cloud: { icon: Cloud, color: 'text-purple-600', label: 'Cloud AI' },
  browser: { icon: Brain, color: 'text-emerald-600', label: 'Browser AI' },
  basic: { icon: FileText, color: 'text-gray-600', label: 'Basic Search' },
};

const LIMITATION_BANNERS: Record<ChatMode, string | null> = {
  local: '🔌 Local AI — only works when broker.py + Ollama are running on your machine. Unavailable on the live site.',
  cloud: '☁️ Cloud AI — uses your own API key. You are billed by your provider. Key stored in browser only.',
  browser: '🧠 Browser AI — downloads a ~1GB model on first use (Qwen1.5). Slower than cloud AI. Fully private.',
  basic: '📄 Basic Search — searches laws and shows excerpts. No AI analysis. You interpret the results.',
};

export default function ChatPage() {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [brokerAvailable, setBrokerAvailable] = useState<boolean | null>(null);
  const [workerStatus, setWorkerStatus] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<{ resolve: (v: string) => void; reject: (e: any) => void } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mode = settings.mode;
  const modeMeta = MODE_META[mode];
  const ModeIcon = modeMeta.icon;

  // Load settings on mount
  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Check broker health in local mode
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (mode !== 'local') { setBrokerAvailable(null); return; }
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Browser AI: Initialize worker ──
  useEffect(() => {
    if (mode !== 'browser') {
      workerRef.current?.terminate();
      workerRef.current = null;
      return;
    }
    if (workerRef.current) return;

    const worker = new Worker(
      new URL('../../workers/chat.worker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event) => {
      const { status, id, output, error } = event.data;
      if (status === 'progress') {
        if (event.data.status === 'download') {
          setWorkerStatus(`Downloading model... ${Math.round((event.data.loaded / event.data.total) * 100)}%`);
        } else if (event.data.status === 'progress') {
          setWorkerStatus(`Generating...`);
        }
      } else if (status === 'complete') {
        setWorkerStatus(null);
        pendingRef.current?.resolve(output);
        pendingRef.current = null;
      } else if (status === 'error') {
        setWorkerStatus(`Error: ${error}`);
        pendingRef.current?.reject(new Error(error));
        pendingRef.current = null;
      }
    };

    worker.onerror = (err) => {
      setWorkerStatus('Worker error');
      pendingRef.current?.reject(err);
      pendingRef.current = null;
    };

    workerRef.current = worker;
    setWorkerStatus('AI model ready');

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [mode]);

  const handleSend = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      // Build request body based on mode
      const body: Record<string, any> = {
        message: userMsg,
        mode,
        language: settings.language,
      };

      if (mode === 'cloud') {
        body.provider = settings.provider;
        body.apiKey = settings.apiKey;
        body.model = settings.model;
        body.customEndpoint = settings.customEndpoint;
      }

      if (mode === 'local') {
        body.language = settings.language;
        body.ollamaModel = settings.ollamaModel;
        body.ollamaParams = settings.ollamaParams;
      }

      // For browser mode, we need Qdrant results from the server but generate client-side
      if (mode === 'browser') {
        // Get Qdrant results from server (no AI generation)
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, mode: 'basic' }),
        });
        const data = await res.json();

        // Now generate with Transformers.js worker
        const prompt = `Context from German laws:\n${(data.citedLaws || []).map((l: CitedLaw) => `[${l.law_key} ${l.norm_id}] ${l.law_title}`).join('\n')}\n\nUser situation:\n${userMsg}\n\nProvide guidance based on the relevant laws above. Include citations.`;

        let workerResponse: string;
        if (workerRef.current) {
          workerResponse = await new Promise<string>((resolve, reject) => {
            const id = crypto.randomUUID();
            pendingRef.current = { resolve, reject };
            workerRef.current?.postMessage({ id, prompt });
          });
        } else {
          workerResponse = 'Browser AI worker not available. Please reload or switch to another mode.';
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: workerResponse + '\n\n---\n*Generated by Browser AI (Transformers.js). This is **not legally binding advice**.*',
            citedLaws: data.citedLaws || [],
          },
        ]);
        setLoading(false);
        return;
      }

      // All other modes: server generates the response
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response || 'No response received.',
          citedLaws: data.citedLaws || [],
        },
      ]);
      if (data.brokerAvailable !== undefined) {
        setBrokerAvailable(data.brokerAvailable);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please check your settings and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, mode, settings]);

  return (
    <main className="flex flex-col h-[calc(100vh-64px)] bg-[#070707]">
      {/* ── Header ── */}
      <div className="bg-[#0e0e0e] border-b border-[#1a1a1a] p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[#777777]" />
                        <h1 className="font-bold text-[#cccccc]">AI Legal Assistant</h1>
                        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-none ${modeMeta.color} bg-[#1a1a1a]`}>
              <ModeIcon className="w-3 h-3" />
              {modeMeta.label}
            </span>
            {mode === 'local' && brokerAvailable === true && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" /> Online
              </span>
            )}
            {mode === 'local' && brokerAvailable === false && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <XCircle className="w-3 h-3" /> Offline
              </span>
            )}
            {mode === 'browser' && workerStatus && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Brain className="w-3 h-3" /> {workerStatus}
              </span>
            )}
          </div>
          <Link href="/settings" className="text-xs text-[#555555] hover:text-[#999999] transition-all duration-100 active:translate-y-[1px]">Settings</Link>
        </div>
      </div>

      {/* ── Mode Limitation Banner ── */}
      <div className={`px-4 py-2 text-xs text-center ${
              mode === 'basic'
                ? 'bg-[#0e0e0e] text-[#888888]'
                : 'bg-[#1a1a1a] text-[#999999]'
            }`}>
        {LIMITATION_BANNERS[mode]}
      </div>

      {/* ── Chat Messages ── */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="bg-[#1a1a1a] w-16 h-16 rounded-none flex items-center justify-center mx-auto mb-4">
                              <MessageSquare className="w-8 h-8 text-[#777777]" />
              </div>
              <h2 className="text-xl font-bold text-[#cccccc] mb-2">
                              How can I help you today?
                            </h2>
              <p className="text-[#888888] max-w-md mx-auto mb-4">
                Describe a situation (e.g., &quot;My landlord wants to increase my rent&quot;) and I will search relevant German laws to provide guidance.
              </p>
              <p className="text-xs text-[#555555] max-w-sm mx-auto">
                Mode: {MODE_LABELS[mode].icon} {MODE_LABELS[mode].label} — {MODE_LABELS[mode].description}
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-none px-5 py-3 ${
                              m.role === 'user'
                                ? 'bg-[#777777] text-[#070707] rounded-tr-none'
                                : 'bg-[#0e0e0e] text-[#cccccc] border border-[#1a1a1a] rounded-tl-none'
                            }`}>
                <div className="prose dark:prose-invert max-w-none text-inherit whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </div>

                {m.citedLaws && m.citedLaws.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
                                      <p className="text-xs font-bold uppercase tracking-wider text-[#555555] mb-2">
                      Relevant Sources
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {m.citedLaws.map((law, j) => (
                        <Link
                                                  key={j}
                                                  href={`/laws/${law.law_key}`}
                                                  className="text-xs bg-[#1a1a1a] hover:bg-[#999999] hover:text-[#070707] text-[#cccccc] px-2 py-1 rounded-none transition-all duration-100 active:translate-y-[1px]"
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
                          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-none px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-5 h-5 text-[#777777] animate-spin" />
                              {mode === 'browser' && workerStatus && (
                                <span className="text-xs text-[#888888]">{workerStatus}</span>
                              )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Area ── */}
      <div className="bg-[#0e0e0e] border-t border-[#1a1a1a] p-4">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
          <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        mode === 'basic'
                          ? 'Search German laws... (e.g., Mietrecht, BGB § 558)'
                          : 'Describe your situation...'
                      }
                      className="flex-1 bg-[#070707] border border-[#1a1a1a] rounded-none px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#777777] text-[#cccccc]"
                      disabled={loading}
                    />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[#777777] hover:bg-[#999999] text-[#070707] p-3 rounded-none disabled:opacity-50 transition-all duration-100 active:translate-y-[1px]"
          >
            <Send className="w-6 h-6" />
          </button>
        </form>
        <p className="text-[10px] text-center text-[#555555] mt-2 uppercase tracking-widest font-medium">
          AI-generated guidance is not legal advice.
        </p>
      </div>
    </main>
  );
}
