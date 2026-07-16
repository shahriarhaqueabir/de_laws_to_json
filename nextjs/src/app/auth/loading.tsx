export default function AuthLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6" aria-hidden="true">
      <div className="w-full max-w-sm glass-panel p-8 space-y-6">
        <div className="h-8 w-32 skeleton mx-auto" />
        <div className="h-12 w-full skeleton rounded-lg" />
        <div className="h-12 w-full skeleton rounded-lg" />
        <div className="h-10 w-full skeleton rounded-lg" />
      </div>
    </div>
  );
}
