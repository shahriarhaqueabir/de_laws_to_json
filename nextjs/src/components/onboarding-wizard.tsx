"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  FileText,
  Brain,
  Cloud,
  Plug,
  Globe,
  Search,
  MessageSquare,
  Compass,
  Languages,
  Bookmark,
  ShieldAlert,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useOnboarding } from "./onboarding-context";
import { useLanguage } from "../hooks/useLanguage";
import { useChat } from "./chat-context";
import {
  LANGUAGE_LABELS,
  MODE_LABELS,
  BROWSER_MODELS,
  type AppLanguage,
  type ChatMode,
  type CloudProvider,
} from "../lib/types";

// ── Helpers ──

const MODE_ICONS: Record<ChatMode, typeof FileText> = {
  basic: FileText,
  browser: Brain,
  cloud: Cloud,
  local: Plug,
};

interface Feature {
  icon: typeof Search | typeof MessageSquare | typeof Compass | typeof Languages | typeof Bookmark;
  label: string;
  unlocked: boolean;
}

function getFeaturesForMode(
  mode: ChatMode,
  t: (key: string) => string,
): Feature[] {
  return [
    { icon: Search, label: t("onboarding.feature_search"), unlocked: true },
    {
      icon: MessageSquare,
      label: t("onboarding.feature_chat"),
      unlocked: mode !== "basic",
    },
    {
      icon: Compass,
      label: t("onboarding.feature_guidance"),
      unlocked: mode === "local" || mode === "cloud",
    },
    {
      icon: Languages,
      label: t("onboarding.feature_translation"),
      unlocked: true,
    },
    {
      icon: Bookmark,
      label: t("onboarding.feature_bookmarks"),
      unlocked: true,
    },
  ];
}

// ── Step Indicator ──

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-500 ${i <= current ? "bg-accent-gold" : "bg-white/10"
            }`}
        />
      ))}
    </div>
  );
}

// ── Step 0: Welcome + Language ──

function WelcomeStep({
  onLanguageSelect,
  selectedLanguage,
}: {
  onLanguageSelect: (lang: AppLanguage) => void;
  selectedLanguage: AppLanguage | null;
}) {
  const { t } = useLanguage();
  const entries = Object.entries(LANGUAGE_LABELS) as [AppLanguage, string][];

  return (
    <div className="text-center">
      <Globe className="w-12 h-12 text-accent-gold mx-auto mb-6" />
      <h2 className="text-2xl font-serif font-bold text-white mb-3">
        {t("onboarding.welcome_title")}
      </h2>
      <p className="text-sm text-zinc-400 mb-10 max-w-md mx-auto">
        {t("onboarding.welcome_desc")}
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-6">
        {entries.map(([code, label]) => {
          const isSelected = selectedLanguage === code;
          return (
            <button
              key={code}
              onClick={() => onLanguageSelect(code)}
              className={`px-4 py-4 border text-sm font-bold transition-all duration-300 active:scale-95 rounded-sm ${isSelected
                ? "border-accent-gold bg-accent-gold/10 text-accent-gold-bright"
                : "border-white/10 bg-white/[0.02] text-white hover:border-accent-gold/30 hover:bg-accent-gold/5"
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: Mode Selection ──

function ModeSelectStep({
  onContinue,
  selectedMode: initialMode,
}: {
  onContinue: (mode: ChatMode) => void;
  selectedMode: ChatMode | null;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<ChatMode | null>(initialMode);

  const modes: ChatMode[] = ["basic", "browser", "cloud", "local"];

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3 text-center">
        {t("onboarding.mode_select_title")}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 text-center max-w-md mx-auto">
        {t("onboarding.mode_select_desc")}
      </p>

      <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
        {modes.map((mode) => {
          const Icon = MODE_ICONS[mode];
          const isSelected = selected === mode;
          const meta = MODE_LABELS[mode];
          return (
            <button
              key={mode}
              onClick={() => setSelected(mode)}
              className={`relative flex flex-col items-start text-left p-5 border transition-all duration-300 ${isSelected
                ? "border-accent-gold bg-accent-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.08)]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-gold" />
              )}
              <Icon
                className={`w-7 h-7 mb-3 ${isSelected ? "text-accent-gold" : "text-zinc-500"
                  }`}
              />
              <span className="text-base font-serif font-bold text-white mb-1">
                {meta.label}
              </span>
              <span className="text-xs text-zinc-500 leading-relaxed line-clamp-3">
                {meta.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => selected && onContinue(selected)}
          disabled={!selected}
          className={`px-8 py-3 font-black uppercase tracking-[0.2em] text-xs transition-all active:scale-95 ${selected
            ? "bg-accent-gold text-black hover:bg-accent-gold-bright"
            : "bg-white/5 text-zinc-600 cursor-not-allowed"
            }`}
        >
          {t("onboarding.continue")}{" "}
          <ArrowRight className="w-3 h-3 inline ml-2" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Configuration Sub-components ──

function CloudConfig({ onContinue }: { onContinue: () => void }) {
  const { t } = useLanguage();
  const { settings, updateSettings } = useChat();
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState<CloudProvider>(
    settings.provider || "openai",
  );
  const [model, setModel] = useState(settings.model || "gpt-4o-mini");

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text);
    } catch {
      /* clipboard access denied */
    }
  };

  const handleContinue = () => {
    if (apiKey) updateSettings({ provider, model });
    onContinue();
  };

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3 text-center">
        {t("onboarding.config_title", { mode: MODE_LABELS.cloud.label })}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 text-center max-w-md mx-auto">
        {t("onboarding.config_cloud")}
      </p>

      <div className="space-y-5 max-w-md mx-auto">
        {/* API Key */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("onboarding.api_key_placeholder")}
              className="flex-1 px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-gold/40 transition-colors"
            />
            <button
              onClick={handlePaste}
              className="px-4 py-3 border border-white/10 text-xs font-bold text-zinc-400 hover:text-white hover:border-white/20 transition-all"
            >
              {t("onboarding.paste")}
            </button>
          </div>
          <p className="text-xs text-zinc-700 mt-2">
            {t("onboarding.cloud_key_note")}
          </p>
        </div>

        {/* Provider */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            {t("settings.provider")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["openai", "anthropic", "openai-compatible"] as CloudProvider[]).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => {
                    setProvider(p);
                    if (p === "openai") setModel("gpt-4o-mini");
                    else if (p === "anthropic")
                      setModel("claude-sonnet-4-20250514");
                  }}
                  className={`px-3 py-2 text-xs font-bold border transition-all ${provider === p
                    ? "border-accent-gold bg-accent-gold/10 text-accent-gold-bright"
                    : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                >
                  {p === "openai"
                    ? "OpenAI"
                    : p === "anthropic"
                      ? "Anthropic"
                      : "Compatible"}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            {t("settings.model")}
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-gold/40 transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
        <span />
        <div className="flex items-center gap-4">
          <button
            onClick={onContinue}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {t("onboarding.skip_config")}
          </button>
          <button
            onClick={handleContinue}
            className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
          >
            {t("onboarding.continue")}{" "}
            <ArrowRight className="w-3 h-3 inline ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LocalConfig({ onContinue }: { onContinue: () => void }) {
  const { t } = useLanguage();
  const { settings, updateSettings } = useChat();
  const [brokerUrl, setBrokerUrl] = useState(
    settings.brokerUrl || "http://localhost:9000",
  );
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "checking" | "connected" | "offline"
  >("idle");

  const testConnection = async () => {
    setConnectionStatus("checking");
    try {
      // Attempt to start the broker (non-fatal if it fails)
      await fetch("/api/broker/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Broker may already be running or managed externally — that's fine
    }
    try {
      const healthRes = await fetch(`${brokerUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      setConnectionStatus(healthRes.ok ? "connected" : "offline");
    } catch {
      setConnectionStatus("offline");
    }
  };

  const handleContinue = () => {
    updateSettings({ brokerUrl });
    onContinue();
  };

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3 text-center">
        {t("onboarding.config_title", { mode: MODE_LABELS.local.label })}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 text-center max-w-md mx-auto">
        {t("onboarding.config_local")}
      </p>

      <div className="space-y-5 max-w-md mx-auto">
        {/* Broker URL */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            {t("onboarding.local_broker_label")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              className="flex-1 px-4 py-3 bg-black/40 border border-white/10 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:border-accent-gold/40 transition-colors"
            />
            <button
              onClick={testConnection}
              disabled={connectionStatus === "checking"}
              className="px-4 py-3 border border-white/10 text-xs font-bold text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connectionStatus === "checking"
                ? "..."
                : t("onboarding.test_connection")}
            </button>
          </div>

          {/* Status feedback */}
          {connectionStatus === "checking" && (
            <div className="flex items-center gap-2 mt-2">
              <Settings className="w-3 h-3 text-zinc-500 animate-spin" />
              <span className="text-xs text-zinc-500">
                {t("onboarding.local_status_checking")}
              </span>
            </div>
          )}
          {connectionStatus === "connected" && (
            <div className="flex items-center gap-2 mt-2">
              <Wifi className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-500">
                {t("onboarding.local_status_connected")}
              </span>
            </div>
          )}
          {connectionStatus === "offline" && (
            <div className="flex items-center gap-2 mt-2">
              <WifiOff className="w-3 h-3 text-red-500" />
              <span className="text-xs text-red-500">
                {t("onboarding.local_status_offline")}
              </span>
            </div>
          )}
        </div>

        {/* Model info */}
        <div>
          <label className="block text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wider">
            {t("onboarding.local_model_label")}
          </label>
          <p className="text-sm text-zinc-500 bg-white/[0.02] border border-white/5 px-4 py-3">
            german-legal:latest + qwen2.5:1.5b-translate
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
        <span />
        <button
          onClick={handleContinue}
          className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
        >
          {t("onboarding.continue")}{" "}
          <ArrowRight className="w-3 h-3 inline ml-2" />
        </button>
      </div>
    </div>
  );
}

function BrowserConfig({ onContinue }: { onContinue: () => void }) {
  const { t } = useLanguage();
  const { settings, updateSettings } = useChat();
  const [selectedModel, setSelectedModel] = useState(
    settings.browserModel || BROWSER_MODELS[0].id,
  );

  const handleContinue = () => {
    updateSettings({ browserModel: selectedModel });
    onContinue();
  };

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3 text-center">
        {t("onboarding.config_title", { mode: MODE_LABELS.browser.label })}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 text-center max-w-md mx-auto">
        {t("onboarding.config_browser")}
      </p>

      <div className="space-y-4 max-w-md mx-auto mb-6">
        {BROWSER_MODELS.map((model) => {
          const isSelected = selectedModel === model.id;
          return (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={`w-full text-left p-4 border transition-all ${isSelected
                ? "border-accent-gold bg-accent-gold/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">
                  {model.name}
                </span>
                <span className="text-xs text-zinc-500">{model.size}</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {model.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/10 max-w-md mx-auto mb-2">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-400">
          First load downloads ~570MB. Runs entirely offline after that.
        </p>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
        <span />
        <button
          onClick={handleContinue}
          className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
        >
          {t("onboarding.continue")}{" "}
          <ArrowRight className="w-3 h-3 inline ml-2" />
        </button>
      </div>
    </div>
  );
}

function BasicConfig({ onContinue }: { onContinue: () => void }) {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3 text-center">
        {t("onboarding.config_title", { mode: MODE_LABELS.basic.label })}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 text-center max-w-md mx-auto">
        {t("onboarding.config_basic")}
      </p>

      <div className="max-w-md mx-auto">
        <p className="text-sm text-zinc-500 bg-white/[0.02] border border-white/5 px-4 py-6 text-center">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          {MODE_LABELS.basic.description}
        </p>
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
        <span />
        <button
          onClick={onContinue}
          className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
        >
          {t("onboarding.continue")}{" "}
          <ArrowRight className="w-3 h-3 inline ml-2" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Configuration (dispatcher) ──

function ConfigStep({ onContinue }: { onContinue: () => void }) {
  const { state } = useOnboarding();
  const mode = state.selectedMode;

  if (!mode) return null;

  switch (mode) {
    case "cloud":
      return <CloudConfig onContinue={onContinue} />;
    case "local":
      return <LocalConfig onContinue={onContinue} />;
    case "browser":
      return <BrowserConfig onContinue={onContinue} />;
    case "basic":
      return <BasicConfig onContinue={onContinue} />;
    default:
      return null;
  }
}

// ── Step 3: Dynamic Feature Overview ──

function FeatureStep({ onContinue }: { onContinue: () => void }) {
  const { t } = useLanguage();
  const { state } = useOnboarding();
  const mode = state.selectedMode || "basic";
  const features = getFeaturesForMode(mode, t);

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3 text-center">
        {t("onboarding.feature_title")}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 text-center max-w-md mx-auto">
        {MODE_LABELS[mode].label} mode features
      </p>
      <div className="space-y-3 max-w-md mx-auto mb-8">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className="flex items-center gap-4 px-5 py-4 border border-white/5 bg-white/[0.01]"
            >
              <Icon className="w-5 h-5 text-accent-gold opacity-60 shrink-0" />
              <span className="text-sm text-zinc-300 flex-1">{f.label}</span>
              {f.unlocked ? (
                <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-green-500" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                  <X className="w-3 h-3 text-zinc-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onContinue}
          className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
        >
          {t("onboarding.continue")}{" "}
          <ArrowRight className="w-3 h-3 inline ml-2" />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Completion ──

function CompleteStep({
  onStart,
}: {
  onStart: () => void;
}) {
  const { t } = useLanguage();
  const { state } = useOnboarding();
  const langLabel = state.selectedLanguage
    ? LANGUAGE_LABELS[state.selectedLanguage]
    : "";
  const modeLabel = state.selectedMode
    ? MODE_LABELS[state.selectedMode].label
    : "";

  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-accent-gold-bright" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3">
        {t("onboarding.complete_title")}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
        {t("onboarding.complete_desc")}
      </p>

      {/* Summary */}
      <div className="max-w-sm mx-auto mb-8 space-y-3">
        <div className="flex items-center justify-between px-5 py-4 border border-white/5 bg-white/[0.01]">
          <span className="text-sm text-zinc-400">
            {t("onboarding.step_language")}
          </span>
          <span className="text-sm font-bold text-white">{langLabel}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border border-white/5 bg-white/[0.01]">
          <span className="text-sm text-zinc-400">
            {t("onboarding.step_mode")}
          </span>
          <span className="text-sm font-bold text-white">{modeLabel}</span>
        </div>
      </div>

      <button
        onClick={onStart}
        className="px-8 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
      >
        {t("onboarding.start_app")}{" "}
        <ArrowRight className="w-3 h-3 inline ml-2" />
      </button>
    </div>
  );
}

// ── Main Wizard Component ──

export function OnboardingWizard() {
  const {
    state,
    setStep,
    goBack,
    setCompleted,
    setSelectedMode,
    setSelectedLanguage,
    showWizard,
    setShowWizard,
  } = useOnboarding();
  const { t } = useLanguage();
  const { updateSettings } = useChat();
  const [step, setLocalStep] = useState(state.step);

  // Keep local step in sync with context
  useEffect(() => {
    setLocalStep(state.step);
  }, [state.step]);

  if (!showWizard) return null;

  const totalSteps = 5;

  const advance = () => {
    const next = step + 1;
    if (next >= totalSteps) {
      setCompleted();
      setShowWizard(false);
    } else {
      setLocalStep(next);
      setStep(next);
    }
  };

  const handleLanguageSelect = (lang: AppLanguage) => {
    setSelectedLanguage(lang);
    updateSettings({ language: lang });
    advance();
  };

  const handleModeSelect = (mode: ChatMode) => {
    setSelectedMode(mode);
    updateSettings({ mode });
    advance();
  };

  const handleClose = () => {
    setStep(step);
    setShowWizard(false);
  };

  const handleStart = () => {
    setCompleted();
    setShowWizard(false);
  };

  const stepLabels = [
    t("onboarding.step_language"),
    t("onboarding.step_mode"),
    t("onboarding.step_setup"),
    t("onboarding.step_features"),
    t("onboarding.step_complete"),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-white/10 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-white/5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 opacity-50">
              {step + 1} / {totalSteps}
            </p>
            <p className="text-xs font-bold text-zinc-600 mt-1">
              {stepLabels[step]}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-600 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content with Sliding Animation */}
        <div className="px-8 py-8">
          <StepIndicator current={step} total={totalSteps} />

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {step === 0 && (
                <WelcomeStep
                  onLanguageSelect={handleLanguageSelect}
                  selectedLanguage={state.selectedLanguage}
                />
              )}
              {step === 1 && (
                <ModeSelectStep
                  onContinue={handleModeSelect}
                  selectedMode={state.selectedMode}
                />
              )}
              {step === 2 && <ConfigStep onContinue={advance} />}
              {step === 3 && <FeatureStep onContinue={advance} />}
              {step === 4 && <CompleteStep onStart={handleStart} />}
            </motion.div>
          </AnimatePresence>

          {/* Back button for steps 1-4 */}
          {step >= 1 && step <= 4 && (
            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("onboarding.back")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
