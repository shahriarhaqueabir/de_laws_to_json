"use client";

import { ErrorPageShell } from "@/components/error-page-shell";

export default function LawDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPageShell
      error={error}
      reset={reset}
      title="Law Detail Error"
      message="Failed to load law details. The Qdrant vector search or database may be temporarily unavailable."
      logContext="Law detail error boundary"
    />
  );
}
