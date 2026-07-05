"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { AppLanguage, ChatMode } from "../lib/types";

const ONBOARDING_COMPLETED_KEY = "glv_onboarding_completed";
const ONBOARDING_STEP_KEY = "glv_onboarding_step";
const ONBOARDING_DISMISSED_KEY = "glv_onboarding_dismissed";
const ONBOARDING_COMPLETED_DATE_KEY = "glv_onboarding_completed_date";
const ONBOARDING_MODE_KEY = "glv_onboarding_selected_mode";
const ONBOARDING_LANGUAGE_KEY = "glv_onboarding_selected_language";

export interface OnboardingState {
  completed: boolean;
  step: number; // 0-3, 0 = not started, 3 = completion step
  dismissed: boolean;
  completedDate: string | null;
  selectedMode: ChatMode | null;
  selectedLanguage: AppLanguage | null;
}

interface OnboardingContextValue {
  state: OnboardingState;
  setStep: (step: number) => void;
  goBack: () => void;
  setCompleted: () => void;
  setDismissed: () => void;
  setSelectedMode: (mode: ChatMode) => void;
  setSelectedLanguage: (lang: AppLanguage) => void;
  resetOnboarding: () => void;
  showWizard: boolean;
  setShowWizard: (show: boolean) => void;
}

const defaultState: OnboardingState = {
  completed: false,
  step: 0,
  dismissed: false,
  completedDate: null,
  selectedMode: null,
  selectedLanguage: null,
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [showWizard, setShowWizard] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
    const step = parseInt(
      localStorage.getItem(ONBOARDING_STEP_KEY) || "0",
      10,
    );
    const dismissed =
      localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
    const completedDate = localStorage.getItem(ONBOARDING_COMPLETED_DATE_KEY);
    const selectedMode = localStorage.getItem(
      ONBOARDING_MODE_KEY,
    ) as ChatMode | null;
    const selectedLanguage = localStorage.getItem(
      ONBOARDING_LANGUAGE_KEY,
    ) as AppLanguage | null;

    setState({
      completed,
      step,
      dismissed,
      completedDate,
      selectedMode,
      selectedLanguage,
    });
  }, []);

  const persist = (key: string, value: string) => {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  };

  const setStep = (step: number) => {
    setState((prev) => ({ ...prev, step }));
    persist(ONBOARDING_STEP_KEY, String(step));
  };

  const goBack = () => {
    setState((prev) => {
      const next = Math.max(0, prev.step - 1);
      return { ...prev, step: next };
    });
    const currentStep = parseInt(
      localStorage.getItem(ONBOARDING_STEP_KEY) || "0",
      10,
    );
    persist(ONBOARDING_STEP_KEY, String(Math.max(0, currentStep - 1)));
  };

  const setCompleted = () => {
    const date = new Date().toISOString().split("T")[0];
    setState((prev) => ({
      ...prev,
      completed: true,
      step: 0,
      completedDate: date,
    }));
    persist(ONBOARDING_COMPLETED_KEY, "true");
    persist(ONBOARDING_STEP_KEY, "0");
    persist(ONBOARDING_COMPLETED_DATE_KEY, date);
  };

  const setDismissed = () => {
    setState((prev) => ({ ...prev, dismissed: true }));
    persist(ONBOARDING_DISMISSED_KEY, "true");
  };

  const setSelectedMode = (mode: ChatMode) => {
    setState((prev) => ({ ...prev, selectedMode: mode }));
    persist(ONBOARDING_MODE_KEY, mode);
  };

  const setSelectedLanguage = (lang: AppLanguage) => {
    setState((prev) => ({ ...prev, selectedLanguage: lang }));
    persist(ONBOARDING_LANGUAGE_KEY, lang);
  };

  const resetOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      localStorage.removeItem(ONBOARDING_STEP_KEY);
      localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
      localStorage.removeItem(ONBOARDING_COMPLETED_DATE_KEY);
      localStorage.removeItem(ONBOARDING_MODE_KEY);
      localStorage.removeItem(ONBOARDING_LANGUAGE_KEY);
    }
    setState(defaultState);
    setShowWizard(false);
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setStep,
        goBack,
        setCompleted,
        setDismissed,
        setSelectedMode,
        setSelectedLanguage,
        resetOnboarding,
        showWizard,
        setShowWizard,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx)
    throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
