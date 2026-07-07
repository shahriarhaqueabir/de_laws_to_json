"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Scale,
  Layers,
  BookMarked,
  FolderOpen,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ── Types ──

interface Law {
  key: string;
  title: string;
  alt_title: string;
  category: string;
  authority: string;
  status: string;
  jurisdiction: string;
  last_changed: string;
  source: string;
  total_norms: number;
}

interface LawsResponse {
  data: Law[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CategoryCount {
  key: string;
  count: number;
}

interface CategoriesResponse {
  categories: CategoryCount[];
  total: number;
}

// ── Category display mapping ──

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  housing: { label: "Housing & Rent", icon: "🏠" },
  labor: { label: "Labor & Career", icon: "💼" },
  consumer: { label: "Consumer Rights", icon: "🛒" },
  traffic: { label: "Traffic & Transport", icon: "🚗" },
  family: { label: "Family & Life", icon: "👨‍👩‍👧‍👧" },
  criminal: { label: "Criminal Law", icon: "⚖️" },
  finance: { label: "Taxes & Finance", icon: "🏛️" },
  social: { label: "Health & Social", icon: "❤️" },
  public: { label: "Public & Rights", icon: "🏢" },
  tech: { label: "Tech & Environment", icon: "💻" },
  berlin: { label: "Berlin Specific", icon: "🗺️" },
  other: { label: "Other", icon: "📋" },
};

const CATEGORY_ACCENTS: Record<string, string> = {
  housing: "border-l-accent-gold",
  labor: "border-l-accent-electric",
  consumer: "border-l-accent-neon",
  traffic: "border-l-accent-gold",
  family: "border-l-accent-electric",
  criminal: "border-l-accent-neon",
  finance: "border-l-accent-gold",
  social: "border-l-accent-electric",
  public: "border-l-accent-neon",
  tech: "border-l-accent-gold",
  berlin: "border-l-accent-electric",
  other: "border-l-zinc-500",
};

// ── Tabs ──

type Tab = "browse" | "knowledgebase";

// ── Status Badge ──

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || "";
  const colors =
    s === "active"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : s === "superseded"
        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
        : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${colors}`}
    >
      {status || "Unknown"}
    </span>
  );
}

// ── Category Badge ──

function CategoryBadge({ category }: { category: string }) {
  const info = CATEGORY_LABELS[category];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-white/[0.03] border border-white/5 text-zinc-400">
      {info?.icon && <span className="text-[10px]">{info.icon}</span>}
      {info?.label || category}
    </span>
  );
}

// ── Law Card ──

function LawCard({ law }: { law: Law }) {
  const accent = CATEGORY_ACCENTS[law.category] || "border-l-zinc-500";

  return (
    <Link
      href={`/laws/${encodeURIComponent(law.key)}`}
      className={`block glass-panel border-white/5 border-l-2 ${accent} px-5 py-4 hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="font-mono text-xs font-black uppercase tracking-[0.15em] text-accent-gold-bright shrink-0">
              {law.key}
            </span>
            <StatusBadge status={law.status} />
          </div>
          <h3 className="font-serif font-bold text-sm text-white leading-snug group-hover:text-accent-gold-bright transition-colors duration-300 line-clamp-2">
            {law.title}
          </h3>
          {law.alt_title && (
            <p className="text-[11px] text-zinc-600 mt-0.5 italic line-clamp-1">
              {law.alt_title}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <CategoryBadge category={law.category} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            {law.total_norms} §
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main Page ──

export default function LawsPage() {
  const [tab, setTab] = useState<Tab>("browse");

  return (
    <main className="min-h-screen bg-transparent relative overflow-hidden">
      {/* ── Background Elements ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[800px] opacity-30">
          <div className="absolute inset-0 bg-radial-[at_50%_0%] from-accent-gold/20 via-transparent to-transparent blur-[120px]" />
        </div>
        <div className="absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay" />
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-28 pb-20 relative z-10">
        {/* ── Header ── */}
        <header className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 border border-accent-gold/30 bg-accent-gold/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent-gold" />
            </div>
          </div>
          <h1 className="font-serif font-bold text-4xl md:text-5xl text-white tracking-tight mb-3">
            German Law Database
          </h1>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto font-serif italic">
            Browse all 6,000+ German federal laws, organized by category. Search
            by name or key, filter by legal domain, and view the full
            knowledgebase.
          </p>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-accent-gold/50 to-transparent mx-auto mt-6" />
        </header>

        {/* ── Tabs ── */}
        <div className="flex items-center justify-center gap-1 mb-10">
          <button
            onClick={() => setTab("browse")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${tab === "browse"
              ? "bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/30"
              : "text-zinc-500 hover:text-white border border-transparent hover:border-white/10"
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Browse All Laws
          </button>
          <button
            onClick={() => setTab("knowledgebase")}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${tab === "knowledgebase"
              ? "bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/30"
              : "text-zinc-500 hover:text-white border border-transparent hover:border-white/10"
              }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            Knowledgebase
          </button>
        </div>

        {/* ── Tab Content ── */}
        {tab === "browse" ? <BrowseTab /> : <KnowledgebaseTab />}
      </div>
    </main>
  );
}

// ── Browse Tab ──

function BrowseTab() {
  const [data, setData] = useState<LawsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Fetch laws
  const fetchLaws = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page + 1));
      params.set("limit", "50");
      if (category) params.set("category", category);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/laws?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message || `Request failed (${res.status})`,
        );
      }
      const json: LawsResponse = await res.json();
      setData(json);
      setPageInput(String(json.page));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load laws");
    } finally {
      setLoading(false);
    }
  }, [page, category, debouncedSearch]);

  useEffect(() => {
    fetchLaws();
  }, [fetchLaws]);

  const goToPage = (p: number) => {
    if (p >= 0 && data && p < data.totalPages) {
      setPage(p);
    }
  };

  const handlePageInput = () => {
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && data) {
      goToPage(Math.max(0, Math.min(p - 1, data.totalPages - 1)));
    }
  };

  return (
    <div>
      {/* ── Filters ── */}
      <div className="glass-panel-heavy border-white/5 px-6 py-5 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by law name or key..."
              className="w-full bg-white/[0.03] border border-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent-gold/40 focus:bg-white/[0.05] transition-all duration-300"
              aria-label="Search laws"
            />
          </div>

          {/* Category filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
            className="bg-white/[0.03] border border-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-gold/40 transition-all duration-300 min-w-[180px]"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.icon} {info.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Results header ── */}
      {data && !loading && (
        <div className="flex items-center justify-between mb-5 px-1">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            {data.total === 1
              ? "1 law found"
              : `${data.total.toLocaleString()} laws found`}
            {debouncedSearch && (
              <span className="text-zinc-600">
                {" "}
                for &ldquo;{debouncedSearch}&rdquo;
              </span>
            )}
            {category && (
              <span className="text-zinc-600">
                {" "}
                in {CATEGORY_LABELS[category]?.label || category}
              </span>
            )}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Page {data.page} of {data.totalPages}
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
          <span className="ml-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
            Loading laws&hellip;
          </span>
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="glass-panel-heavy border-red-500/20 px-6 py-8 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">{error}</p>
        </div>
      )}

      {/* ── Law Cards ── */}
      {!loading && data && data.data.length > 0 && (
        <div className="space-y-3 mb-8">
          {data.data.map((law) => (
            <LawCard key={law.key} law={law} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && data && data.data.length === 0 && (
        <div className="glass-panel-heavy border-white/5 px-6 py-16 text-center">
          <Search className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 text-sm font-serif italic">
            No laws match your filters.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setDebouncedSearch("");
              setCategory("");
              setPage(0);
            }}
            className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-accent-gold-bright hover:text-white transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* ── Pagination ── */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6 border-t border-white/5">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 0}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 border border-white/5 hover:border-white/10 disabled:border-transparent"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600">
            <span>Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePageInput()}
              onBlur={handlePageInput}
              className="w-14 text-center bg-white/[0.03] border border-white/5 px-2 py-1.5 text-white focus:outline-none focus:border-accent-gold/40"
              aria-label="Go to page"
            />
            <span>of {data.totalPages.toLocaleString()}</span>
          </div>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= data.totalPages - 1}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 border border-white/5 hover:border-white/10 disabled:border-transparent"
            aria-label="Next page"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Knowledgebase Tab ──

function KnowledgebaseTab() {
  const [categories, setCategories] = useState<CategoriesResponse | null>(null);
  const [data, setData] = useState<LawsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
      setPageInput("1");
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  // Fetch category stats (lightweight, once)
  useEffect(() => {
    fetch("/api/laws/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: CategoriesResponse | null) => setCategories(json))
      .catch(() => { });
  }, []);

  // Fetch laws page-by-page (lazy, server-side pagination)
  const fetchLaws = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page + 1));
      params.set("limit", "50");
      if (category) params.set("category", category);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res = await fetch(`/api/laws?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error?.message || `Request failed (${res.status})`,
        );
      }
      const json: LawsResponse = await res.json();
      setData(json);
      setPageInput(String(json.page));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load laws");
    } finally {
      setLoading(false);
    }
  }, [page, category, debouncedSearch]);

  useEffect(() => {
    fetchLaws();
  }, [fetchLaws]);

  const goToPage = (p: number) => {
    if (p >= 0 && data && p < data.totalPages) {
      setPage(p);
    }
  };

  const handlePageInput = () => {
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && data) {
      goToPage(Math.max(0, Math.min(p - 1, data.totalPages - 1)));
    }
  };

  return (
    <div>
      {/* ── Stats Overview ── */}
      {categories && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="glass-panel-heavy border-white/5 px-6 py-6 text-center">
            <p className="text-4xl font-serif font-bold text-accent-gold-bright mb-1">
              {categories.total.toLocaleString()}
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Total Laws
            </p>
          </div>
          <div className="glass-panel-heavy border-white/5 px-6 py-6 text-center">
            <p className="text-4xl font-serif font-bold text-accent-electric mb-1">
              {categories.categories.length}
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Legal Domains
            </p>
          </div>
          <div className="glass-panel-heavy border-white/5 px-6 py-6 text-center">
            <p className="text-4xl font-serif font-bold text-accent-neon mb-1">
              {categories.categories
                .reduce((sum, c) => sum + c.count, 0)
                .toLocaleString()}
            </p>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Total Laws (verified)
            </p>
          </div>
        </div>
      )}

      {/* ── Category Breakdown ── */}
      {categories && (
        <div className="glass-panel-heavy border-white/5 px-6 py-6 mb-8">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 mb-6 flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5" />
            Laws by Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.categories.map((cat) => {
              const info = CATEGORY_LABELS[cat.key];
              const maxCount = categories.categories[0]?.count || 1;
              const barWidth = (cat.count / maxCount) * 100;
              const isActive = category === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setCategory(isActive ? "" : cat.key);
                    setPage(0);
                    setPageInput("1");
                  }}
                  className={`text-left px-4 py-3.5 border transition-all duration-300 group ${isActive
                    ? "bg-accent-gold/10 border-accent-gold/30"
                    : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] hover:border-white/10"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-2 text-sm text-white font-medium">
                      <span>{info?.icon || "📋"}</span>
                      <span>{info?.label || cat.key}</span>
                    </span>
                    <span className="text-xs font-bold font-mono text-accent-gold-bright">
                      {cat.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-gold/60 to-accent-gold-bright/80 transition-all duration-700"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Laws Table ── */}
      <div className="glass-panel-heavy border-white/5 px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            {category
              ? `Laws in ${CATEGORY_LABELS[category]?.label || category}`
              : "All Laws"}
          </h2>
          {data && !loading && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              {data.total.toLocaleString()} laws
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by law name or key..."
            className="w-full bg-white/[0.03] border border-white/5 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent-gold/40 transition-all duration-300"
            aria-label="Search knowledgebase"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
            <span className="ml-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Loading laws&hellip;
            </span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="py-8 text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
        )}

        {/* ── Table ── */}
        {!loading && data && data.data.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 border-b border-white/5">
                    <th className="pb-3 pr-4">Key</th>
                    <th className="pb-3 pr-4">Title</th>
                    <th className="pb-3 pr-4 hidden sm:table-cell">Category</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Status</th>
                    <th className="pb-3 pr-4 text-right">Norms</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {data.data.map((law) => (
                    <tr
                      key={law.key}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs font-black uppercase tracking-[0.1em] text-accent-gold-bright">
                          {law.key}
                        </span>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <p className="text-sm text-white leading-snug line-clamp-1">
                          {law.title}
                        </p>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <CategoryBadge category={law.category} />
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">
                        <StatusBadge status={law.status} />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="text-xs font-mono text-zinc-500">
                          {law.total_norms}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/laws/${encodeURIComponent(law.key)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-accent-gold-bright hover:text-white border border-accent-gold/20 hover:border-white/20 transition-all duration-300"
                          title="View full text, translate sections, and analyze"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="hidden lg:inline">View &amp; Analyze</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            {data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-5 mt-2 border-t border-white/5">
                <button
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 border border-white/5 hover:border-white/10 disabled:border-transparent"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>

                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-600">
                  <span>Page</span>
                  <input
                    type="text"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePageInput()}
                    onBlur={handlePageInput}
                    className="w-14 text-center bg-white/[0.03] border border-white/5 px-2 py-1.5 text-white focus:outline-none focus:border-accent-gold/40"
                    aria-label="Go to page"
                  />
                  <span>of {data.totalPages.toLocaleString()}</span>
                </div>

                <button
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= data.totalPages - 1}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 border border-white/5 hover:border-white/10 disabled:border-transparent"
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && data && data.data.length === 0 && (
          <div className="py-12 text-center">
            <Search className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm font-serif italic">
              No laws match the current filter.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setCategory("");
                setPage(0);
              }}
              className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-accent-gold-bright hover:text-white transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
