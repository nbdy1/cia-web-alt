"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUserRole } from "@/lib/hooks/use-user-role";
import { ChevronLeft } from "lucide-react";

type SmartBackButtonProps = {
  fallbackHref?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  preferHistory?: boolean;
};

export function SmartBackButton({ fallbackHref, className, style, children, preferHistory = true }: SmartBackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useUserRole();

  const resolvedFallback = fallbackHref || (role === "admin" ? "/admin/monitoring" : "/students");

  const handleBack = () => {
    if (!preferHistory) {
      router.replace(resolvedFallback);
      return;
    }

    if (typeof window !== "undefined") {
      const prevPath = window.sessionStorage.getItem("cia:prev-path");
      const currentPath = pathname || "";

      if (prevPath && prevPath !== currentPath) {
        router.replace(prevPath);
        return;
      }

      const historyState = window.history.state as { idx?: number } | null;
      if (historyState && typeof historyState.idx === "number" && historyState.idx > 0) {
        router.back();
        return;
      }
    }

    router.replace(resolvedFallback);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className}
      style={style}
      aria-label="Kembali"
      title="Kembali"
    >
      <span className={children ? "inline-flex items-center gap-1" : "inline-flex items-center"}>
        <ChevronLeft className="w-5 h-5 transition-transform hover:-translate-x-1" />
        {children}
      </span>
    </button>
  );
}
