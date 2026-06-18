"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function SearchBar({
  initialValue = "",
}: {
  initialValue?: string;
}) {
  const [query, setQuery] = useState(initialValue);
  const router = useRouter();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, router],
  );

  return (
    <form onSubmit={handleSearch} className="w-full max-w-3xl mx-auto group">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search German laws... (e.g., Mietrecht, BGB § 823)"
          className="w-full px-6 py-4 pr-14 text-xl glass-panel-heavy border-white/5
                               focus:outline-none focus:border-accent-cobalt focus:ring-4 focus:ring-accent-cobalt-glow
                               text-white placeholder:text-[#6b6b6b] transition-all duration-300"
        />
        <button
          type="submit"
          aria-label="Search"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5
                               text-[#888888] hover:text-white transition-all duration-300 active:scale-95"
        >
          <Search className="w-7 h-7" />
        </button>
      </div>
    </form>
  );
}
