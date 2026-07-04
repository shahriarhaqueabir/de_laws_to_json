"use client";

import SearchBar from "../components/search-bar";
import CategoryGrid from "../components/category-grid";
import { FileText, Brain, Cloud, Plug, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "../hooks/useLanguage";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "German Law Vault",
      alternateName: "AI-Assisted German Law",
      url: SITE_URL,
      description:
        "Free AI-powered search engine and legal assistant for all 6,000+ German federal laws.",
      inLanguage: ["de", "en", "tr", "ar", "fr", "es", "pl", "uk", "ru"],
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: "German Law Vault",
      alternateName: "AI-Assisted German Law",
      description:
        "Free AI-powered search engine and legal assistant for all 6,000+ German federal laws. Search in 9 languages, get structured legal guidance, and generate German legal documents.",
      url: SITE_URL,
      applicationCategory: "LegalApplication",
      operatingSystem: "All",
      browserRequirements: "Requires JavaScript",
      inLanguage: ["de", "en", "tr", "ar", "fr", "es", "pl", "uk", "ru"],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
      featureList: [
        "Semantic search across 6,000+ German federal laws",
        "AI-powered legal guidance with outcome paths",
        "In-browser AI (fully private, no server calls)",
        "Bookmark and case folder management",
        "German legal document generation",
        "Multilingual support (9 languages)",
      ],
      author: {
        "@type": "Person",
        name: "Shahriar Haque Abir",
        url: "https://github.com/shahriarhaqueabir",
      },
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      isAccessibleForFree: true,
      maintainer: {
        "@type": "Person",
        name: "Shahriar Haque Abir",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "German Law Vault",
      url: SITE_URL,
      logo: `${SITE_URL}/opengraph-image`,
      founder: {
        "@type": "Person",
        name: "Shahriar Haque Abir",
      },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
      ],
    },
  ],
};

const LAW_QUOTES = [
  { text: "The law is reason, free from passion.", author: "Aristotle" },
  {
    text: "Justice delayed is justice denied.",
    author: "William E. Gladstone",
  },
  { text: "Law is the art of the good and the equitable.", author: "Celsus" },
  { text: "The more laws, the less justice.", author: "Marcus Tullius Cicero" },
  {
    text: "Lawyers are the only persons in whom ignorance of the law is not punished.",
    author: "Jeremy Bentham",
  },
];

interface Mode {
  icon: typeof FileText;
  labelKey: string;
  descKey: string;
  href: string;
}

const modes: Mode[] = [
  {
    icon: FileText,
    labelKey: "home.mode_basic",
    descKey: "home.mode_basic_desc",
    href: "/search",
  },
  {
    icon: Brain,
    labelKey: "home.mode_browser",
    descKey: "home.mode_browser_desc",
    href: "/chat",
  },
  {
    icon: Cloud,
    labelKey: "home.mode_cloud",
    descKey: "home.mode_cloud_desc",
    href: "/settings",
  },
  {
    icon: Plug,
    labelKey: "home.mode_local",
    descKey: "home.mode_local_desc",
    href: "/settings",
  },
];

export default function Home() {
  const { t } = useLanguage();
  const quote = LAW_QUOTES[new Date().getDay() % LAW_QUOTES.length];

  return (
    <main className="min-h-screen bg-transparent relative overflow-hidden">
      {/* JSON-LD structured data for Google rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ── Background Elements ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Gold radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[800px] opacity-30">
          <div className="absolute inset-0 bg-radial-[at_50%_0%] from-accent-gold/20 via-transparent to-transparent blur-[120px]" />
        </div>
        {/* Electric blue spotlight — right side */}
        <div className="absolute top-[10%] right-0 w-[600px] h-[600px] opacity-15">
          <div className="absolute inset-0 bg-radial-[at_100%_20%] from-accent-electric/30 via-transparent to-transparent blur-[100px]" />
        </div>
        {/* Neon purple spotlight — left side */}
        <div className="absolute top-[40%] left-0 w-[500px] h-[500px] opacity-10">
          <div className="absolute inset-0 bg-radial-[at_0%_50%] from-accent-neon/30 via-transparent to-transparent blur-[100px]" />
        </div>
        {/* Gunmetal noise overlay */}
        <div className="absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay" />
        {/* Lady Justice silhouette watermark */}
        <div className="absolute right-0 bottom-0 w-[400px] h-[500px] opacity-[0.03] pointer-events-none select-none">
          <svg
            viewBox="0 0 200 300"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="w-full h-full text-white"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Head */}
            <circle cx="100" cy="28" r="13" strokeWidth="3" />
            {/* Robe silhouette */}
            <path
              d="M87 41 C84 90 60 160 40 260 L160 260 C140 160 116 90 113 41"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Left arm holding scales */}
            <path
              d="M87 70 C65 80 40 90 25 100"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Scales beam */}
            <line
              x1="8"
              y1="100"
              x2="42"
              y2="100"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Left scale pan */}
            <path
              d="M2 100 L10 120 L18 100"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Right scale pan */}
            <path
              d="M32 100 L40 120 L48 100"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Right arm holding sword */}
            <path
              d="M113 70 C135 85 158 100 170 115"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Sword blade */}
            <line
              x1="170"
              y1="115"
              x2="174"
              y2="195"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Sword guard */}
            <line
              x1="163"
              y1="125"
              x2="181"
              y2="125"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Sword pommel */}
            <circle cx="170" cy="110" r="4" strokeWidth="2" />
            {/* Ground line */}
            <line x1="40" y1="260" x2="160" y2="260" strokeWidth="2" />
          </svg>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-24 lg:py-40 relative z-10">
        <header className="text-center mb-24 relative">
          {/* Brushed metal overlay on hero */}
          <div className="absolute inset-0 bg-brushed-metal opacity-[0.15] pointer-events-none" />
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6 animate-fade-in">
            &ldquo;{quote.text}&rdquo; - {quote.author}
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6 animate-fade-in">
            {t("home.tagline")}
          </p>
          <h1 className="font-serif font-bold text-7xl md:text-8xl mb-8 tracking-tighter leading-[0.9] animate-shimmer-gold inline-block">
            {t("home.title")}
          </h1>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-accent-gold/50 via-accent-electric/30 to-transparent mx-auto mb-10" />
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto legal-text italic font-serif">
            {t("home.subtitle")}
          </p>
        </header>

        <div className="mb-32">
          <SearchBar />
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {modes.map((mode, idx) => {
              const Icon = mode.icon;
              /* Alternate accent colors across mode cards */
              const accentColors = [
                {
                  icon: "text-accent-gold",
                  hover: "group-hover:text-accent-gold-bright",
                },
                {
                  icon: "text-accent-electric",
                  hover: "group-hover:text-accent-electric",
                },
                {
                  icon: "text-accent-neon",
                  hover: "group-hover:text-accent-neon",
                },
                {
                  icon: "text-accent-gold",
                  hover: "group-hover:text-accent-gold-bright",
                },
              ];
              const accent = accentColors[idx % 4];
              return (
                <Link
                  key={mode.labelKey}
                  href={mode.href}
                  className="premium-card p-8 flex flex-col justify-between group h-full relative overflow-hidden"
                >
                  {/* Colored top edge strip per card */}
                  <div
                    className={`absolute top-0 left-0 w-full h-[1px] opacity-0 group-hover:opacity-60 transition-opacity duration-500 bg-gradient-to-r from-transparent via-${accent.icon.replace(/^text-/, "")}/60 to-transparent`}
                  />
                  <div>
                    <div className="mb-6 group-hover:scale-110 transition-transform duration-500 origin-left">
                      <Icon
                        className={`w-8 h-8 opacity-60 group-hover:opacity-100 ${accent.icon} ${accent.hover} transition-all duration-500`}
                      />
                    </div>
                    <h3 className="font-serif font-bold text-xl text-white mb-3 flex items-center gap-2 group-hover:text-metallic-gold transition-all duration-500">
                      {t(mode.labelKey)}
                    </h3>
                    <p className="text-[13px] text-zinc-500 leading-relaxed font-medium">
                      {t(mode.descKey)}
                    </p>
                  </div>
                  <div className="mt-8">
                    <span
                      className={`text-xs font-bold uppercase tracking-widest text-zinc-600 ${accent.icon} transition-colors flex items-center gap-2`}
                    >
                      {t("home.get_started")} <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-40">
          <div className="flex items-center gap-4 mb-12">
            <h2 className="text-2xl font-serif font-bold text-white tracking-tight shrink-0">
              {t("home.categories")}
            </h2>
            <div className="h-px w-full bg-zinc-800" />
          </div>
          <div className="glass-panel p-10 border-white/5 relative overflow-hidden edge-glow-electric">
            <div className="absolute inset-0 bg-coin-pattern opacity-[0.12] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
            <CategoryGrid />
          </div>
        </div>

        <div className="pb-20" />
      </div>
    </main>
  );
}
