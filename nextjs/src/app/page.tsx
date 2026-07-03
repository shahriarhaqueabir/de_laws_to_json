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
      "AI runs entirely in your browser via Qwen3. Fully private, no server calls. ~1GB download.",
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

export default function Home() {
  const quote = LAW_QUOTES[new Date().getDay() % LAW_QUOTES.length];

  return (
    <main className="min-h-screen bg-transparent relative overflow-hidden">
      {/* ── Background Elements ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[800px] pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-radial-[at_50%_0%] from-accent-gold/20 via-transparent to-transparent blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-24 lg:py-40 relative z-10">
        <header className="text-center mb-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6 animate-fade-in">
            &ldquo;{quote.text}&rdquo; &mdash; {quote.author}
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6 animate-fade-in">
            Bundesrepublik Deutschland
          </p>
          <h1 className="font-serif font-bold text-white text-7xl md:text-8xl mb-8 tracking-tighter leading-[0.9]">
            The Law Vault
          </h1>
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-accent-gold/50 to-transparent mx-auto mb-10" />
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto legal-text italic font-serif">
            A comprehensive repository of over 6,000 German federal statutes.
          </p>
        </header>

        <div className="mb-32">
          <SearchBar />
        </div>

        <div className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {modes.map((mode) => {
              const Icon = mode.icon;
              return (
                <Link
                  key={mode.label}
                  href={mode.href}
                  className="premium-card p-8 flex flex-col justify-between group h-full"
                >
                  <div>
                    <div className="mb-6 group-hover:scale-110 transition-transform duration-500 origin-left">
                      <Icon className="w-8 h-8 text-accent-gold opacity-60 group-hover:opacity-100 group-hover:text-accent-gold-bright transition-opacity duration-500" />
                    </div>
                    <h3 className="font-serif font-bold text-xl text-white mb-3 flex items-center gap-2">
                      {mode.label}
                    </h3>
                    <p className="text-[13px] text-zinc-500 leading-relaxed font-medium">
                      {mode.description}
                    </p>
                  </div>
                  <div className="mt-8">
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 group-hover:text-accent-gold transition-colors flex items-center gap-2">
                      Get Started <ArrowRight className="w-3 h-3" />
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
              Categories
            </h2>
            <div className="h-px w-full bg-zinc-800" />
          </div>
          <div className="glass-panel p-10 border-white/5">
            <CategoryGrid />
          </div>
        </div>

        <div className="pb-20" />
      </div>
    </main>
  );
}
