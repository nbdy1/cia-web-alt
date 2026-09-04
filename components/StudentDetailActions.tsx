"use client";

import Link from "next/link";
import { ClipboardList, FileText, Printer } from "lucide-react";
import { useTerminology } from "@/lib/hooks/use-terminology";

export function StudentDetailActions({ studentId }: { studentId: string }) {
  const { language } = useTerminology();
  const isEnglish = language === "en";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <Link
          href={`/students/${studentId}/scores`}
          className="flex items-center gap-2 px-4 py-3 justify-center font-black text-sm text-sky-700 bg-white rounded-2xl border-2 border-sky-200 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 4px 0 0 #bae6fd" }}
        >
          <ClipboardList size={16} />
          {isEnglish ? "Enter CMS scores" : "Input Nilai CMS"}
        </Link>
        <Link
          href={`/students/${studentId}/rapor`}
          className="flex items-center gap-2 px-4 py-3 justify-center font-black text-sm text-violet-700 bg-white rounded-2xl border-2 border-violet-200 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 4px 0 0 #ddd6fe" }}
        >
          <Printer size={16} />
          {isEnglish ? "Print report card" : "Cetak Rapor"}
        </Link>
      </div>

      <Link
        href={`/students/${studentId}/recap`}
        className="flex items-center gap-2 px-5 py-3 w-full justify-center font-black text-sm text-brand-700 bg-white rounded-2xl border-2 border-brand-200 active:translate-y-px transition-transform"
        style={{ boxShadow: "0 4px 0 0 var(--brand-300)" }}
      >
        <FileText size={16} />
        {isEnglish ? "CMS percentage" : "Persentase CMS"}
      </Link>
    </>
  );
}
