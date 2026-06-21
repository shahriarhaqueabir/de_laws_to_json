"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Database,
  Plug,
  Cloud,
  Brain,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { useChat } from "../../components/chat-context";
import {
  ChatMode,
  CloudProvider,
  ChatSettings,
  MODE_LABELS,
  BROWSER_MODELS,
} from "../../lib/types";

const MODE_ICONS: Record<ChatMode, typeof Plug> = {
  local: Plug,
  cloud: Cloud,
  browser: Brain,
  basic: FileText,
};

const MODE_LIMITATIONS: Record<ChatMode, string[]> = {
  local: [
    "Requires Ollama + broker.py running on your machine",
    "Not available on the live site (Vercel)",
    "Model limited to what Ollama can run locally (default: qwen2.5:1.5b)",
  ],
  cloud: [
    "You are billed directly by your AI provider (OpenAI, Anthropic, etc.)",
    "API key is stored in your browser only — clears if you wipe site data",
    "Your question and law context are sent to the provider for processing",
  ],
  browser: [
    "Requires downloading a ~1GB AI model on first use (Qwen1.5, one-time)",
    "Generation is slower than cloud AI — runs on your CPU",
    "Uses Qwen1.5-0.5B — decent for simple guidance, less capable for complex legal reasoning",
    "Only works in browsers that support Web Workers + WASM",
  ],
  basic: [
    "No AI analysis or reasoning — shows raw legal text excerpts",
    "You must interpret the laws and their implications yourself",
    "Best for quick lookups or when you prefer to read the law directly",
  ],
};

const MODE_STATUS_NOTE: Record<ChatMode, string> = {
  local: "Broker must be running on localhost:9000",
  cloud: "Verify your API key is active",
  browser: "Model downloads on first use (~1GB)",
  basic: "Always available — no setup required",
};

export default function SettingsPage() {
  const { settings, updateSettings } = useChat();
  const [brokerOk, setBrokerOk] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [storedProvider, setStoredProvider] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keyMessage, setKeyMessage] = useState<string | null>(null);
  const [keyDecryptable, setKeyDecryptable] = useState(true);

  // Check stored API key status when in cloud mode
  useEffect(() => {
    if (settings.mode !== "cloud") return;
    fetch("/api/settings/api-key/status")
      .then((r) => r.json())
      .then((d) => {
        setHasStoredKey(d.hasKey);
        setKeyDecryptable(d.keyDecryptable);
        setStoredProvider(d.provider);
      })
      .catch(() => {});
  }, [settings.mode, settings.provider]);

  // Check broker health when in local mode
  useEffect(() => {
    if (settings.mode !== "local") return;
    const check = () => {
      fetch(`${settings.brokerUrl}/health`)
        .then((r) => setBrokerOk(r.ok))
        .catch(() => setBrokerOk(false));
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [settings.mode, settings.brokerUrl]);

  const update = (patch: Partial<ChatSettings>) => {
    updateSettings(patch);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (settings.mode === "local") {
        const res = await fetch(`${settings.brokerUrl}/health`);
        setTestResult(
          res.ok ? "System Reachable ✓" : `Protocol Error: ${res.status}`,
        );
      } else if (settings.mode === "cloud") {
        if (!hasStoredKey && !newApiKey) {
          setTestResult("Authentication Required");
          setTesting(false);
          return;
        }
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: 'Test connection — respond with "OK" only',
            mode: "cloud",
            provider: settings.provider,
            model: settings.model,
            customEndpoint: settings.customEndpoint,
          }),
        });
        const data = await res.json();
        setTestResult(
          res.ok
            ? "Access Verified ✓"
            : `Gateway Error: ${data.error?.message || data.error || res.status}`,
        );
      } else if (settings.mode === "browser") {
        // Test browser model download/init
        setTestResult("Initializing Neural Bridge...");
        const worker = new Worker(
          new URL("../../workers/chat.worker.ts", import.meta.url),
          { type: "module" },
        );

        const result = await new Promise<string>((resolve, reject) => {
          worker.onmessage = (e) => {
            if (e.data.status === "progress") {
              if (e.data.status === "download") {
                setTestResult(
                  `Retrieving Core... ${Math.round((e.data.loaded / e.data.total) * 100)}%`,
                );
              }
            } else if (
              e.data.status === "ready" ||
              e.data.status === "complete"
            ) {
              resolve("Cognition Ready ✓");
            } else if (e.data.status === "error") {
              reject(new Error(e.data.error));
            }
          };
          worker.onerror = (err) => reject(err);
          worker.postMessage({
            id: "test",
            prompt: "INIT_ONLY",
            model: settings.browserModel,
          });
        });

        setTestResult(result);
        worker.terminate();
      } else {
        setTestResult("Operational Mode Fixed");
      }
    } catch (err: unknown) {
      setTestResult(`Link Failure: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-20 bg-transparent min-h-screen relative">
      <div className="flex items-center justify-between mb-16 pb-8 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
            <Settings className="w-6 h-6 text-accent-gold" />
          </div>
          <div>
            <p className="monumental-type opacity-40 mb-1">System Core</p>
            <h1 className="text-4xl font-serif font-bold text-white tracking-tight">
              Configuration
            </h1>
          </div>
        </div>
        {saved && (
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent-gold-bright animate-fade-in bg-accent-gold/10 px-3 py-1 border border-accent-gold/20">
            States Synchronized
          </span>
        )}
      </div>

      {/* ── Chat Mode Selector ── */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="monumental-type opacity-50 shrink-0">
            Inference Protocols
          </h2>
          <div className="h-px w-full bg-zinc-800/50" />
        </div>

        <div className="grid gap-3">
          {(
            Object.entries(MODE_LABELS) as [
              ChatMode,
              (typeof MODE_LABELS)[ChatMode],
            ][]
          ).map(([mode, info]) => {
            const Icon = MODE_ICONS[mode];
            const isActive = settings.mode === mode;
            return (
              <button
                key={mode}
                onClick={() => update({ mode })}
                className={`flex items-start gap-6 p-6 border text-left transition-all duration-500 relative overflow-hidden group ${
                  isActive
                    ? "border-accent-gold/40 bg-white/[0.03] shadow-premium"
                    : "border-white/5 bg-transparent hover:border-white/10 hover:bg-white/[0.01]"
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-accent-gold shadow-[0_0_15px_var(--accent-gold-glow)]" />
                )}
                <div
                  className={`p-3 border transition-colors duration-500 ${
                    isActive
                      ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold-bright"
                      : "border-white/5 bg-white/5 text-zinc-600 group-hover:text-zinc-400"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-serif font-bold text-xl text-white">
                      {info.label}
                    </span>
                    {isActive && (
                      <span className="text-[8px] font-black uppercase tracking-[0.2em] text-accent-gold bg-accent-gold/10 px-2 py-0.5 border border-accent-gold/20">
                        Operational
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-xl">
                    {info.description}
                  </p>
                  {isActive && (
                    <div className="mt-4 space-y-2 pt-4 border-t border-white/5">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                        Environmental Constraints
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                        {MODE_LIMITATIONS[mode].map((lim, i) => (
                          <p
                            key={i}
                            className="text-[10px] text-zinc-500 font-bold flex items-start gap-2 italic"
                          >
                            <span className="text-accent-gold opacity-40">
                              /
                            </span>
                            {lim}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Mode-specific Configuration ── */}

      {/* Global AI Constraints (Parameters) */}
      {(settings.mode === "local" || settings.mode === "cloud") && (
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="monumental-type opacity-50 shrink-0">
              Global AI Constraints
            </h2>
            <div className="h-px w-full bg-zinc-800/50" />
          </div>

          <div className="glass-panel p-8 border-white/5 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Inference Temperature ({settings.ollamaParams.temperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.ollamaParams.temperature}
                  onChange={(e) =>
                    update({
                      ollamaParams: {
                        ...settings.ollamaParams,
                        temperature: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-accent-gold"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] font-bold text-zinc-600 uppercase">
                    Precise
                  </span>
                  <span className="text-[9px] font-bold text-zinc-600 uppercase">
                    Creative
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Max Generation Tokens
                </label>
                <input
                  type="number"
                  value={settings.ollamaParams.max_tokens}
                  onChange={(e) =>
                    update({
                      ollamaParams: {
                        ...settings.ollamaParams,
                        max_tokens: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 transition-all font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                Master System Guidelines (Consistency Logic)
              </label>
              <textarea
                rows={6}
                value={settings.ollamaParams.system_prompt}
                onChange={(e) =>
                  update({
                    ollamaParams: {
                      ...settings.ollamaParams,
                      system_prompt: e.target.value,
                    },
                  })
                }
                className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-sans text-xs leading-relaxed"
              />
              <p className="text-[10px] text-zinc-600 font-bold mt-3 italic">
                These guidelines ensure all AI modes (Local & Cloud) maintain
                the same &quot;Rechtsexperte&quot; persona and citation
                standards.
              </p>
            </div>
          </div>
        </section>
      )}

      {settings.mode === "local" && (
        <section className="glass-panel p-8 mb-8 border-white/5">
          <div className="flex items-center gap-4 mb-8">
            <Plug className="w-5 h-5 text-accent-gold" />
            <h2 className="font-serif font-bold text-xl text-white">
              Local Node Configuration
            </h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Endpoint Protocol (BROKER_URL)
                </label>
                <input
                  type="text"
                  value={settings.brokerUrl}
                  onChange={(e) => update({ brokerUrl: e.target.value })}
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Ollama Model Designation
                </label>
                <input
                  type="text"
                  value={settings.ollamaModel}
                  onChange={(e) => update({ ollamaModel: e.target.value })}
                  placeholder="e.g. qwen2.5:1.5b"
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-mono text-sm"
                />
              </div>
            </div>

            <div className="p-4 bg-accent-gold/5 border border-accent-gold/20 flex items-start gap-4">
              <ShieldAlert className="w-5 h-5 text-accent-gold mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-accent-gold uppercase tracking-[0.2em] mb-1">
                  Architecture Requirement
                </p>
                <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                  Ensure you have <span className="text-white">Ollama</span>{" "}
                  running on your machine and have started the{" "}
                  <span className="text-white">local broker</span> script:
                  <code className="block mt-2 p-2 bg-black/40 border border-white/5 text-accent-gold">
                    cd broker && python broker.py
                  </code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
              <span className="text-zinc-600">Connectivity Status:</span>
              {brokerOk === null ? (
                <span className="text-zinc-500 flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-zinc-600 animate-pulse" />
                  Pinging Node...
                </span>
              ) : brokerOk ? (
                <span className="flex items-center gap-2 text-accent-gold-bright">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-gold-bright shadow-[0_0_8px_var(--accent-gold-bright)]" />
                  Link Established
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                  Node Offline
                </span>
              )}
            </div>

            <p className="text-[10px] text-zinc-600 font-bold italic border-l border-accent-gold/20 pl-4">
              Note: {MODE_STATUS_NOTE.local}
            </p>
          </div>
        </section>
      )}

      {settings.mode === "cloud" && (
        <section className="glass-panel p-8 mb-8 border-white/5">
          <div className="flex items-center gap-4 mb-8">
            <Cloud className="w-5 h-5 text-accent-gold" />
            <h2 className="font-serif font-bold text-xl text-white">
              Gateway Credentials
            </h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Service Provider
                </label>
                <select
                  value={settings.provider}
                  onChange={(e) =>
                    update({ provider: e.target.value as CloudProvider })
                  }
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-bold text-sm"
                >
                  <option value="openai">OpenAI Architecture</option>
                  <option value="anthropic">Anthropic Models</option>
                  <option value="openai-compatible">
                    OpenAI-Compatible Gateway
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Model Designation
                </label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder="e.g. gpt-4o-mini"
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                Secure Access Key
              </label>

              {hasStoredKey && !keyDecryptable && !showKeyInput ? (
                <div className="p-4 border border-yellow-500/30 bg-yellow-500/5 space-y-3">
                  <p className="text-sm text-yellow-400 font-bold">
                    ⚠ Encryption Key Changed
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Your stored API key was encrypted with a different server
                    encryption key and can no longer be decrypted. This happens
                    when the server&apos;s{" "}
                    <code className="text-zinc-300">SERVER_ENCRYPTION_KEY</code>{" "}
                    is rotated — existing ciphertexts become permanently
                    unreadable as a security property of AES-256-GCM.
                  </p>
                  <p className="text-xs text-zinc-500">
                    Please re-enter your API key below to restore Cloud AI
                    access. Your old key will be overwritten automatically.
                  </p>
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="px-4 py-2 border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/10 transition-all"
                  >
                    Re-enter Key
                  </button>
                </div>
              ) : hasStoredKey && !showKeyInput ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 px-4 py-3 border border-white/10 bg-white/5 text-zinc-400 font-mono text-sm">
                    ••••••••••••••••
                  </div>
                  <button
                    onClick={() => setShowKeyInput(true)}
                    className="px-4 py-3 border border-accent-gold/30 text-accent-gold text-xs font-bold hover:bg-accent-gold/10 transition-all"
                  >
                    Change
                  </button>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/settings/api-key", {
                        method: "DELETE",
                      });
                      if (res.ok) {
                        setHasStoredKey(false);
                        setKeyDecryptable(false);
                        setStoredProvider(null);
                      }
                    }}
                    className="px-4 py-3 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-all"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-mono text-sm"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!newApiKey) return;
                        setSavingKey(true);
                        try {
                          const res = await fetch("/api/settings/api-key", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              apiKey: newApiKey,
                              provider: settings.provider,
                            }),
                          });
                          if (res.ok) {
                            setHasStoredKey(true);
                            setKeyDecryptable(true);
                            setStoredProvider(settings.provider);
                            setShowKeyInput(false);
                            setNewApiKey("");
                            setKeyMessage("Key saved securely on server ✓");
                          } else {
                            setKeyMessage("Failed to save key");
                          }
                        } catch {
                          setKeyMessage("Network error");
                        } finally {
                          setSavingKey(false);
                          setTimeout(() => setKeyMessage(null), 3000);
                        }
                      }}
                      disabled={savingKey || !newApiKey}
                      className="px-4 py-3 border border-accent-gold/30 text-accent-gold text-xs font-bold hover:bg-accent-gold/10 transition-all disabled:opacity-40"
                    >
                      {savingKey ? "Saving..." : "Save Key"}
                    </button>
                    {hasStoredKey && (
                      <button
                        onClick={() => {
                          setShowKeyInput(false);
                          setNewApiKey("");
                        }}
                        className="px-4 py-3 border border-white/10 text-zinc-400 text-xs font-bold hover:bg-white/5 transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {keyMessage && (
                    <p className="text-[10px] text-accent-gold font-bold mt-1">
                      {keyMessage}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[10px] text-zinc-600 font-bold mt-3 italic">
                Key is encrypted and stored on our server. Never transmitted to
                third parties.
              </p>
            </div>

            {settings.provider === "openai-compatible" && (
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3">
                  Custom Gateway URL
                </label>
                <input
                  type="text"
                  value={settings.customEndpoint}
                  onChange={(e) => update({ customEndpoint: e.target.value })}
                  placeholder="https://api.openai.com"
                  className="w-full px-4 py-3 border border-white/10 bg-white/5 text-white focus:outline-none focus:border-accent-gold/40 focus:bg-white/10 transition-all font-mono text-sm"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {settings.mode === "browser" && (
        <section className="glass-panel p-8 mb-8 border-white/5">
          <div className="flex items-center gap-4 mb-8">
            <Brain className="w-5 h-5 text-accent-gold" />
            <h2 className="font-serif font-bold text-xl text-white">
              Neural Weights Selection
            </h2>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">
                Core Model (WASM-Optimized)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {BROWSER_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => update({ browserModel: m.id })}
                    className={`p-6 border text-left transition-all duration-500 relative overflow-hidden group ${
                      settings.browserModel === m.id
                        ? "border-accent-gold/40 bg-accent-gold/5"
                        : "border-white/5 bg-transparent hover:border-white/10 hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-serif font-bold text-lg text-white group-hover:text-accent-gold-bright transition-colors">
                        {m.name}
                      </span>
                      <span className="text-[9px] uppercase font-black text-accent-gold bg-accent-gold/10 px-2 py-0.5 border border-accent-gold/20">
                        {m.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-bold leading-relaxed">
                      {m.description}
                    </p>
                    {settings.browserModel === m.id && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-gold" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 bg-white/[0.02] border border-white/5">
              <p className="text-[10px] text-zinc-500 font-bold leading-relaxed italic">
                <ShieldAlert className="w-3.5 h-3.5 inline mr-2 text-accent-gold/40" />
                The selected neural weights will be cached in your
                browser&apos;s persistent storage. Initial retrieval requires a
                high-bandwidth link (~1.5GB).
              </p>
            </div>
          </div>
        </section>
      )}

      {settings.mode === "basic" && (
        <section className="glass-panel p-8 mb-8 border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <FileText className="w-5 h-5 text-accent-gold" />
            <h2 className="font-serif font-bold text-xl text-white">
              Archives Only
            </h2>
          </div>

          <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-xl">
            Inert search protocol. This mode bypasses AI analysis and retrieves
            raw statutory text from the vector vault. High reliability,
            zero-latency inference.
          </p>
        </section>
      )}

      {/* ── Test Connection Button ── */}
      {(settings.mode === "local" ||
        settings.mode === "cloud" ||
        settings.mode === "browser") && (
        <div className="flex items-center gap-6 mb-16">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-[10px] hover:bg-accent-gold-bright disabled:opacity-20 transition-all duration-500 active:scale-95 shadow-premium"
          >
            {testing
              ? "Running Sync..."
              : settings.mode === "browser"
                ? "Initiate Neural Link"
                : "Verify Link Integrity"}
          </button>
          {testResult && (
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${
                testResult.includes("✓") ||
                testResult.includes("Ready") ||
                testResult.includes("Established")
                  ? "text-accent-gold-bright"
                  : "text-red-400"
              }`}
            >
              {testResult}
            </span>
          )}
        </div>
      )}

      {/* ── Data Store ── */}
      <section className="border-t border-white/5 pt-12">
        <div className="flex items-center gap-4 mb-8">
          <Database className="w-5 h-5 text-zinc-600" />
          <h2 className="monumental-type opacity-50 shrink-0">
            Substrate Status
          </h2>
          <div className="h-px w-full bg-zinc-800/50" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 border border-white/5 bg-white/[0.01]">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">
              Vector Reservoir
            </p>
            <p className="text-xs text-zinc-400 font-bold">
              Qdrant Cloud (E5-Small // 107K Norms)
            </p>
          </div>
          <div className="p-5 border border-white/5 bg-white/[0.01]">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">
              Relational Registry
            </p>
            <p className="text-xs text-zinc-400 font-bold">
              Supabase (PostgreSQL 16 // Auth Tier 1)
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
