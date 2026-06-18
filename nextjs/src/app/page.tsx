import SearchBar from '../components/search-bar';
import CategoryGrid from '../components/category-grid';
import { FileText, Brain, Cloud, Plug, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const modes = [
  {
    icon: FileText,
    label: 'Basic Search',
    color: 'text-gray-600',
    bg: 'bg-gray-100 dark:bg-gray-800',
    description: 'Search 6,000+ laws and read excerpts directly. No AI — you interpret the results.',
    href: '/search',
  },
  {
    icon: Brain,
    label: 'Browser AI',
    color: 'text-emerald-600',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'AI runs entirely in your browser via Qwen. Fully private, no server calls. ~1GB download.',
    href: '/chat',
  },
  {
    icon: Cloud,
    label: 'Cloud AI',
    color: 'text-purple-600',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Bring your own OpenAI/Anthropic key. Best quality, fastest response. You control billing.',
    href: '/settings',
  },
  {
    icon: Plug,
    label: 'Local AI',
    color: 'text-blue-600',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    description: 'Connect to Ollama on your machine via the local broker. Fully offline, no data leaves your network.',
    href: '/settings',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070707]">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <header className="text-center mb-14">
              <h1 className="text-5xl font-extrabold tracking-tight text-[#cccccc] mb-4">
                German Law Vault
              </h1>
              <p className="text-xl text-[#888888] max-w-2xl mx-auto">
            Explore 6,000+ German federal laws. Search in English or German, powered by AI semantic search.
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
                  className={`${mode.bg} border border-[#1a1a1a] rounded-none p-5 hover:border-[#777777] transition-all group`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-none ${mode.bg}`}>
                                          <Icon className={`w-5 h-5 ${mode.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#cccccc]">{mode.label}</h3>
                        <ArrowRight className={`w-4 h-4 ${mode.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                      </div>
                      <p className="text-sm text-[#888888] leading-relaxed">
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
          <h2 className="text-2xl font-bold text-[#cccccc] mb-6 text-center">
            Browse by Category
          </h2>
          <CategoryGrid />
        </div>

        <footer className="mt-24 text-center text-[#555555] text-sm">
          <p>© 2026 German Law Vault. AI-Assisted non-binding guidance.</p>
        </footer>
      </div>
    </main>
  );
}
