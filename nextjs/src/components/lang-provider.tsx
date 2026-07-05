"use client";

import { useEffect } from "react";

const DIR_MAP: Record<string, string> = {
  ar: "rtl",
};

export function LangProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => {
      try {
        const raw = localStorage.getItem("glv_chat_settings");
        if (raw) {
          const settings = JSON.parse(raw);
          const lang = settings.language || "en";
          // Only update if different to avoid redundant DOM mutations
          if (document.documentElement.lang !== lang) {
            document.documentElement.lang = lang;
            document.documentElement.dir = DIR_MAP[lang] || "ltr";
          }
        }
      } catch {
        // localStorage may be unavailable
      }
    };

    apply();
    window.addEventListener("glv_settings_updated", apply);
    return () => window.removeEventListener("glv_settings_updated", apply);
  }, []);

  return <>{children}</>;
}
