"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Check,
  ArrowRight,
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
} from "lucide-react";
import { useOnboarding } from "./onboarding-context";
import { useLanguage } from "../hooks/useLanguage";
import { useChat } from "./chat-context";
import { LANGUAGE_LABELS, type AppLanguage, type ChatMode } from "../lib/types";

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
          className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
            i <= current ? "bg-accent-gold" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

// ── Language Selection Step ──

function LanguageStep({
  onLanguageSelect,
}: {
  onLanguageSelect: (lang: AppLanguage) => void;
}) {
  const entries = Object.entries(LANGUAGE_LABELS) as [AppLanguage, string][];

  return (
    <div className="text-center">
      <Globe className="w-12 h-12 text-accent-gold mx-auto mb-6" />
      <h2 className="text-2xl font-serif font-bold text-white mb-3">
        Welcome to German Law Vault
      </h2>
      <p className="text-sm text-zinc-400 mb-10 max-w-md mx-auto">
        Select your preferred language for the interface
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-10">
        {entries.map(([code, label]) => (
          <button
            key={code}
            onClick={() => onLanguageSelect(code)}
            className="px-4 py-4 border border-white/10 bg-white/[0.02] hover:border-accent-gold/30 hover:bg-accent-gold/5 text-white text-sm font-bold transition-all duration-300 active:scale-95 rounded-sm"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mode Decision Tree Step ──

function ModeStep({
  onModeSelect,
}: {
  onModeSelect: (mode: ChatMode) => void;
}) {
  const { t } = useLanguage();
  const [q1, setQ1] = useState<boolean | null>(null);
  const [q2, setQ2] = useState<boolean | null>(null);
  const [q3, setQ3] = useState<boolean | null>(null);
  const [recommendation, setRecommendation] = useState<ChatMode | null>(null);

  const handleAnswer = useCallback(
    (question: number, answer: boolean) => {
      if (question === 1) {
        setQ1(answer);
        if (answer) setRecommendation("cloud");
      } else if (question === 2) {
        setQ2(answer);
        if (answer) setRecommendation("browser");
      } else if (question === 3) {
        setQ3(answer);
        if (!answer) setRecommendation("basic");
        else setRecommendation("local");
      }
    },
    [],
  );

  const modeMeta: Record<
    ChatMode,
    { icon: typeof FileText; color: string; description: string }
  > = {
    cloud: {
      icon: Cloud,
      color: "text-sky-400",
      description: t("onboarding.recommend_cloud"),
    },
    browser: {
      icon: Brain,
      color: "text-amber-400",
      description: t("onboarding.recommend_browser"),
    },
    local: {
      icon: Plug,
      color: "text-accent-gold-bright",
      description: t("onboarding.recommend_local"),
    },
    basic: {
      icon: FileText,
      color: "text-zinc-500",
      description: t("onboarding.recommend_basic"),
    },
  };

  const MIcon = recommendation ? modeMeta[recommendation].icon : FileText;

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-8 text-center">
        {t("onboarding.step_mode")}
      </h2>

      {!recommendation && (
        <div className="space-y-6 max-w-md mx-auto">
          {/* Q1 */}
          <div>
            <p className="text-sm font-bold text-zinc-300 mb-4">
              {t("onboarding.api_key_q")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleAnswer(1, true)}
                className="flex-1 px-6 py-3 border border-accent-gold/20 bg-accent-gold/5 text-accent-gold-bright text-sm font-bold hover:bg-accent-gold/10 transition-all active:scale-95"
              >
                {t("onboarding.yes")}
              </button>
              <button
                onClick={() => handleAnswer(1, false)}
                className="flex-1 px-6 py-3 border border-white/10 bg-white/[0.02] text-zinc-400 text-sm font-bold hover:border-white/20 transition-all active:scale-95"
              >
                {t("onboarding.no")}
              </button>
            </div>
          </div>

          {q1 === false && (
            <div>
              <p className="text-sm font-bold text-zinc-300 mb-4">
                {t("onboarding.browser_q")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAnswer(2, true)}
                  className="flex-1 px-6 py-3 border border-amber-400/20 bg-amber-400/5 text-amber-400 text-sm font-bold hover:bg-amber-400/10 transition-all active:scale-95"
                >
                  {t("onboarding.yes")}
                </button>
                <button
                  onClick={() => handleAnswer(2, false)}
                  className="flex-1 px-6 py-3 border border-white/10 bg-white/[0.02] text-zinc-400 text-sm font-bold hover:border-white/20 transition-all active:scale-95"
                >
                  {t("onboarding.no")}
                </button>
              </div>
            </div>
          )}

          {q2 === false && (
            <div>
              <p className="text-sm font-bold text-zinc-300 mb-4">
                {t("onboarding.ollama_q")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAnswer(3, true)}
                  className="flex-1 px-6 py-3 border border-accent-gold-bright/20 bg-accent-gold-bright/5 text-accent-gold-bright text-sm font-bold hover:bg-accent-gold-bright/10 transition-all active:scale-95"
                >
                  {t("onboarding.yes")}
                </button>
                <button
                  onClick={() => handleAnswer(3, false)}
                  className="flex-1 px-6 py-3 border border-white/10 bg-white/[0.02] text-zinc-400 text-sm font-bold hover:border-white/20 transition-all active:scale-95"
                >
                  {t("onboarding.no")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {recommendation && (
        <div className="max-w-sm mx-auto text-center animate-fade-in">
          <div className="p-6 border border-white/10 bg-white/[0.02] mb-6">
            <MIcon
              className={`w-10 h-10 mx-auto mb-4 ${modeMeta[recommendation].color}`}
            />
            <p className="text-sm text-zinc-400 mb-6">
              {modeMeta[recommendation].description}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => onModeSelect(recommendation)}
                className="w-full px-6 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
              >
                Continue with{" "}
                {recommendation === "cloud"
                  ? "Cloud"
                  : recommendation === "browser"
                    ? "Browser AI"
                    : recommendation === "local"
                      ? "Local AI"
                      : "Basic"}
              </button>
              <button
                onClick={() => {
                  setQ1(null);
                  setQ2(null);
                  setQ3(null);
                  setRecommendation(null);
                }}
                className="text-xs font-bold text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feature Overview Step ──

function FeatureStep() {
  const { t } = useLanguage();
  const features = [
    { icon: Search, label: t("onboarding.feature_search"), unlocked: true },
    {
      icon: MessageSquare,
      label: t("onboarding.feature_chat"),
      unlocked: false,
    },
    {
      icon: Compass,
      label: t("onboarding.feature_guidance"),
      unlocked: false,
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

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-8 text-center">
        {t("onboarding.feature_title")}
      </h2>
      <div className="space-y-3 max-w-md mx-auto">
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
                <Check className="w-4 h-4 text-green-500/60 shrink-0" />
              ) : (
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 shrink-0">
                  {t("onboarding.step_mode")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Completion Step ──

function CompleteStep() {
  const { t } = useLanguage();
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
    </div>
  );
}

// ── Main Wizard Component ──

export function OnboardingWizard() {
  const {
    state,
    setStep,
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

  const totalSteps = 4;

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

  const handleClose = () => {
    // Save current step so user can resume
    setStep(step);
    setShowWizard(false);
  };

  const stepLabels = [
    t("onboarding.step_language"),
    t("onboarding.step_mode"),
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

        {/* Content */}
        <div className="px-8 py-8">
          <StepIndicator current={step} total={totalSteps - 1} />

          {step === 0 && (
            <LanguageStep onLanguageSelect={handleLanguageSelect} />
          )}
          {step === 1 && <ModeStep onModeSelect={handleModeSelect} />}
          {step === 2 && <FeatureStep />}
          {step === 3 && <CompleteStep />}
        </div>

        {/* Footer */}
        {step === totalSteps - 1 && (
          <div className="px-8 pb-8 pt-4 border-t border-white/5">
            <button
              onClick={() => {
                setCompleted();
                setShowWizard(false);
              }}
              className="w-full px-6 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
            >
              {t("onboarding.start_app")}{" "}
              <ArrowRight className="w-3 h-3 inline ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
