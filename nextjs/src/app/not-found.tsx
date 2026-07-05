import Link from "next/link";
import { Scale, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 border border-white/10 bg-white/5 flex items-center justify-center">
            <Scale className="w-8 h-8 text-accent-gold" />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-bold text-white">
          Page Not Found
        </h1>

        <p className="text-zinc-400 text-sm leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist. It may have been
          moved, or the URL may be incorrect.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/"
            className="flex items-center gap-3 px-6 py-3 border border-white/10 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white/5 hover:border-accent-gold/50 transition-colors duration-300 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
