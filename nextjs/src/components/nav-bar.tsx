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
  Menu,
  X,
  BookOpen,
} from "lucide-react";
import { useAuth } from "./auth-context";
import { useChat } from "./chat-context";
import type { ChatMode, AppLanguage } from "../lib/types";
import { LANGUAGE_LABELS } from "../lib/types";
import { useLanguage } from "../hooks/useLanguage";

const MODE_META: Record<
  ChatMode,
  {
    icon: typeof Plug;
    color: string;
    bg: string;
    tKey: string;
    accentVar: string;
  }
> = {
  local: {
    icon: Plug,
    color: "text-zinc-500",
    bg: "bg-white/5",
    tKey: "chat.mode_local",
    accentVar: "text-accent-neon",
  },
  cloud: {
    icon: Cloud,
    color: "text-zinc-500",
    bg: "bg-white/5",
    tKey: "chat.mode_cloud",
    accentVar: "text-accent-electric",
  },
  browser: {
    icon: Brain,
    color: "text-zinc-500",
    bg: "bg-white/5",
    tKey: "chat.mode_browser",
    accentVar: "text-accent-gold-bright",
  },
  basic: {
    icon: FileText,
    color: "text-zinc-500",
    bg: "bg-white/5",
    tKey: "chat.mode_basic",
    accentVar: "text-zinc-400",
  },
};

export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { mode, setMode, settings, updateSettings } = useChat();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: t("nav.search"), icon: Search },
    { href: "/laws", label: t("nav.laws"), icon: BookOpen },
    { href: "/chat", label: t("nav.chat"), icon: MessageSquare },
    { href: "/guidance", label: t("nav.guidance"), icon: Compass },
    { href: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark },
  ];

  // Global Escape key for mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  const currentLang = settings.language || "en";

  const switchMode = (m: ChatMode) => {
    setMode(m);
    setOpen(false);
  };

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <nav className="sticky top-6 z-50 w-full px-6" aria-label="Main navigation">
      <div className="max-w-5xl mx-auto glass-panel-heavy shadow-premium px-4 sm:px-6 py-2 border-white/5">
        <div className="flex justify-between items-center h-12">
          <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-3 xl:gap-5 shrink min-w-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
              <Scale className="w-5 h-5 text-accent-gold transition-transform duration-500 group-hover:rotate-12 shrink-0" />
              <span className="font-serif font-bold text-lg tracking-tight text-white hidden lg:block">
                Vault
              </span>
            </Link>

            <div className="hidden sm:flex sm:items-center gap-px sm:gap-0.5 lg:gap-1.5 shrink">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-0.5 sm:px-1 lg:px-2 xl:px-3 py-1.5 text-[0.5rem] sm:text-[0.55rem] md:text-[0.6rem] lg:text-xs font-bold uppercase tracking-[0.01em] sm:tracking-[0.05em] md:tracking-[0.1em] lg:tracking-[0.15em] whitespace-nowrap transition-colors duration-300 active:translate-y-[1px] relative group shrink-0 ${isActive
                      ? "text-accent-gold-body"
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

            {/* ── Mobile Hamburger ── */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
              className="sm:hidden flex items-center justify-center w-9 h-9 min-h-[44px] min-w-[44px] text-zinc-500 hover:text-white transition-colors duration-300"
              aria-label={
                mobileOpen ? "Close navigation menu" : "Open navigation menu"
              }
              aria-expanded={mobileOpen}
              aria-haspopup="true"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            {/* ── Mobile Drawer ── */}
            {mobileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden animate-fade-in"
                  onClick={() => setMobileOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="fixed top-0 left-0 z-50 h-full w-72 glass-panel-heavy border-r border-white/5 shadow-2xl animate-slide-in-left sm:hidden"
                  role="dialog"
                  aria-label="Navigation menu"
                >
                  <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
                    <Link
                      href="/"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3"
                    >
                      <Scale className="w-5 h-5 text-accent-gold" />
                      <span className="font-bold text-lg tracking-tight text-white">
                        Vault
                      </span>
                    </Link>
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="text-zinc-500 hover:text-white transition-colors"
                      aria-label="Close navigation menu"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="px-4 py-4 flex flex-col gap-1">
                    {navItems.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname.startsWith(item.href));
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-4 px-4 py-3.5 text-sm font-medium rounded-lg transition-all duration-300 ${isActive
                            ? "bg-white/[0.04] text-accent-gold-bright"
                            : "text-zinc-500 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{item.label}</span>
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-gold shadow-[0_0_8px_var(--accent-gold-bright)]" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t border-white/5">
                    <Link
                      href={user ? "/settings" : "/auth"}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 text-xs text-zinc-400 hover:text-accent-gold transition-colors duration-300"
                    >
                      <User className="w-4 h-4" />
                      {user ? user.email?.split("@")[0] : t("nav.sign_in")}
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2 shrink-0">
            <Link
              href={user ? "/settings" : "/auth"}
              className="flex items-center gap-1 md:gap-2 px-1 md:px-2 lg:px-3 py-2 text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-widest transition-colors duration-300 text-zinc-500 hover:text-white shrink-0"
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
                <span className="hidden lg:inline">{t("nav.sign_in")}</span>
              )}
            </Link>

            {user && (
              <button
                onClick={() => signOut()}
                className="p-2.5 text-zinc-400 hover:text-white transition-colors duration-300 min-h-[44px] min-w-[44px]"
                aria-label={t("nav.sign_out")}
                title={t("nav.sign_out")}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}

            {/* ── Language Selector ── */}
            <div className="relative ml-1">
              <button
                onClick={() => setLangOpen(!langOpen)}
                onKeyDown={(e) => e.key === "Escape" && setLangOpen(false)}
                aria-haspopup="true"
                aria-expanded={langOpen}
                className="flex items-center gap-1 px-1 sm:px-1.5 md:px-2.5 lg:px-3 py-2.5 text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.05em] sm:tracking-[0.1em] lg:tracking-[0.2em] text-zinc-600 hover:text-zinc-300 transition-colors duration-300 border border-transparent hover:border-white/10 shrink-0"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="tracking-[0.15em] lg:tracking-[0.3em]">{currentLang}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-40" />
              </button>

              {langOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setLangOpen(false)}
                  />
                  <div
                    className="absolute right-0 mt-3 w-52 glass-panel-heavy border-white/10 z-20 py-2 shadow-2xl animate-fade-in"
                    role="dialog"
                    aria-label="Select language"
                  >
                    <div className="px-4 pb-2 mb-2 border-b border-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                        Language
                      </p>
                    </div>
                    {(
                      Object.entries(LANGUAGE_LABELS) as [AppLanguage, string][]
                    ).map(([code, label]) => {
                      const isActive = code === currentLang;
                      return (
                        <button
                          key={code}
                          onClick={() => {
                            updateSettings({ language: code });
                            setLangOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-left transition-all duration-300 ${isActive
                            ? "bg-white/[0.04] text-accent-gold-bright"
                            : "text-zinc-500 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                          <span className="flex-1 tracking-normal normal-case text-sm">
                            {label}
                          </span>
                          <span className="text-[10px] opacity-40 tracking-[0.2em]">
                            {code.toUpperCase()}
                          </span>
                          {isActive && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="relative ml-1">
              <button
                onClick={() => setOpen(!open)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                aria-haspopup="true"
                aria-expanded={open}
                className={`flex items-center gap-1 md:gap-2 px-1 lg:px-2 xl:px-3 py-2.5 min-h-[44px] text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.03em] sm:tracking-[0.05em] lg:tracking-[0.15em] transition-colors duration-300 border border-white/5 ${meta.bg} ${meta.accentVar} hover:bg-white/10 hover:border-white/10 shrink-0`}
              >
                <ModeIcon className="w-3 h-3" />
                <span className="hidden lg:inline">
                  {t(meta.tKey)}
                </span>
                <ChevronDown className="w-2.5 h-2.5 opacity-40" />
              </button>

              {open && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  <div
                    className="absolute right-0 mt-3 w-64 glass-panel-heavy border-white/10 z-20 py-3 shadow-2xl animate-fade-in"
                    role="dialog"
                    aria-label="Select mode"
                  >
                    <div className="px-4 pb-2 mb-2 border-b border-white/5">
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                        Mode
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
                            className={`w-full flex items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-[0.1em] text-left transition-all duration-300 ${isActive
                              ? mm.accentVar + " bg-white/[0.04]"
                              : "text-zinc-500 hover:bg-white/5 hover:text-white"
                              }`}
                          >
                            <MI
                              className={`w-4 h-4 ${isActive ? mm.accentVar : "text-zinc-400"}`}
                            />
                            <span className="flex-1">{t(mm.tKey)}</span>
                            {isActive && <Check className="w-3 h-3" />}
                          </button>
                        );
                      },
                    )}
                    <div className="border-t border-white/5 mt-3 pt-3 px-4">
                      <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 hover:text-accent-gold transition-colors duration-300 py-1"
                      >
                        <Settings className="w-3 h-3" />
                        {t("nav.settings")}
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div >
    </nav >
  );
}
