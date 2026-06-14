/**
 * components/SmartBackButton.tsx
 *
 * A back button that figures out the right destination without relying solely
 * on browser history (which breaks after a hard refresh or direct URL entry).
 *
 * Priority order:
 *   1. If sessionStorage "cia:prev-path" exists and differs from the current
 *      path → navigate there (set by LayoutWrapper on each route change).
 *   2. If window.history.state.idx > 0 → router.back() (in-session navigation).
 *   3. Fall back to the `fallbackHref` prop, or the role-based default:
 *      admin → /admin/monitoring, ustadz → /students.
 *
 * Props:
 *   fallbackHref    – explicit fallback URL (overrides role default)
 *   preferHistory   – set to false to always use the fallback (skip checks 1 & 2)
 *   className/style – passed to the <button> element
 *   children        – rendered next to the chevron icon
 */
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
