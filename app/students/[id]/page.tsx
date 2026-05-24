import React from "react";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  User,
  FileText,
  ChevronRight,
  ChevronLeft,
  Clock,
} from "lucide-react";
import Link from "next/link";

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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, reports } = await getStudentData(id);

  if (!student)
    return (
      <div className="p-10 text-center text-slate-500 font-medium">
        Student not found.
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Header Section */}
      <div className="bg-white px-6 pt-12 pb-10 border-b border-slate-100 rounded-b-[3.5rem] shadow-sm relative">
        {/* Back Button */}
        <Link
          href="/students"
          className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-600 transition-colors mb-6 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">
            Back to Dashboard
          </span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-6">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 bg-emerald-900 rounded-[2rem] flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-emerald-100">
              {student.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                {student.name}
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2 mt-1">
                <User size={12} className="text-emerald-500" />{" "}
                {student.batch || "Reguler Batch"}
              </p>
            </div>
          </div>
        </div>
        <Link
          href={`/students/${student.id}/recap`}
          className="flex items-center gap-2 mt-5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-5 py-3 rounded-2xl font-bold transition-all border border-emerald-200 shadow-sm self-start md:self-auto"
        >
          <FileText size={18} />
          Rekapitulasi Pencapaian
        </Link>
      </div>

      <main className="px-6 space-y-8 mt-6">
        {/* History List */}
        <section>
          <div className="flex items-center justify-between mb-5 px-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Assessment History
            </h3>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              {reports?.length || 0} Records
            </span>
          </div>

          <div className="space-y-4">
            {reports && reports.length > 0 ? (
              reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="bg-white p-6 rounded-[2.5rem] flex items-center justify-between border border-slate-100 active:scale-95 transition-all shadow-sm hover:shadow-md group"
                >
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-slate-50 rounded-3xl group-hover:bg-emerald-900 group-hover:text-white transition-all text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      {/* Increased padding-bottom via space-y or mb to separate from date */}
                      <p className="font-black text-slate-900 text-sm mb-1">
                        {report.title || "Laporan Perkembangan"}
                      </p>

                      <div className="flex items-center gap-3">
                        <div className="text-slate-400 text-[10px] font-bold flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md">
                          <Calendar size={10} />
                          {new Date(report.created_at).toLocaleDateString(
                            "id-ID",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )}
                        </div>
                        <div className="text-emerald-600 text-[10px] font-black flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <Clock size={10} />
                          {new Date(report.created_at).toLocaleTimeString(
                            "id-ID",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-full group-hover:bg-emerald-50 transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-16 bg-white rounded-[3rem] border border-dashed border-slate-200 text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  No reports found yet.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
