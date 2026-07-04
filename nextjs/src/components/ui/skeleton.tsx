/**
 * Skeleton loading primitives.
 * Use these to build content-shaped loading states that feel faster
 * than a generic spinner. Uses the CSS `skeleton` class for the
 * metallic shimmer animation defined in globals.css.
 */

export function SkeletonCard() {
  return (
    <div className="glass-panel p-8 space-y-4" aria-hidden="true">
      {/* Title */}
      <div className="h-6 w-3/4 skeleton" />
      {/* Subtitle */}
      <div className="h-4 w-1/2 skeleton" />
      {/* Content lines */}
      <div className="space-y-2 pt-4">
        <div className="h-3 w-full skeleton" />
        <div className="h-3 w-11/12 skeleton" />
        <div className="h-3 w-4/5 skeleton" />
      </div>
      {/* Footer */}
      <div className="flex gap-4 pt-2">
        <div className="h-3 w-16 skeleton" />
        <div className="h-3 w-20 skeleton" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

export function SkeletonLawDetail() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20" aria-hidden="true">
      {/* Back button */}
      <div className="h-4 w-24 skeleton mb-12" />
      {/* Law header */}
      <div className="h-10 w-2/3 skeleton mb-4" />
      <div className="h-5 w-1/3 skeleton mb-12" />
      {/* Section header */}
      <div className="h-6 w-48 skeleton mb-8" />
      {/* Norm list */}
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-panel p-6 space-y-3">
            <div className="h-5 w-24 skeleton" />
            <div className="h-4 w-3/4 skeleton" />
            <div className="h-3 w-full skeleton" />
            <div className="h-3 w-11/12 skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}
