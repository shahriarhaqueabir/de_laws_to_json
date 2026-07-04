"use client";

import { ErrorPageShell } from "@/components/error-page-shell";

export default function AuthError({
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
      title="Authentication Error"
      message="An authentication error occurred. Your session may have expired. Please try signing in again."
      logContext="Auth error boundary"
    />
  );
}
