import { Scale } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 border border-white/10 bg-white/5 flex items-center justify-center animate-pulse">
            <Scale className="w-8 h-8 text-accent-gold" />
          </div>
        </div>

        <h1 className="font-serif text-3xl font-bold text-white">
          Loading
        </h1>

        <div className="flex justify-center gap-1.5">
          <span className="w-2 h-2 bg-accent-gold/60 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-accent-gold/60 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-accent-gold/60 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
