import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Legal Guidance — Case Analysis & Outcome Paths | German Law Vault",
  description:
    "Describe your legal situation in plain language and receive AI-generated structured outcome paths with risk assessment, cost estimates (RVG/GKG fee calculation), step-by-step action plans, and estimated timelines — based on German federal law.",
  alternates: {
    canonical: "/guidance",
  },
  openGraph: {
    title:
      "AI Legal Guidance — Case Analysis & Outcome Paths | German Law Vault",
    description:
      "Get structured AI legal guidance for German law situations. Outcome paths with risk levels, cost estimates, and step-by-step recommended actions — in any of 9 languages.",
    url: "/guidance",
  },
};

export default function GuidanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
