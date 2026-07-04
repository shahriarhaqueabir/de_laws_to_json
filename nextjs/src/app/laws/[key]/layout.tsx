import type { Metadata } from "next";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

type Props = {
  params: Promise<{ key: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;

  // Try to fetch the law title from the API for rich metadata.
  // Falls back gracefully if the request fails (e.g., during static build).
  let lawTitle: string | null = null;
  let lawDescription: string | null = null;

  try {
    const res = await fetch(`${SITE_URL}/api/laws/${encodeURIComponent(key)}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.title) {
        lawTitle = data.title;
      }
      if (data?.norms?.length) {
        // Use text from the first norm as the description snippet
        const firstNorm = data.norms[0];
        const rawText: string =
          firstNorm?.text || firstNorm?.content || firstNorm?.title || "";
        lawDescription = rawText.slice(0, 155).trim() || null;
      }
    }
  } catch {
    // No-op — static fallback used below
  }

  const title = lawTitle
    ? `${lawTitle} (${key.toUpperCase()})`
    : `German Law ${key.toUpperCase()}`;
  const description = lawDescription
    ? `${lawDescription}…`
    : `Read the full text of the German federal law ${key.toUpperCase()} (Bundesrecht). Browse all sections and paragraphs on German Law Vault.`;
  const canonicalUrl = `${SITE_URL}/laws/${key}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} | German Law Vault`,
      description,
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${title} | German Law Vault`,
      description,
    },
  };
}

export default async function LawDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  // Render breadcrumb JSON-LD with the law key.
  // The actual title may be rendered client-side, but the key itself
  // gives enough structure for Google Breadcrumb rich results.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: SITE_URL,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: `German Law ${key.toUpperCase()}`,
                item: `${SITE_URL}/laws/${key}`,
              },
            ],
          }),
        }}
      />
      {children}
    </>
  );
}
