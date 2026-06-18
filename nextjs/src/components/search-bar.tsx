'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const [query, setQuery] = useState(initialValue);
  const router = useRouter();

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router]);

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search German laws... (e.g., Mietrecht, BGB, consumer rights)"
          className="w-full px-4 py-3 pr-12 text-lg border rounded-none
                               focus:outline-none focus:ring-1 focus:ring-[#777777]
                               bg-[#0e0e0e] border-[#1a1a1a] text-[#cccccc]"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2
                               text-[#555555] hover:text-[#999999] transition-all duration-100 active:translate-y-[1px]"
        >
          <Search className="w-6 h-6" />
        </button>
      </div>
    </form>
  );
}
