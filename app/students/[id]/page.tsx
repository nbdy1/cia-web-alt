/**
 * app/students/[id]/page.tsx
 *
 * Student detail page — shows the student's profile, AI-generated profile
 * summary, and full report history (most recent first).
 *
 * Navigation: SmartBackButton returns to /students (or /admin/monitoring for
 * admin users). Action buttons:
 *   - "Profil Santri" → expands the AI profile summary inline
 *   - "Input Nilai"   → /students/[id]/scores (manual score entry)
 *   - "Rapor"         → /students/[id]/rapor  (printable report card)
 *   - "Rekapitulasi"  → /students/[id]/recap  (CIA sub-indicator breakdown)
 */
import React from "react";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  Calendar,
  User,
  FileText,
  ChevronRight,
  BookOpen,
  ClipboardList,
  Printer,
  UserCircle2,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { SmartBackButton } from "@/components/SmartBackButton";
import { getModelLabel } from "@/lib/data/models";
import { StudentAvatar } from "@/components/StudentAvatar";

async function getStudentData(id: string) {
  const db = await getServerSupabase();

  const { data: student } = await db
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  const { data: reports } = await db
    .from("reports")
    .select(
      `
      id,
      title,
      created_at,
      narrative,
      model_used
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
          <StudentAvatar
            name={student.name}
            photoUrl={student.photo_url ?? null}
            size="xl"
            colorIndex={0}
            style={{ boxShadow: "0 5px 0 0 var(--brand-700)" }}
          />
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">{student.name}</h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
                <User size={9} /> {student.nis ? `NIS: ${student.nis}` : "Santri"}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 mb-2">
          <Link
            href={`/students/${student.id}/scores`}
            className="flex items-center gap-2 px-4 py-3 justify-center font-black text-sm text-sky-700 bg-white rounded-2xl border-2 border-sky-200 active:translate-y-px transition-transform"
            style={{ boxShadow: "0 4px 0 0 #bae6fd" }}
          >
            <ClipboardList size={16} />
            Input Nilai CMS
          </Link>
          <Link
            href={`/students/${student.id}/rapor`}
            className="flex items-center gap-2 px-4 py-3 justify-center font-black text-sm text-violet-700 bg-white rounded-2xl border-2 border-violet-200 active:translate-y-px transition-transform"
            style={{ boxShadow: "0 4px 0 0 #ddd6fe" }}
          >
            <Printer size={16} />
            Cetak Rapor
          </Link>
        </div>

        <Link
          href={`/students/${student.id}/recap`}
          className="flex items-center gap-2 px-5 py-3 w-full justify-center font-black text-sm text-brand-700 bg-white rounded-2xl border-2 border-brand-200 active:translate-y-px transition-transform"
          style={{ boxShadow: "0 4px 0 0 var(--brand-300)" }}
        >
          <FileText size={16} />
          Persentase CMS
        </Link>
      </div>

      <main className="px-6 space-y-6">

        {/* Profile Summary Card — collapsible */}
        {student.profile_summary && (
          <details
            className="bg-white rounded-[2rem] border-2 border-amber-100 overflow-hidden group [&_summary::-webkit-details-marker]:hidden"
            style={{ boxShadow: "0 4px 0 0 #fde68a" }}
          >
            <summary className="flex items-center gap-3 px-5 py-4 bg-amber-50 cursor-pointer select-none group-open:border-b-2 group-open:border-amber-100 active:opacity-80 transition-opacity">
              <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center flex-shrink-0" style={{ boxShadow: "0 3px 0 0 #d97706" }}>
                <UserCircle2 size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Profil Santri</p>
                <p className="text-[9px] text-amber-500 font-bold">Dihasilkan oleh AI dari riwayat laporan</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-amber-200 text-amber-800">
                  <BookOpen size={8} /> AI
                </span>
                <ChevronRight size={16} className="text-amber-400 transition-transform duration-200 group-open:rotate-90" />
              </div>
            </summary>
            <div className="px-5 py-4 space-y-3">
              {(() => {
                /* ── Extract the profile text from whatever JSON shape is stored ── */
                const raw: string = student.profile_summary ?? "";
                let text = raw.trim();

                try {
                  const parsed = JSON.parse(raw);

                  // Helper: pull the profile string from a plain object
                  const fromObject = (obj: Record<string, unknown>): string | null =>
                    (typeof obj?.profil_karakter === "string" ? obj.profil_karakter
                      : typeof obj?.profil_santri === "string" ? obj.profil_santri
                      : typeof obj?.profil === "string" ? obj.profil
                      : typeof obj?.profile === "string" ? obj.profile
                      : null);

                  if (Array.isArray(parsed)) {
                    if (parsed.length > 0) {
                      const first = parsed[0];
                      if (typeof first === "string") {
                        text = first;
                      } else if (first && typeof first === "object") {
                        text = fromObject(first as Record<string, unknown>) ?? raw;
                      }
                    }
                  } else if (parsed && typeof parsed === "object") {
                    text = fromObject(parsed as Record<string, unknown>) ?? raw;
                  } else if (typeof parsed === "string") {
                    text = parsed;
                  }
                } catch {
                  /* not JSON — use raw text as-is */
                }

                /*
                 * ── Split into readable paragraphs ──
                 * Strategy: split on sentence-ending punctuation followed by a
                 * capital letter / "Namun" / "Selain" / "Bagi" / "Ia" / "Meski"
                 * so long monolithic text breaks into 3-5 natural chunks.
                 */
                const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
                const paragraphs: string[] = [];
                const CHUNK = 2; // sentences per paragraph
                for (let i = 0; i < sentences.length; i += CHUNK) {
                  paragraphs.push(sentences.slice(i, i + CHUNK).join(" ").trim());
                }
                if (paragraphs.length === 0) paragraphs.push(text);

                return paragraphs.map((para, idx) => (
                  <p
                    key={idx}
                    className="text-sm text-slate-700 leading-relaxed font-medium"
                  >
                    {para}
                  </p>
                ));
              })()}
            </div>
          </details>
        )}

        {/* Report count badge */}
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
                      className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center border-2 border-brand-100"
                    >
                      <FileText className="w-5 h-5 text-brand-600" />
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
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                          <Cpu size={8} /> {getModelLabel(report.model_used)}
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
