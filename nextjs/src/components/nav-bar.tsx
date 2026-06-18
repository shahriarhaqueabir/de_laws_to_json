"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gavel,
  Search,
  MessageSquare,
  Bookmark,
  Settings,
  Plug,
  Cloud,
  Brain,
  FileText,
  Check,
  ChevronDown,
  LogIn,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "./auth-context";
import type { ChatMode, ChatSettings } from "../lib/types";

const STORAGE_KEY = "glv_chat_settings";

const MODE_META: Record<
  ChatMode,
  { icon: typeof Plug; color: string; bg: string; label: string }
> = {
  local: {
    icon: Plug,
    color: "text-[#888888]",
    bg: "bg-[#222222]",
    label: "Local AI",
  },
  cloud: {
    icon: Cloud,
    color: "text-[#888888]",
    bg: "bg-[#222222]",
    label: "Cloud AI",
  },
  browser: {
    icon: Brain,
    color: "text-[#888888]",
    bg: "bg-[#222222]",
    label: "Browser AI",
  },
  basic: {
    icon: FileText,
    color: "text-[#888888]",
    bg: "bg-[#222222]",
    label: "Basic Search",
  },
};

const navItems = [
  { href: "/", label: "Search", icon: Search },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState<ChatMode>("basic");
  const [open, setOpen] = useState(false);

  // Use a separate effect for hydration to avoid cascading renders
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSettings;
        if (parsed.mode && parsed.mode !== mode) {
          setMode(parsed.mode);
        }
      }
    } catch {}
  }, [mode]);

  const switchMode = (m: ChatMode) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const settings: ChatSettings = raw
        ? { ...JSON.parse(raw), mode: m }
        : ({ mode: m } as ChatSettings);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
    setMode(m);
    setOpen(false);
  };

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <nav className="sticky top-4 z-50 w-full px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto glass-panel shadow-premium px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-1.5 bg-accent-cobalt text-white shadow-[0_0_15px_rgba(46,91,255,0.4)] group-hover:scale-110 transition-transform duration-200">
                <Gavel className="w-4 h-4" />
              </div>
              <span className="font-serif font-bold text-lg tracking-tight text-white hidden sm:block">
                German Law Vault
              </span>
            </Link>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all duration-200 active:translate-y-[1px] relative group ${
                    isActive ? "text-accent-cobalt" : "text-[#a3a3a3] hover:text-white"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent-cobalt shadow-[0_0_8px_rgba(46,91,255,0.6)]" />
                  )}
                </Link>
              );
            })}

            {/* Auth indicator */}
            <Link
              href={user ? "/settings" : "/auth"}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-100 active:translate-y-[1px] text-[#e8e8e8] hover:text-[#888888]"
              title={user?.email ?? ""}
            >
              {user ? (
                <>
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate hidden lg:inline">
                    {user.email}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span className="hidden lg:inline">Sign in</span>
                </>
              )}
            </Link>

            {user && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors duration-100 active:translate-y-[1px] text-[#6b6b6b] hover:text-[#888888]"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

            {/* Mode indicator + quick switcher */}
            <div className="relative ml-2">
              <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors duration-100 active:translate-y-[1px] ${meta.bg} text-[#e8e8e8] hover:bg-[#2a2a2a]`}
              >
                <ModeIcon className="w-3.5 h-3.5 text-[#888888]" />
                <span>{meta.label}</span>
                <ChevronDown className="w-3 h-3 text-[#6b6b6b]" />
              </button>

              {open && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-[#0a0a0a] border border-[#222222] z-20 py-2 shadow-lg">
                    {(["basic", "browser", "cloud", "local"] as ChatMode[]).map(
                      (m) => {
                        const mm = MODE_META[m];
                        const MI = mm.icon;
                        const isActive = m === mode;
                        return (
                          <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-100 active:translate-y-[1px] ${
                              isActive
                                ? "bg-[#222222] text-[#e8e8e8]"
                                : "text-[#6b6b6b] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
                            }`}
                          >
                            <MI className={`w-4 h-4 ${mm.color}`} />
                            <span className="flex-1 font-medium">
                              {mm.label}
                            </span>
                            {isActive && (
                              <Check className="w-4 h-4 text-[#888888]" />
                            )}
                          </button>
                        );
                      },
                    )}
                    <div className="border-t border-[#222222] mt-2 pt-2 px-4">
                      <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 text-xs text-[#6b6b6b] hover:text-[#888888] transition-colors duration-100 active:translate-y-[1px] py-1"
                      >
                        <Settings className="w-3 h-3" />
                        Detailed settings
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile: icon only */}
          <div className="flex items-center sm:hidden gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`p-2 transition-colors duration-100 active:translate-y-[1px] ${
                    isActive ? "text-[#888888]" : "text-[#6b6b6b]"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              );
            })}

            {/* Mobile mode indicator */}
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="p-2 text-[#6b6b6b]"
                aria-label="Switch mode"
              >
                <ModeIcon className="w-5 h-5" />
              </button>
              {open && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-[#0a0a0a] border border-[#222222] z-20 py-2 shadow-lg">
                    {(["basic", "browser", "cloud", "local"] as ChatMode[]).map(
                      (m) => {
                        const mm = MODE_META[m];
                        const MI = mm.icon;
                        const isActive = m === mode;
                        return (
                          <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-100 active:translate-y-[1px] ${
                              isActive
                                ? "bg-[#222222] text-[#e8e8e8]"
                                : "text-[#6b6b6b] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
                            }`}
                          >
                            <MI className="w-4 h-4 text-[#888888]" />
                            <span className="flex-1 font-medium">
                              {mm.label}
                            </span>
                            {isActive && (
                              <Check className="w-4 h-4 text-[#888888]" />
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                </>
              )}
            </div>

            <Link
              href={user ? "/settings" : "/auth"}
              className={`p-2 transition-colors duration-100 active:translate-y-[1px] ${
                user ? "text-[#e8e8e8]" : "text-[#6b6b6b]"
              }`}
            >
              {user ? (
                <User className="w-5 h-5" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
            </Link>

            {user && (
              <button
                onClick={() => signOut()}
                className="p-2 text-[#6b6b6b]"
                aria-label="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
