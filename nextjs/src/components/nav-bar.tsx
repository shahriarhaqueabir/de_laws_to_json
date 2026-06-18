'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Gavel, Search, MessageSquare, Bookmark, Settings, Plug, Cloud, Brain, FileText, Check, ChevronDown } from 'lucide-react';
import type { ChatMode, ChatSettings } from '../lib/types';

const STORAGE_KEY = 'glv_chat_settings';

const MODE_META: Record<ChatMode, { icon: typeof Plug; color: string; bg: string; label: string }> = {
  local:   { icon: Plug,     color: 'text-blue-600',     bg: 'bg-blue-100 dark:bg-blue-900/40',     label: 'Local AI' },
  cloud:   { icon: Cloud,    color: 'text-purple-600',   bg: 'bg-purple-100 dark:bg-purple-900/40',   label: 'Cloud AI' },
  browser: { icon: Brain,    color: 'text-emerald-600',  bg: 'bg-emerald-100 dark:bg-emerald-900/40', label: 'Browser AI' },
  basic:   { icon: FileText, color: 'text-gray-600',     bg: 'bg-gray-100 dark:bg-gray-800',          label: 'Basic Search' },
};

const navItems = [
  { href: '/', label: 'Search', icon: Search },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare },
  { href: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
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
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="p-1.5 bg-blue-600 rounded-lg text-white group-hover:bg-blue-700 transition-colors">
                <Gavel className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900 dark:text-white hidden sm:block">
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}

            {/* Mode indicator + quick switcher */}
            <div className="relative ml-2">
              <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${meta.bg} ${meta.color} hover:opacity-80`}
              >
                <ModeIcon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 py-2">
                    {(['basic', 'browser', 'cloud', 'local'] as ChatMode[]).map((m) => {
                      const mm = MODE_META[m];
                      const MI = mm.icon;
                      const isActive = m === mode;
                      return (
                        <button
                          key={m}
                          onClick={() => switchMode(m)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                            isActive
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <MI className={`w-4 h-4 ${mm.color}`} />
                          <span className="flex-1 font-medium">{mm.label}</span>
                          {isActive && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      );
                    })}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2 px-4">
                      <Link
                        href="/settings"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-blue-600 transition-colors py-1"
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
                  className={`p-2 rounded-md ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              );
            })}
            <Link
              href="/settings"
              className={`p-2 rounded-md ${
                pathname === '/settings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Settings className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
