'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  Plug,
  Cloud,
  Brain,
  FileText,
  ShieldAlert,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  ChatMode,
  CloudProvider,
  ChatSettings,
  DEFAULT_CHAT_SETTINGS,
  PROVIDER_MODELS,
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

function saveSettings(s: ChatSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const MODE_ICONS: Record<ChatMode, typeof Plug> = {
  local: Plug,
  cloud: Cloud,
  browser: Brain,
  basic: FileText,
};

const MODE_LIMITATIONS: Record<ChatMode, string[]> = {
  local: [
    'Requires Ollama + broker.py running on your machine',
    'Not available on the live site (Vercel)',
    'Model limited to what Ollama can run locally (default: qwen2.5:1.5b)',
  ],
  cloud: [
    'You are billed directly by your AI provider (OpenAI, Anthropic, etc.)',
    'API key is stored in your browser only — clears if you wipe site data',
    'Your question and law context are sent to the provider for processing',
  ],
  browser: [
    'Requires downloading a ~1GB AI model on first use (Qwen1.5, one-time)',
    'Generation is slower than cloud AI — runs on your CPU',
    'Uses Qwen1.5-0.5B — decent for simple guidance, less capable for complex legal reasoning',
    'Only works in browsers that support Web Workers + WASM',
  ],
  basic: [
    'No AI analysis or reasoning — shows raw legal text excerpts',
    'You must interpret the laws and their implications yourself',
    'Best for quick lookups or when you prefer to read the law directly',
  ],
};

const MODE_STATUS_NOTE: Record<ChatMode, string> = {
  local: 'Broker must be running on localhost:9000',
  cloud: 'Verify your API key is active',
  browser: 'Model downloads on first use (~1GB)',
  basic: 'Always available — no setup required',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const [brokerOk, setBrokerOk] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  // Check broker health when in local mode
  useEffect(() => {
    if (settings.mode !== 'local') return;
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
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (settings.mode === 'local') {
        const res = await fetch(`${settings.brokerUrl}/health`);
        setTestResult(res.ok ? 'Broker is reachable ✓' : `Broker returned ${res.status}`);
      } else if (settings.mode === 'cloud') {
        if (!settings.apiKey) {
          setTestResult('Enter an API key first');
          setTesting(false);
          return;
        }
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Test connection — respond with "OK" only',
            mode: 'cloud',
            provider: settings.provider,
            apiKey: settings.apiKey,
            model: settings.model,
            customEndpoint: settings.customEndpoint,
          }),
        });
        const data = await res.json();
        setTestResult(res.ok ? 'API key works ✓' : `Error: ${data.error || res.status}`);
      } else {
        setTestResult('No test available for this mode');
      }
    } catch (err: unknown) {
      setTestResult(`Connection failed: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-10">
        <Settings className="w-8 h-8 text-gray-700 dark:text-gray-300" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        {saved && (
          <span className="text-sm text-green-600 font-medium ml-2">Saved ✓</span>
        )}
      </div>

      {/* ── Chat Mode Selector ── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">AI Chat Mode</h2>

        <div className="grid gap-4">
          {(Object.entries(MODE_LABELS) as [ChatMode, typeof MODE_LABELS[ChatMode]][]).map(
            ([mode, info]) => {
              const Icon = MODE_ICONS[mode];
              const isActive = settings.mode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => update({ mode })}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {info.icon} {info.label}
                      </span>
                      {isActive && (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {info.description}
                    </p>
                    {isActive && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                          Limitations
                        </p>
                        {MODE_LIMITATIONS[mode].map((lim, i) => (
                          <p key={i} className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                            <span className="text-amber-500 mt-0.5">⚠️</span>
                            {lim}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* ── Mode-specific Configuration ── */}

      {settings.mode === 'local' && (
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Plug className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Local AI Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Broker URL
              </label>
              <input
                type="text"
                value={settings.brokerUrl}
                onChange={(e) => update({ brokerUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Status:</span>
              {brokerOk === null ? (
                <span className="text-gray-400">Checking...</span>
              ) : brokerOk ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> Offline
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {MODE_STATUS_NOTE.local}
            </p>
          </div>
        </section>
      )}

      {settings.mode === 'cloud' && (
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cloud AI Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Provider
              </label>
              <select
                value={settings.provider}
                onChange={(e) => update({ provider: e.target.value as CloudProvider, model: PROVIDER_MODELS[e.target.value as CloudProvider][0] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai-compatible">OpenAI-Compatible</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => update({ apiKey: e.target.value })}
                placeholder={settings.apiKey ? '••••••••' : 'sk-...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Stored in your browser only. Never sent to our servers.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <select
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                {PROVIDER_MODELS[settings.provider].map((m) => (
                  <option key={m} value={m}>
                    {m === 'custom' ? 'Custom (specify in code)' : m}
                  </option>
                ))}
              </select>
            </div>

            {settings.provider === 'openai-compatible' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Endpoint URL
                </label>
                <input
                  type="text"
                  value={settings.customEndpoint}
                  onChange={(e) => update({ customEndpoint: e.target.value })}
                  placeholder="https://api.openai.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
                />
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {MODE_STATUS_NOTE.cloud}
            </p>
          </div>
        </section>
      )}

      {settings.mode === 'browser' && (
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Browser AI Configuration</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Model: LaMini-Flan-T5-783M
              </p>
              <p className="text-xs text-gray-500">
                Size: ~1.5GB • Type: Instruction-following • Runs entirely in your browser
              </p>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {MODE_STATUS_NOTE.browser}
            </p>
          </div>
        </section>
      )}

      {settings.mode === 'basic' && (
        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Basic Search</h2>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            No configuration needed. This mode searches German laws via Qdrant and shows
            relevant paragraphs directly in the chat. Always available.
          </p>
        </section>
      )}

      {/* ── Test Connection Button ── */}
      {(settings.mode === 'local' || settings.mode === 'cloud') && (
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <span
              className={`text-sm ${
                testResult.includes('✓') || testResult.includes('reachable')
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {testResult}
            </span>
          )}
        </div>
      )}

      {/* ── Data Store ── */}
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-5 h-5 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Data Store</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Connected to Qdrant Cloud (managed e5-small, 107K norms) and Supabase (PostgreSQL + Auth).
        </p>
      </section>
    </div>
  );
}
