import { notFound } from "next/navigation";
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
        .eq("key", key)
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
            url: `${SITE_URL}/laws/${encodeURIComponent(key)}`,
            type: "article",
          },
          alternates: {
            canonical: `${SITE_URL}/laws/${encodeURIComponent(key)}`,
          },
        };
      }
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: `Law ${key} — German Law Vault`,
    description: `German federal statute ${key}. Read the full text with AI-powered search and analysis.`,
  };
}

export default async function LawDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  const data = await getLawDetail(key);

  if (!data) {
    notFound();
  }

  return <LawContent law={data} />;
}
