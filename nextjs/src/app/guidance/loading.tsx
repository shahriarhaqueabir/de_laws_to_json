export default function GuidanceLoading() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-20" aria-hidden="true">
      <div className="h-8 w-64 skeleton mb-2" />
      <div className="h-4 w-96 skeleton mb-12" />
      {/* Form area */}
      <div className="glass-panel p-8 space-y-6 mb-12">
        <div className="h-4 w-32 skeleton" />
        <div className="h-32 w-full skeleton rounded-lg" />
        <div className="flex gap-4">
          <div className="h-10 w-32 skeleton rounded-lg" />
          <div className="h-10 w-40 skeleton rounded-lg" />
        </div>
      </div>
      {/* Paths area */}
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-panel p-6 space-y-3">
            <div className="h-5 w-48 skeleton" />
            <div className="h-3 w-full skeleton" />
            <div className="h-3 w-4/5 skeleton" />
            <div className="flex gap-2 pt-2">
              <div className="h-6 w-20 skeleton rounded-full" />
              <div className="h-6 w-24 skeleton rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
