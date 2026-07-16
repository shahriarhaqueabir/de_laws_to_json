import { SkeletonList } from "@/components/ui/skeleton";

export default function BookmarksLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20">
      <div className="h-8 w-48 skeleton mb-8" />
      <SkeletonList count={4} />
    </div>
  );
}
