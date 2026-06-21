"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  MessageSquare,
  Bookmark,
  Compass,
  Settings,
  Plug,
  Cloud,
  Brain,
  FileText,
  Check,
  ChevronDown,
  Globe,
  User,
  LogOut,
  Scale,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { useChat } from "./chat-context";
import type { ChatMode, AppLanguage } from "../lib/types";
import { LANGUAGE_LABELS } from "../lib/types";

const STORAGE_KEY = "glv_chat_settings";

const MODE_META: Record<
  ChatMode,
  { icon: typeof Plug; color: string; bg: string; label: string }
> = {
  local: {
    icon: Plug,
    color: "text-zinc-500",
    bg: "bg-white/5",
    label: "Local AI",
  },
  cloud: {
    icon: Cloud,
    color: "text-zinc-500",
    bg: "bg-white/5",
    label: "Cloud AI",
  },
  browser: {
    icon: Brain,
    color: "text-zinc-500",
    bg: "bg-white/5",
    label: "Browser AI",
  },
  basic: {
    icon: FileText,
    color: "text-zinc-500",
    bg: "bg-white/5",
    label: "Basic Search",
  },
};

const navItems = [
  { href: "/", label: "Vault", icon: Search },
  { href: "/chat", label: "Consult", icon: MessageSquare },
  { href: "/guidance", label: "Guidance", icon: Compass },
  { href: "/bookmarks", label: "Archives", icon: Bookmark },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { mode, setMode, settings, updateSettings } = useChat();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const currentLang = settings.language || "en";

  const switchLanguage = (lang: AppLanguage) => {
    updateSettings({ language: lang });
    setLangOpen(false);
  };

  const switchMode = (m: ChatMode) => {
    setMode(m);
    setOpen(false);
  };

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <nav className="sticky top-6 z-50 w-full px-6">
      <div className="max-w-5xl mx-auto glass-panel-heavy shadow-premium px-6 py-2 border-white/5">
        <div className="flex justify-between items-center h-12">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <Scale className="w-5 h-5 text-accent-gold transition-transform duration-500 group-hover:rotate-12" />
              <span className="font-serif font-bold text-lg tracking-tight text-white hidden sm:block">
                Vault
              </span>
            </Link>

            <div className="hidden sm:flex sm:items-center sm:gap-2">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 active:translate-y-[1px] relative group ${
                      isActive
                        ? "text-accent-gold"
                        : "text-zinc-500 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {isActive && (
                      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-gold shadow-[0_0_8px_var(--accent-gold-bright)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={user ? "/settings" : "/auth"}
              className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 text-zinc-500 hover:text-white"
              title={user?.email ?? ""}
            >
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border border-white/10 bg-white/5 flex items-center justify-center">
                    <User className="w-3 h-3 text-accent-gold" />
                  </div>
                  <span className="max-w-[120px] truncate hidden lg:inline">
                    {user.email?.split("@")[0]}
                  </span>
                </div>
              ) : (
                <span className="hidden lg:inline">Initialize Session</span>
              )}
            </Link>

            {user && (
              <button
                onClick={() => signOut()}
                className="p-2 text-zinc-600 hover:text-white transition-colors duration-300"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}

            {/* ── Language Selector ── */}
            <div className="relative ml-1">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 border border-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10"
                title="Language / Sprache"
              >
                <Globe className="w-3 h-3" />
                <span className="hidden md:inline">
                  {currentLang.toUpperCase()}
                </span>
                <ChevronDown className="w-2 h-2 opacity-40" />
              </button>

              {langOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setLangOpen(false)}
                  />
                  <div className="absolute right-0 mt-3 w-52 glass-panel-heavy border-white/10 z-20 py-3 shadow-2xl animate-fade-in">
                    <div className="px-4 pb-2 mb-2 border-b border-white/5">
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">
                        Language
                      </p>
                    </div>
                    {(Object.keys(LANGUAGE_LABELS) as AppLanguage[]).map(
                      (lang) => {
                        const isActive = lang === currentLang;
                        return (
                          <button
                            key={lang}
                            onClick={() => switchLanguage(lang)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-left transition-all duration-300 ${
                              isActive
                                ? "bg-accent-gold/10 text-accent-gold-bright"
                                : "text-zinc-500 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="text-xs w-6 text-center">
                              {lang === "de"
                                ? "🇩🇪"
                                : lang === "en"
                                  ? "🇬🇧"
                                  : lang === "tr"
                                    ? "🇹🇷"
                                    : lang === "ar"
                                      ? "🇸🇦"
                                      : lang === "fr"
                                        ? "🇫🇷"
                                        : lang === "es"
                                          ? "🇪🇸"
                                          : lang === "pl"
                                            ? "🇵🇱"
                                            : lang === "uk"
                                              ? "🇺🇦"
                                              : lang === "ru"
                                                ? "🇷🇺"
                                                : ""}
                            </span>
                            <span className="flex-1">
                              {LANGUAGE_LABELS[lang]}
                            </span>
                            {isActive && <Check className="w-3 h-3" />}
                          </button>
                        );
                      },
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="relative ml-1">
              <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 border border-white/5 ${meta.bg} text-zinc-400 hover:bg-white/10 hover:border-white/10`}
              >
                <ModeIcon className="w-3 h-3" />
                <span className="hidden md:inline">{meta.label}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-40" />
              </button>

              {open && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 mt-3 w-64 glass-panel-heavy border-white/10 z-20 py-3 shadow-2xl animate-fade-in">
                    <div className="px-4 pb-2 mb-2 border-b border-white/5">
                      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">
                        Operational Mode
                      </p>
                    </div>
                    {(["basic", "browser", "cloud", "local"] as ChatMode[]).map(
                      (m) => {
                        const mm = MODE_META[m];
                        const MI = mm.icon;
                        const isActive = m === mode;
                        return (
                          <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`w-full flex items-center gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-left transition-all duration-300 ${
                              isActive
                                ? "bg-accent-gold/10 text-accent-gold-bright"
                                : "text-zinc-500 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <MI
                              className={`w-4 h-4 ${isActive ? "text-accent-gold" : "text-zinc-600"}`}
                            />
                            <span className="flex-1">{mm.label}</span>
                            {isActive && <Check className="w-3 h-3" />}
                          </button>
                        );
                      },
                    )}
                    <div className="border-t border-white/5 mt-3 pt-3 px-4">
                      <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 hover:text-accent-gold transition-colors duration-300 py-1"
                      >
                        <Settings className="w-3 h-3" />
                        System Core Config
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
