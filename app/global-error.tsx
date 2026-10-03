"use client";

import { useEffect } from "react";
import { AppErrorFallback } from "@/components/AppErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App] Unhandled render error", error);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scope: "application",
        digest: error.digest ?? null,
        name: error.name,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <AppErrorFallback error={error} reset={reset} scope="application" />
      </body>
    </html>
  );
}
