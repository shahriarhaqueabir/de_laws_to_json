"use client";

import { useState, useCallback } from "react";
import NormViewer from "../../../components/norm-viewer";
import { ArrowLeft, BookmarkPlus, BookmarkCheck, Scale } from "lucide-react";
import Link from "next/link";
import {
  isBookmarked,
  addBookmark,
  removeBookmark,
} from "../../../lib/bookmarks-v2";
import { toast } from "sonner";
import { useAuth } from "../../../components/auth-context";
import { useLanguage } from "../../../hooks/useLanguage";
import { FeatureGate } from "../../../components/feature-gate";
import { LawDetailResult } from "../../../lib/law-detail";

function LawBreadcrumbJsonLd({ lawKey, lawTitle }: { lawKey: string; lawTitle: string }) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://ai-assisted-german-law.vercel.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: lawTitle,
        item: `https://ai-assisted-german-law.vercel.app/laws/${encodeURIComponent(lawKey)}`,
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
    />
  );
}

export function LawContent({ law }: { law: LawDetailResult }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [bookmarked, setBookmarked] = useState(() =>
    isBookmarked(law.key as string),
  );

  const toggleBookmark = useCallback(async () => {
    if (bookmarked) {
      await removeBookmark(law.key as string);
      setBookmarked(false);
      toast.info("Archive entry removed");
    } else {
      await addBookmark({
        law_key: law.key as string,
        law_title: (law.title as string) || "",
        category: (law.category as string) || "",
        added_at: new Date().toISOString().split("T")[0],
      });
      setBookmarked(true);
      if (!user) {
        toast.info("Bookmark saved locally. Sign in to sync across devices.");
      } else {
        toast.success("Statute archived");
      }
    }
  }, [bookmarked, law, user]);

  const norms = (law.norms || []) as Record<string, unknown>[];
  const qdrantError = law.qdrant_error as string | null;
  const altTitle = law.alt_title as string | undefined;

  return (
    <>
      <LawBreadcrumbJsonLd lawKey={String(law.key)} lawTitle={String(law.title)} />
      <div className="max-w-5xl mx-auto px-6 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-accent-gold mb-16 transition-colors duration-500"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <header className="mb-20">
          <div className="flex flex-wrap items-center gap-6 mb-10">
            <div className="px-6 py-2 border border-accent-gold/40 bg-accent-gold/10 text-accent-gold-bright font-black tracking-[0.3em] text-sm">
              {String(law.key)}
            </div>
            <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40">
              {String(law.category)}
            </div>
            <FeatureGate
              requirement="auth"
              message="Sign in to sync bookmarks across devices"
              met={!!user}
            >
              <button
                onClick={toggleBookmark}
                className={`ml-auto flex items-center gap-3 px-6 py-2 text-xs font-black uppercase tracking-[0.2em] border transition-colors duration-500 active:scale-95 ${bookmarked
                  ? "bg-accent-gold text-black border-accent-gold"
                  : "bg-transparent text-zinc-500 border-white/10 hover:text-accent-gold hover:border-accent-gold/40"
                  }`}
              >
                {bookmarked ? (
                  <BookmarkCheck className="w-4 h-4" />
                ) : (
                  <BookmarkPlus className="w-4 h-4" />
                )}
                {bookmarked ? "Saved" : "Save"}
              </button>
            </FeatureGate>
          </div>

          <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-8 leading-[1.1] tracking-tight">
            {String(law.title)}
          </h1>
          {altTitle && (
            <p className="text-2xl text-zinc-500 font-serif italic mb-10 opacity-60">
              {altTitle}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5 overflow-hidden mt-16 relative">
            <div className="absolute inset-0 bg-brushed-metal opacity-[0.06] pointer-events-none" />
            <div className="bg-zinc-950/40 p-8">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
                Status
              </span>
              <span className="font-bold text-zinc-300 tracking-wide">
                {String(law.status)}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-8">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
                Authority
              </span>
              <span className="font-bold text-zinc-300 tracking-wide">
                {String(law.authority)}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-8">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
                Modified
              </span>
              <span className="font-bold text-zinc-300 tracking-wide">
                {String(law.last_changed || "Inert")}
              </span>
            </div>
            <div className="bg-zinc-950/40 p-8">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
                Density
              </span>
              <span className="font-bold text-zinc-300 tracking-wide tabular-nums">
                {String(law.total_norms ?? 0)} Sections
              </span>
            </div>
          </div>
        </header>

        <section>
          <div className="flex items-center gap-6 mb-12">
            <h2 className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40 shrink-0">
              Statutory Framework
            </h2>
            <div className="h-px w-full bg-white/5" />
          </div>

          <div className="space-y-6">
            {norms.length > 0 ? (
              norms.map((norm, idx) => (
                <NormViewer
                  key={idx}
                  normId={String(norm.norm_id)}
                  lawKey={String(law.key)}
                  title={String(norm.norm_title)}
                  content={String(norm.content)}
                />
              ))
            ) : (
              <div className="text-center py-20 glass-panel border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-diagonal-wire opacity-[0.06] pointer-events-none" />
                <p className="text-muted font-serif italic text-lg opacity-40">
                  {qdrantError ? qdrantError : String(t("laws.norms_empty"))}
                </p>
              </div>
            )}
          </div>
        </section>

        <footer className="mt-40 pt-12 border-t border-white/5 flex justify-center opacity-20">
          <Scale className="w-10 h-10 text-accent-gold" />
        </footer>
      </div>
    </>
  );
}
