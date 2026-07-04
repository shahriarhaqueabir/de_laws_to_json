import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Playfair_Display } from "next/font/google";

const serif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif-playfair",
  display: "swap",
});
import "./globals.css";
import NavBar from "../components/nav-bar";
import { Diagnostics } from "../components/diagnostic";
import Footer from "../components/footer";
import { AuthProvider } from "../components/auth-context";
import { LangProvider } from "../components/lang-provider";
import { ChatProvider } from "../components/chat-context";
import { Providers } from "../components/providers";
import { OnboardingProvider } from "../components/onboarding-context";
import { OnboardingBanner } from "../components/onboarding-banner";
import { OnboardingWizard } from "../components/onboarding-wizard";

const SITE_URL = "https://ai-assisted-german-law.vercel.app";

const SUPPORTED_LANGUAGES = [
  "de",
  "en",
  "tr",
  "ar",
  "fr",
  "es",
  "pl",
  "uk",
  "ru",
];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "German Law Vault — Search 6,000+ German Federal Laws with AI",
    template: "%s | German Law Vault",
  },
  description:
    "German Law Vault is a free, AI-powered search engine and legal assistant for all 6,000+ German federal laws (Bundesrecht). Search in 9 languages, get structured AI legal guidance, and generate German legal documents — entirely in your browser or with your own API key.",
  keywords: [
    "German law",
    "Deutsches Recht",
    "Bundesrecht",
    "German federal statutes",
    "legal AI",
    "AI legal assistant",
    "German legal search",
    "Gesetze",
    "German law database",
    "semantic law search",
    "Rechtsinformation",
    "gesetze-im-internet",
    "AI-powered legal guidance",
    "open legal data Germany",
  ],
  authors: [{ name: "Shahriar Haque Abir", url: SITE_URL }],
  creator: "Shahriar Haque Abir",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "x-default": SITE_URL,
      ...Object.fromEntries(
        SUPPORTED_LANGUAGES.map((lang) => [lang, `${SITE_URL}/${lang}`]),
      ),
    },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: [
      "en_US",
      ...SUPPORTED_LANGUAGES.filter((l) => l !== "de"),
    ],
    url: SITE_URL,
    siteName: "German Law Vault",
    title: "German Law Vault — Search 6,000+ German Federal Laws with AI",
    description:
      "Free AI-powered search and legal guidance for all German federal laws. Search in 9 languages, bookmark cases, and generate legal documents — privately and for free.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "German Law Vault — AI-powered German federal law search",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "German Law Vault — Search 6,000+ German Federal Laws with AI",
    description:
      "Free AI-powered search and legal guidance for all German federal laws. Search in 9 languages, run private AI analysis, and generate German legal documents.",
    images: ["/opengraph-image"],
    creator: "@shahriarhaqueabir",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${serif.variable}`}>
      <head>
        {/* Preconnect to external origins for performance */}
        <link
          rel="preconnect"
          href="https://zuhhimmdlnsjuwksitpb.supabase.co"
        />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://huggingface.co" />
        <link
          rel="dns-prefetch"
          href="https://zuhhimmdlnsjuwksitpb.supabase.co"
        />
        <link
          rel="dns-prefetch"
          href="https://9a759160-fc62-48ea-aa24-0a51ec1cde9a.eu-west-1-0.aws.cloud.qdrant.io"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-zinc-400">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent-gold focus:text-black focus:outline-none focus:text-xs focus:font-bold focus:uppercase focus:tracking-widest"
        >
          Skip to content
        </a>
        <LangProvider>
          <Providers>
            <AuthProvider>
              <ChatProvider>
                <OnboardingProvider>
                  <OnboardingBanner />
                  <OnboardingWizard />
                  <Diagnostics />
                  <NavBar />
                  <div id="main-content" className="flex-1">
                    {children}
                  </div>
                  <Footer />
                </OnboardingProvider>
              </ChatProvider>
            </AuthProvider>
          </Providers>
        </LangProvider>
      </body>
    </html>
  );
}
