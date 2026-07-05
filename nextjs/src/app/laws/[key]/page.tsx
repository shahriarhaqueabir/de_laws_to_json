import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scale, Search } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getLawDetail } from "../../../lib/law-detail";
import { LawContent } from "./law-content";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const { key } = await params;
  const trimmedKey = key.trim();

  // Lightweight fetch — just the law title, no norms needed for metadata
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const cookieStore = await cookies();
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => { },
        },
      });

      const { data } = await supabase
        .from("laws")
        .select("title, category, status")
        .eq("key", trimmedKey)
        .single();

      if (data?.title) {
        const title = `${String(data.title)} — German Law Vault`;
        const description = `Read the full text of ${String(data.title)} (${String(data.category || "German federal law")}). Status: ${String(data.status || "current")}. Free AI-powered search and analysis.`;
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            url: `${SITE_URL}/laws/${encodeURIComponent(trimmedKey)}`,
            type: "article",
          },
          alternates: {
            canonical: `${SITE_URL}/laws/${encodeURIComponent(trimmedKey)}`,
          },
        };
      }
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: `Law ${trimmedKey} — German Law Vault`,
    description: `German federal statute ${trimmedKey}. Read the full text with AI-powered search and analysis.`,
  };
}

function LawNotFound({ key }: { key: string }) {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:text-accent-gold mb-16 transition-colors duration-500"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-10">
          <div className="flex justify-center">
            <div className="w-20 h-20 border border-white/10 bg-white/5 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-diagonal-wire opacity-[0.06] pointer-events-none" />
              <Search className="w-10 h-10 text-accent-gold/40" />
            </div>
          </div>
          <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
            &ldquo;{key}&rdquo; Not Found
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed font-serif italic">
            This statute reference hasn&apos;t been imported yet, or the key
            doesn&apos;t match any law in our database. Try searching for it
            instead.
          </p>
          <Link
            href={`/search?q=${encodeURIComponent(key)}`}
            className="inline-flex items-center gap-3 px-8 py-4 border border-accent-gold/30 bg-accent-gold/10 text-accent-gold-bright text-xs font-black uppercase tracking-[0.3em] hover:bg-accent-gold/20 transition-all duration-300 active:scale-95"
          >
            <Search className="w-4 h-4" />
            Search for {key}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default async function LawDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const trimmedKey = key.trim();

  const data = await getLawDetail(trimmedKey);

  if (!data) {
    return <LawNotFound key={trimmedKey} />;
  }

  return <LawContent law={data} />;
}
