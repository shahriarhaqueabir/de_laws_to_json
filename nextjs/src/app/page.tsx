import SearchBar from '@/components/search-bar';
import CategoryGrid from '@/components/category-grid';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-20">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            German Law Vault
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Explore 6,000+ German federal laws. Search in English or German, powered by AI semantic search.
          </p>
        </header>

        <SearchBar />

        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Browse by Category
          </h2>
          <CategoryGrid />
        </div>

        <footer className="mt-24 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>© 2026 German Law Vault Overhaul. AI-Assisted non-binding guidance.</p>
        </footer>
      </div>
    </main>
  );
}
