import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

// Static routes with their SEO priority/frequency
const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1.0,
  },
  {
    url: `${SITE_URL}/search`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/chat`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/guidance`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.8,
  },
];

export const revalidate = 86400; // Regenerate sitemap once per day

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetch all law keys from Supabase to generate law detail page URLs.
  // These are the highest-value pages for search engine indexing
  // (6,000+ individual German federal law pages).
  let lawRoutes: MetadataRoute.Sitemap = [];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch all law keys and their last-modified dates in batches
      // The laws table has a public RLS policy so the anon key is sufficient
      const { data, error } = await supabase
        .from("laws")
        .select("key, updated_at")
        .order("key", { ascending: true });

      if (!error && data) {
        lawRoutes = data.map((law) => ({
          url: `${SITE_URL}/laws/${encodeURIComponent(law.key)}`,
          lastModified: law.updated_at ? new Date(law.updated_at) : new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        }));
      }
    }
  } catch {
    // If Supabase is unavailable (e.g., during CI build), skip law routes.
    // The static routes will still be served.
    console.warn("[sitemap] Could not fetch law keys from Supabase.");
  }

  return [...staticRoutes, ...lawRoutes];
}
