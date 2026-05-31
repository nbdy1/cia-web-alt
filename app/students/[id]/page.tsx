import React from "react";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  User,
  FileText,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { SmartBackButton } from "@/components/SmartBackButton";

async function getStudentData(id: string) {
  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  const { data: reports } = await supabase
    .from("reports")
    .select(
      `
      id,
      title,
      created_at,
      narrative
    `,
    )
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  return { student, reports };
}

export default async function StudentProfile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { student, reports } = await getStudentData(id);
  const rawFrom = resolvedSearchParams?.from;
  const from = Array.isArray(rawFrom) ? rawFrom[0] : rawFrom;
  const backHref = from === "/admin/monitoring" ? "/admin/monitoring" : "/students";
  const reportBackHref =
    from === "/admin/monitoring"
      ? `/students/${id}?from=${encodeURIComponent("/admin/monitoring")}`
      : `/students/${id}`;

  if (!student)
    return (
      <div className="p-10 text-center text-slate-500 font-medium">
        Santri tidak ditemukan.
      </div>
    );

  return (
    <div className="min-h-screen bg-paper pb-20 font-sans">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <SmartBackButton
          fallbackHref={backHref}
          preferHistory={false}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border-2 border-slate-200 text-slate-500 mb-6 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}
        />

        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-20 h-20 bg-emerald-500 rounded-[1.6rem] flex items-center justify-center text-white text-3xl font-black flex-shrink-0"
            style={{ boxShadow: "0 5px 0 0 #15803d" }}
          >
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">{student.name}</h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                <User size={9} /> {student.batch || "Reguler"}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/students/${student.id}/recap`}
          className="flex items-center gap-2 px-5 py-3 w-full justify-center font-black text-sm text-emerald-700 bg-white rounded-2xl border-2 border-emerald-200 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 4px 0 0 #6ee7b7" }}
        >
          <FileText size={16} />
          Rekapitulasi Pencapaian
        </Link>
      </div>

      <main className="px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
            <FileText size={9} /> {reports?.length || 0} Laporan
          </div>
        </div>

        <div className="space-y-3">
          {reports && reports.length > 0 ? (
            reports.map((report) => (
              <Link
                key={report.id}
                href={`/reports/${report.id}?from=${encodeURIComponent(reportBackHref)}`}
                className="card-3d-link block"
              >
                <div className="card-3d p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center border-2 border-emerald-100"
                    >
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm leading-tight">
                        {report.title || "Laporan Perkembangan"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-400">
                          <Calendar size={8} />
                          {new Date(report.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-16 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-sm font-black text-slate-400">Belum ada laporan</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
