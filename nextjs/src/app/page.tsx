import SearchBar from "../components/search-bar";
import CategoryGrid from "../components/category-grid";
import { FileText, Brain, Cloud, Plug, ArrowRight } from "lucide-react";
import Link from "next/link";

const modes = [
  {
    icon: FileText,
    label: "Basic Search",
    description:
      "Search 6,000+ laws and read excerpts directly. No AI — you interpret the results.",
    href: "/search",
  },
  {
    icon: Brain,
    label: "Browser AI",
    description:
      "AI runs entirely in your browser via Qwen. Fully private, no server calls. ~1GB download.",
    href: "/chat",
  },
  {
    icon: Cloud,
    label: "Cloud AI",
    description:
      "Bring your own OpenAI/Anthropic key. Best quality, fastest response. You control billing.",
    href: "/settings",
  },
  {
    icon: Plug,
    label: "Local AI",
    description:
      "Connect to Ollama on your machine via the local broker. Fully offline, no data leaves your network.",
    href: "/settings",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <header className="text-center mb-14">
          <h1 className="font-serif font-extrabold text-[#e8e8e8] text-5xl mb-4">
            German Law Vault
          </h1>
          <p className="text-xl text-[#a3a3a3] max-w-2xl mx-auto">
            Explore 6,000+ German federal laws. Search in English or German,
            powered by AI semantic search.
          </p>
        </header>

        <SearchBar />

        <div className="mt-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modes.map((mode) => {
              const Icon = mode.icon;
              return (
                <Link
                  key={mode.label}
                  href={mode.href}
                  className="bg-[#141414] border border-[#2a2a2a] p-5 transition-shadow group shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.06)] hover:border-[#888888]"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-[#1a1a1a]">
                      <Icon className="w-5 h-5 text-[#888888]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#e8e8e8]">
                          {mode.label}
                        </h3>
                        <ArrowRight className="w-4 h-4 text-[#888888] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm text-[#a3a3a3] leading-relaxed">
                        {mode.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-bold text-[#e8e8e8] mb-6 text-center">
            Browse by Category
          </h2>
          <CategoryGrid />
        </div>

        <footer className="mt-24 text-center text-[#6b6b6b] text-sm">
          <p>© 2026 German Law Vault. AI-Assisted non-binding guidance.</p>
        </footer>
      </div>
    </main>
  );
}
