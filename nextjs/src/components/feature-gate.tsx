"use client";

import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useChat } from "./chat-context";
import type { ChatMode } from "../lib/types";

export type GateRequirement =
  | "auth"
  | "api-key"
  | "ai-mode"
  | "ai-mode-local"
  | "browser-ai";

interface FeatureGateProps {
  requirement: GateRequirement;
  message: string;
  met: boolean;
  children: ReactNode;
  /** Optional: action when clicked (navigate to /auth or /settings) */
  action?: () => void;
}

function getModeSpecificMessage(mode: ChatMode): string {
  switch (mode) {
    case "cloud":
      return "Configure an API key in Settings to use this feature";
    case "local":
      return "Start your local broker to enable Local AI";
    case "browser":
      return "Browser AI needs ~1GB download — configure in Settings";
    default:
      // basic or unknown — fall through to the generic message prop
      return "";
  }
}

export function FeatureGate({
  requirement,
  message,
  met,
  children,
  action,
}: FeatureGateProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { settings } = useChat();

  if (met) {
    return <>{children}</>;
  }

  const tooltipMessage =
    requirement === "ai-mode"
      ? getModeSpecificMessage(settings.mode) || message
      : message;

  return (
    <div
      className="relative group cursor-not-allowed"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        if (!met) {
          e.preventDefault();
          e.stopPropagation();
          action?.();
        }
      }}
    >
      {/* Children rendered at reduced opacity */}
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Lock
          data-testid="lock-icon"
          className="w-5 h-5 text-accent-gold opacity-60"
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 px-4 py-2 bg-zinc-900 border border-white/10 text-xs text-zinc-300 font-medium whitespace-nowrap shadow-xl rounded-sm animate-fade-in pointer-events-none">
          {tooltipMessage}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45" />
        </div>
      )}
    </div>
  );
}
