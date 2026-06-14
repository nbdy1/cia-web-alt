/**
 * components/ReportBackButton.tsx
 *
 * Back button specialised for report detail pages (/reports/[id]).
 * A report can be reached from either the teacher's student profile page or
 * from the admin monitoring view, so the fallback destination is role-aware:
 *   - admin  → /admin/monitoring
 *   - ustadz → /students/[studentId]
 *
 * Prefers browser history (document.referrer check) over hardcoded fallbacks
 * so mid-session navigation feels natural. Falls back gracefully when the page
 * was opened via a direct link or after a refresh.
 *
 * Props:
 *   studentId    – used to build the ustadz fallback URL
 *   fallbackFrom – explicit fallback URL (overrides role default)
 */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useUserRole } from "@/lib/hooks/use-user-role";

type ReportBackButtonProps = {
  studentId: string;
  fallbackFrom?: string | null;
};

export function ReportBackButton({ studentId, fallbackFrom }: ReportBackButtonProps) {
  const router = useRouter();
  const { role } = useUserRole();

  const fallbackHref = fallbackFrom || (role === "admin" ? "/admin/monitoring" : `/students/${studentId}`);

  const handleBack = () => {
    if (typeof window !== "undefined") {
      const hasSameOriginHistory =
        document.referrer.startsWith(window.location.origin) && window.history.length > 1;

      if (hasSameOriginHistory) {
        router.back();
        return;
      }
    }

    router.replace(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-all"
      aria-label="Kembali"
      title="Kembali"
    >
      <ChevronLeft className="w-6 h-6 text-slate-800" />
    </button>
  );
}
