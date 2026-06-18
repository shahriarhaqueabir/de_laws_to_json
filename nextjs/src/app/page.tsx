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
    <main className="min-h-screen bg-transparent">
      <div className="max-w-6xl mx-auto px-4 py-20 lg:py-32">
        <header className="text-center mb-20 relative">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-accent-cobalt/5 blur-[100px] rounded-full" />
          <h1 className="font-serif font-extrabold text-white text-6xl md:text-7xl mb-6 tracking-tight">
            German Law Vault
          </h1>
          <p className="text-xl text-[#a3a3a3] max-w-2xl mx-auto legal-text italic">
            Search 6,000+ German federal laws with sub-second semantic retrieval.
            Powered by high-authority AI and private on-device intelligence.
          </p>
        </header>

        <div className="mb-24">
          <SearchBar />
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modes.map((mode) => {
              const Icon = mode.icon;
              return (
                <Link
                  key={mode.label}
                  href={mode.href}
                  className="premium-card p-6 flex flex-col justify-between group"
                >
                  <div>
                    <div className="p-3 bg-white/5 w-fit mb-4 group-hover:bg-accent-cobalt/10 transition-colors">
                      <Icon className="w-6 h-6 text-accent-cobalt" />
                    </div>
                    <h3 className="font-serif font-bold text-lg text-white mb-2 flex items-center gap-2">
                      {mode.label}
                      <ArrowRight className="w-4 h-4 text-accent-cobalt opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-[#a3a3a3] leading-relaxed">
                      {mode.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-32">
          <h2 className="text-3xl font-serif font-bold text-white mb-10 text-center tracking-tight">
            Jurisdiction Domains
          </h2>
          <div className="glass-panel p-8">
            <CategoryGrid />
          </div>
        </div>

        <footer className="mt-40 py-10 border-t border-white/5 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#6b6b6b]">
          <p>© 2026 German Law Vault // Professional Legal Intelligence Repository</p>
        </footer>
      </div>
    </main>
  );
}
