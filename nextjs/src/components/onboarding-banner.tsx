"use client";

import { useOnboarding } from "./onboarding-context";
import { useLanguage } from "../hooks/useLanguage";

export function OnboardingBanner() {
  const { state, setDismissed, setShowWizard } = useOnboarding();
  const { t } = useLanguage();

  // Don't show if completed, dismissed, or not yet mounted
  if (state.completed || state.dismissed) return null;

  return (
    <div className="w-full bg-accent-gold/5 border-b border-accent-gold/20">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-accent-gold-body">
          🏛 {t("onboarding.banner_text")}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWizard(true)}
            className="text-xs font-black uppercase tracking-[0.2em] px-4 py-2 bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/20 hover:bg-accent-gold/20 transition-colors active:scale-95"
          >
            {t("onboarding.start")}
          </button>
          <button
            onClick={setDismissed}
            className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {t("onboarding.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
