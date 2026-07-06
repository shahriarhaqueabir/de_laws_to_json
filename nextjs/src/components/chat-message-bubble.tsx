import type { CitedLaw } from "../lib/types";
import Link from "next/link";
import { Scale } from "lucide-react";

interface ChatMessageBubbleProps {
  role: "user" | "assistant" | string;
  content: string;
  citedLaws?: CitedLaw[];
  index: number;
}

export function ChatMessageBubble({
  role,
  content,
  citedLaws,
  index,
}: ChatMessageBubbleProps) {
  return (
    <div
      className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] relative group ${
          role === "user"
            ? "px-6 py-4 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold-bright"
            : "px-8 py-8 glass-panel text-zinc-300"
        }`}
      >
        {role === "assistant" && (
          <>
            <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-accent-gold/30" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-accent-gold/30" />
            <div className="monumental-type opacity-20 mb-6 text-xs">
              Response #{String(index).padStart(2, "0")}
            </div>
          </>
        )}

        <div
          className={`legal-text text-inherit whitespace-pre-wrap ${role === "assistant" ? "font-serif" : "font-sans font-semibold italic"}`}
        >
          {content}
        </div>

        {citedLaws && citedLaws.length > 0 && (
          <div className="mt-10 pt-8 border-t border-white/5">
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-zinc-600 mb-6 flex items-center gap-3">
              <Scale className="w-3 h-3" /> Referenced Statutes
            </p>
            <div className="flex flex-wrap gap-2">
              {citedLaws.map((law, j) => (
                <Link
                  key={j}
                  href={`/laws/${encodeURIComponent(law.law_key)}`}
                  className="text-xs font-bold px-3 py-2 bg-white/5 border border-white/5 text-zinc-500 hover:bg-accent-gold/10 hover:text-accent-gold-bright hover:border-accent-gold/30 transition-all duration-500"
                >
                  {law.law_key} {law.norm_id}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
