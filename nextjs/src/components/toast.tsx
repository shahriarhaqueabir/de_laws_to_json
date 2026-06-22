"use client";

// Re-export sonner's toast as a drop-in replacement
// Components should import directly from "sonner" going forward
export { toast } from "sonner";

// Minimal ToastProvider for backward compatibility with legacy test wrappers
import { Toaster } from "sonner";
import type { ReactNode } from "react";

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "var(--bg-elevated)",
            border: "1px solid rgba(255,255,255,0.05)",
            color: "var(--text-secondary)",
          },
        }}
      />
    </>
  );
}
