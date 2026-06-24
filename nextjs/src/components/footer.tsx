"use client";

import { Scale, FileText } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "../hooks/useLanguage";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/5 bg-black/40 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Scale className="w-4 h-4 text-accent-gold opacity-60" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-700">
              {t("footer.tagline")}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/api-docs"
              className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 hover:text-accent-gold transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3 h-3" />
              API Docs
            </Link>
            <span className="text-xs font-bold uppercase tracking-[0.4em] text-zinc-800">
              {t("footer.copyright")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
