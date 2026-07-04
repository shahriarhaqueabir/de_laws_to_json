import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search 6,000+ German Federal Laws | German Law Vault",
  description:
    "Search across 6,000+ German federal laws and statutes (Bundesrecht) using hybrid semantic search. Filter by legal category, search in German, English, Turkish, Arabic, French, Spanish, Polish, Ukrainian, or Russian.",
  alternates: {
    canonical: "/search",
  },
  openGraph: {
    title: "Search 6,000+ German Federal Laws | German Law Vault",
    description:
      "Semantic full-text search across all German federal laws. Multilingual, fast, and free.",
    url: "/search",
  },
};

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": ["CollectionPage", "SearchResultsPage"],
            "@id": `${SITE_URL}/search#webpage`,
            name: "Search 6,000+ German Federal Laws | German Law Vault",
            description:
              "Search across 6,000+ German federal laws and statutes using hybrid semantic search. Find Bundesrecht by keyword, category, or AI-powered similarity.",
            url: `${SITE_URL}/search`,
            isPartOf: {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
            },
            breadcrumb: {
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
                  name: "Search",
                },
              ],
            },
          }),
        }}
      />
      {children}
    </>
  );
}
