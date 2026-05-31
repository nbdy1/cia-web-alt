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
