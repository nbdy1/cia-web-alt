"use client";

import { useEffect } from "react";
import { AppErrorFallback } from "@/components/AppErrorFallback";

export default function AssessmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Assessment page] Unhandled render error", error);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "assessment",
        digest: error.digest ?? null,
        name: error.name,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return <AppErrorFallback error={error} reset={reset} scope="assessment" />;
}
