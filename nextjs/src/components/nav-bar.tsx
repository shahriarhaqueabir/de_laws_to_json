'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gavel, Search, MessageSquare, Bookmark, Settings, Plug, Cloud, Brain, FileText, Check, ChevronDown, LogIn, User } from 'lucide-react';
import { useAuth } from './auth-context';
import type { ChatMode, ChatSettings } from '../lib/types';

const STORAGE_KEY = 'glv_chat_settings';

const MODE_META: Record<ChatMode, { icon: typeof Plug; color: string; bg: string; label: string }> = {
  local:   { icon: Plug,     color: 'text-blue-600',     bg: 'bg-[#1a1a1a]', label: 'Local AI' },
  cloud:   { icon: Cloud,    color: 'text-purple-600',   bg: 'bg-[#1a1a1a]', label: 'Cloud AI' },
  browser: { icon: Brain,    color: 'text-emerald-600',  bg: 'bg-[#1a1a1a]', label: 'Browser AI' },
  basic:   { icon: FileText, color: 'text-gray-600',     bg: 'bg-[#1a1a1a]', label: 'Basic Search' },
};

const navItems = [
  { href: '/', label: 'Search', icon: Search },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare },
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mode, setMode] = useState<ChatMode>('basic');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSettings;
        setMode(parsed.mode || 'basic');
      }
    } catch {}
  }, []);

  const switchMode = (m: ChatMode) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const settings: ChatSettings = raw ? { ...JSON.parse(raw), mode: m } : { mode: m } as ChatSettings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
    setMode(m);
    setOpen(false);
  };

  const meta = MODE_META[mode];
  const ModeIcon = meta.icon;

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#0e0e0e]/80 border-b border-[#1a1a1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-1.5 bg-[#777777] rounded-none text-[#070707] group-hover:bg-[#999999] transition-all duration-100">
                <Gavel className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-[#cccccc] hidden sm:block">
                German Law Vault
              </span>
            </Link>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-none text-sm font-medium transition-all duration-100 active:translate-y-[1px] ${
                                      isActive
                                        ? 'bg-[#1a1a1a] text-[#777777]'
                                        : 'text-[#888888] hover:bg-[#1a1a1a]'
                                    }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}

            {/* Auth indicator */}
            <Link
              href={user ? '/settings' : '/auth'}
              className={`flex items-center gap-2 px-3 py-2 rounded-none text-sm font-medium transition-all duration-100 active:translate-y-[1px] ${
                user
                  ? 'bg-[#1a1a1a] text-[#888888] hover:text-[#999999]'
                  : 'text-[#888888] hover:text-[#999999]'
              }`}
              title={user?.email ?? ''}
            >
              {user ? (
                <>
                  <User className="w-4 h-4" />
                  <span className="max-w-[120px] truncate hidden lg:inline">{user.email}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span className="hidden lg:inline">Sign in</span>
                </>
              )}
            </Link>

            {/* Mode indicator + quick switcher */}
            <div className="relative ml-2">
              <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-none text-xs font-semibold transition-all duration-100 active:translate-y-[1px] ${meta.bg} ${meta.color} hover:opacity-80`}
              >
                <ModeIcon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-[#0e0e0e] border border-[#1a1a1a] rounded-none z-20 py-2">
                    {(['basic', 'browser', 'cloud', 'local'] as ChatMode[]).map((m) => {
                      const mm = MODE_META[m];
                      const MI = mm.icon;
                      const isActive = m === mode;
                      return (
                        <button
                          key={m}
                          onClick={() => switchMode(m)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-100 active:translate-y-[1px] ${
                                                      isActive
                                                        ? 'bg-[#1a1a1a] text-[#cccccc]'
                                                        : 'text-[#888888] hover:bg-[#1a1a1a]'
                                                    }`}
                        >
                          <MI className={`w-4 h-4 ${mm.color}`} />
                          <span className="flex-1 font-medium">{mm.label}</span>
                          {isActive && <Check className="w-4 h-4 text-[#777777]" />}
                        </button>
                      );
                    })}
                    <div className="border-t border-[#1a1a1a] mt-2 pt-2 px-4">
                                          <Link
                                            href="/settings"
                                            onClick={() => setOpen(false)}
                                            className="flex items-center gap-2 text-xs text-[#555555] hover:text-[#999999] transition-all duration-100 active:translate-y-[1px] py-1"
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
                  className={`p-2 rounded-none transition-all duration-100 active:translate-y-[1px] ${
                                      isActive
                                        ? 'text-[#777777]'
                                        : 'text-[#888888]'
                                    }`}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              );
            })}
            <Link
              href={user ? '/settings' : '/auth'}
              className={`p-2 rounded-none transition-all duration-100 active:translate-y-[1px] ${
                user ? 'text-[#777777]' : 'text-[#888888]'
              }`}
            >
              {user ? <User className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
