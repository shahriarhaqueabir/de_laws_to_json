/**
 * state.js — Global state and constants for the German Law Vault.
 * All modules read/write to these variables. No module initialises its own
 * isolated state for values that are shared across modules.
 */
"use strict";

// ── Search & UI State ───────────────────────────────────────────────────────
let currentKeywords    = [];
let currentGermanTerms = [];
let currentLawKey      = null;
let indexReady         = false;
let statusInterval     = null;
let activeTab          = 'search'; // 'search' | 'browse' | 'saved' | 'settings'

// ── Vault & Modal State ─────────────────────────────────────────────────────
const VAULT_PAGE_SIZE = 48; // Must match PER_PAGE in app.py /api/laws
let vaultPage            = 1;
let vaultCategory        = '';
let vaultQ               = '';
let vaultTotal           = 0;
let vaultHasMore         = false;
let cachedLawData        = null;
let vaultRequestSeq      = 0;
let vaultAbortController = null;

// ── Abort Controllers ───────────────────────────────────────────────────────
let searchAbortController = null;
let modalAbortController  = null;
let mainAbortController   = null;
let aiAbortController     = null;

// ── Category Map ────────────────────────────────────────────────────────────
const CATEGORY_MAP = {
  "housing":  { title: "Housing & Rent",        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`, color: "#ffcc00" },
  "labor":    { title: "Work & Employment",      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`, color: "#3b82f6" },
  "consumer": { title: "Shopping & Sales",       icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`, color: "#00e676" },
  "traffic":  { title: "Traffic & Transport",    icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M7 21h10"/><path d="M12 16v5"/></svg>`, color: "#f59e0b" },
  "family":   { title: "Family & Life",          icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, color: "#ec4899" },
  "criminal": { title: "Criminal Law",           icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M12 3c-4.4 0-8 3.6-8 8"/><path d="M12 11c4.4 0 8 3.6 8 8"/><path d="M4 11h16"/></svg>`, color: "#ef4444" },
  "finance":  { title: "Taxes & Finance",        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`, color: "#10b981" },
  "social":   { title: "Health & Social",        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`, color: "#8b5cf6" },
  "public":   { title: "State & Rights",         icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`, color: "#6366f1" },
  "tech":     { title: "Innovation",             icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`, color: "#06b6d4" },
  "berlin":   { title: "Berlin Law",             icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>`, color: "#d946ef" },
  "other":    { title: "Other Laws",             icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`, color: "#94a3b8" }
};
