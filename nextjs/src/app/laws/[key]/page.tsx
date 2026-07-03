"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import NormViewer from "../../../components/norm-viewer";
import { Law, Norm } from "../../../lib/types";
import {
  Loader2,
  ArrowLeft,
  BookmarkPlus,
  BookmarkCheck,
  Scale,
} from "lucide-react";
import Link from "next/link";
import {
  isBookmarked,
  addBookmark,
  removeBookmark,
} from "../../../lib/bookmarks-v2";
import { toast } from "sonner";
import { useAuth } from "../../../components/auth-context";
import { useLanguage } from "../../../hooks/useLanguage";

export default function LawDetailPage() {
  const { key } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<(Law & { norms: Norm[] }) | null>(null);
  const [qdrantError, setQdrantError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;

    const fetchLaw = async () => {
      try {
        const res = await fetch(`/api/laws/${key}`);
        if (!res.ok) throw new Error("Failed to load law details");
        const json = await res.json();
        if (json.qdrant_error) {
          setQdrantError(json.qdrant_error);
        }
        setData(json);
      } catch {
        setError("Law not found or could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    fetchLaw();
  }, [key]);

  const bookmarked = data ? isBookmarked(data.key) : false;

  const toggleBookmark = async () => {
    if (!data) return;
    if (bookmarked) {
      await removeBookmark(data.key);
      toast.info("Archive entry removed");
    } else {
      await addBookmark({
        law_key: data.key,
        law_title: data.title,
        category: data.category,
        added_at: new Date().toISOString().split("T")[0],
      });
      if (!user) {
        toast.info("Bookmark saved locally. Sign in to sync across devices.");
      } else {
        toast.success("Statute archived");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-pulse">
        <Loader2 className="w-16 h-16 text-accent-gold animate-spin mb-6" />
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40">
          {t("laws.loading")}
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-40 text-center">
        <h2 className="text-3xl font-serif font-bold text-white mb-6">
          {error || t("laws.not_found")}
        </h2>
        <Link
          href="/"
          className="text-accent-gold-body hover:text-accent-gold-bright flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
    );
  }

  return (
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
            {data.key}
          </div>
          <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-40">
            {data.category}
          </div>
          <button
            onClick={toggleBookmark}
            className={`ml-auto flex items-center gap-3 px-6 py-2 text-xs font-black uppercase tracking-[0.2em] border transition-colors duration-500 transition-transform duration-300 active:scale-95 ${
              bookmarked
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
        </div>

        <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-8 leading-[1.1] tracking-tight">
          {data.title}
        </h1>
        {data.alt_title && (
          <p className="text-2xl text-zinc-500 font-serif italic mb-10 opacity-60">
            {data.alt_title}
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 border border-white/5 overflow-hidden rounded-sm mt-16">
          <div className="bg-zinc-950/40 p-8">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
              Status
            </span>
            <span className="font-bold text-zinc-300 tracking-wide">
              {data.status}
            </span>
          </div>
          <div className="bg-zinc-950/40 p-8">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
              Authority
            </span>
            <span className="font-bold text-zinc-300 tracking-wide">
              {data.authority}
            </span>
          </div>
          <div className="bg-zinc-950/40 p-8">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
              Modified
            </span>
            <span className="font-bold text-zinc-300 tracking-wide">
              {data.last_changed || "Inert"}
            </span>
          </div>
          <div className="bg-zinc-950/40 p-8">
            <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest opacity-30 block mb-3">
              Density
            </span>
            <span className="font-bold text-zinc-300 tracking-wide">
              {data.total_norms} Sections
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
          {data.norms && data.norms.length > 0 ? (
            data.norms.map((norm, idx) => (
              <NormViewer
                key={idx}
                normId={norm.norm_id}
                lawKey={data.key}
                title={norm.norm_title}
                content={norm.content}
              />
            ))
          ) : (
            <div className="text-center py-20 glass-panel border-white/5">
              <p className="text-muted font-serif italic text-lg opacity-40">
                {t("laws.norms_empty")}
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-40 pt-12 border-t border-white/5 flex justify-center opacity-20">
        <Scale className="w-10 h-10 text-accent-gold" />
      </footer>
    </div>
  );
}
