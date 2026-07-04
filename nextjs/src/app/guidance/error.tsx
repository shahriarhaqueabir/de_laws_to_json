"use client";

import { FileText } from "lucide-react";
import { ErrorPageShell } from "@/components/error-page-shell";

export default function GuidanceError({
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
      title="Guidance Error"
      message="The AI guidance engine encountered an error. This may be due to an API key issue or a temporary service disruption."
      icon={<FileText className="w-8 h-8 text-accent-gold" />}
      secondaryHref="/settings"
      secondaryLabel="Check API Settings"
      logContext="Guidance error boundary"
    />
  );
}
