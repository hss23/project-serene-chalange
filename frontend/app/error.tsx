"use client";

import { ErrorBanner } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <div className="mx-auto max-w-lg py-16">
      <ErrorBanner message="Something went wrong while showing this page." onRetry={reset} />
    </div>
  );
}
