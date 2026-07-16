export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto px-6 py-8" aria-hidden="true">
      {/* Messages area */}
      <div className="flex-1 space-y-6 mb-8 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div className={`${i % 2 === 0 ? "w-3/5" : "w-2/5"} space-y-2`}>
              <div className="h-4 w-24 skeleton" />
              <div className="glass-panel p-4 space-y-2">
                <div className="h-3 w-full skeleton" />
                <div className="h-3 w-11/12 skeleton" />
                {i % 2 === 0 && <div className="h-3 w-4/5 skeleton" />}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Input area */}
      <div className="glass-panel p-4">
        <div className="h-12 w-full skeleton rounded-lg" />
      </div>
    </div>
  );
}
