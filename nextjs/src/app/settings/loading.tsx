export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20" aria-hidden="true">
      <div className="h-8 w-48 skeleton mb-12" />
      {/* API Key section */}
      <div className="glass-panel p-8 space-y-4 mb-6">
        <div className="h-5 w-32 skeleton" />
        <div className="h-3 w-64 skeleton" />
        <div className="h-10 w-full skeleton rounded-lg mt-4" />
      </div>
      {/* Language section */}
      <div className="glass-panel p-8 space-y-4 mb-6">
        <div className="h-5 w-40 skeleton" />
        <div className="h-3 w-56 skeleton" />
        <div className="h-10 w-48 skeleton rounded-lg mt-4" />
      </div>
      {/* Danger zone */}
      <div className="glass-panel p-8 space-y-4">
        <div className="h-5 w-28 skeleton" />
        <div className="h-3 w-72 skeleton" />
        <div className="h-10 w-36 skeleton rounded-lg mt-4" />
      </div>
    </div>
  );
}
