/**
 * app/bk/monthly/[id]/page.tsx
 *
 * One student's monthly counselling report (Rapor bulanan BK). Facts at the top
 * (sessions, dates, safety flags, follow-ups) come from the data; the narrative
 * sections are the AI's draft from existing notes, reviewed and edited by the
 * counselor (components/bk/BkMonthlySummaryActions.tsx) before being marked final.
 * Print-friendly: the review controls hide when printing.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarCheck, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { getServerAppLanguage } from "@/lib/server/language";
import { MarkdownText } from "@/components/MarkdownText";
import { StudentAvatar } from "@/components/StudentAvatar";
import { BkReportList, BkReportNote } from "@/components/BkReportSection";
import { BkMonthlySummaryActions } from "@/components/bk/BkMonthlySummaryActions";
import { diffSources, monthBounds, monthLabel, type BkArea, type BkMonthlySummaryData, type BkTrend } from "@/lib/bk-monthly";

export default async function BkMonthlySummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const language = await getServerAppLanguage();
  const isEnglish = language === "en";
  const locale = isEnglish ? "en-US" : "id-ID";
  const db = await createClient();

  const { data: row } = await db
    .from("bp_monthly_summaries")
    .select("*, students(name, photo_url, nis)")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();
  await assertTenantOrganization(db, row.organization_id);

  const summary = (typeof row.summary === "string" ? JSON.parse(row.summary) : row.summary ?? {}) as Partial<BkMonthlySummaryData>;
  const month = String(row.period_month).slice(0, 7);
  const facts = summary.facts ?? { sessionsCount: row.sessions_count ?? 0, sessionDates: [], safetyFlags: [], followUps: { done: 0, notDone: 0 } };
  const { startIso, endIso } = monthBounds(month);

  // Sessions in this month now vs the ones the report was built from.
  const { data: monthSessions } = await db
    .from("bp_reports")
    .select("id, title, created_at")
    .eq("student_id", row.student_id)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true });
  const currentIds = (monthSessions ?? []).map((s: any) => s.id);
  const { newCount } = diffSources(row.source_report_ids ?? [], currentIds);
  const included = (monthSessions ?? []).filter((s: any) => (row.source_report_ids ?? []).includes(s.id));

  const studentName = row.students?.name ?? (isEnglish ? "Student" : "Siswa");
  const isFinal = row.status === "final";

  const areaLabel: Record<BkArea, string> = {
    pribadi: isEnglish ? "Personal" : "Pribadi",
    sosial: isEnglish ? "Social" : "Sosial",
    belajar: isEnglish ? "Learning" : "Belajar",
    karier: isEnglish ? "Career" : "Karier",
  };
  const trendLabel: Record<BkTrend, { text: string; tone: string }> = {
    membaik: { text: isEnglish ? "Improving" : "Membaik", tone: "bg-emerald-100 text-emerald-700" },
    stabil: { text: isEnglish ? "Stable" : "Stabil", tone: "bg-sky-100 text-sky-700" },
    perlu_dipantau: { text: isEnglish ? "Needs monitoring" : "Perlu dipantau", tone: "bg-amber-100 text-amber-700" },
    belum_cukup_data: { text: isEnglish ? "Not enough data for a trend" : "Belum cukup data untuk tren", tone: "bg-slate-100 text-slate-500" },
  };
  const trend = trendLabel[(summary.trend as BkTrend) ?? "belum_cukup_data"] ?? trendLabel.belum_cukup_data;
  const formatDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", day: "numeric", month: "short" });

  return (
    <div className="min-h-screen bg-paper pb-10 print:bg-white">
      <header className="border-b-2 border-slate-100 bg-white px-5 py-4 print:hidden" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
        <Link href={`/bk/students/${row.student_id}?name=${encodeURIComponent(studentName)}`} className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-500" aria-label={isEnglish ? "Back" : "Kembali"}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </header>

      <main className="space-y-5 px-5 py-6">
        <section className="rounded-[2rem] bg-brand-500 p-6 text-white print:border print:border-slate-300 print:bg-white print:text-slate-900 print:shadow-none" style={{ boxShadow: "0 5px 0 var(--brand-700)" }}>
          <div className="flex items-center gap-3">
            <StudentAvatar name={studentName} photoUrl={row.students?.photo_url ?? null} size="md" colorIndex={0} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-100 print:text-slate-500">
                {isEnglish ? "Monthly counselling report" : "Rapor bulanan BK"}
              </p>
              <h1 className="truncate text-xl font-bold leading-tight">{studentName}</h1>
              <p className="text-xs font-bold capitalize text-brand-100 print:text-slate-500">{monthLabel(month, locale)}</p>
            </div>
          </div>
          <MarkdownText className="mt-4 text-sm font-bold leading-relaxed text-white/90 print:text-slate-700">{summary.overview ?? ""}</MarkdownText>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${trend.tone}`}>{trend.text}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isFinal ? "bg-white text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {isFinal && <Lock className="h-3 w-3" />}
              {isFinal ? "Final" : "Draft"}
            </span>
          </div>
        </section>

        {newCount > 0 && !isFinal && (
          <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold leading-relaxed text-sky-800 print:hidden">
            {isEnglish
              ? `${newCount} session${newCount === 1 ? " was" : "s were"} added after this report was written. Update it so it includes them.`
              : `${newCount} sesi ditambahkan setelah rapor ini dibuat. Perbarui agar ikut tercakup.`}
          </div>
        )}
        {newCount > 0 && isFinal && (
          <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold leading-relaxed text-sky-800 print:hidden">
            {isEnglish ? `${newCount} newer session(s) are not in this final report. Reopen it as a draft to update.` : `${newCount} sesi baru belum tercakup di rapor final ini. Buka kembali sebagai draft untuk memperbaruinya.`}
          </div>
        )}

        {/* Facts from the data, not from the AI. */}
        <section className="rounded-2xl border-2 border-slate-100 bg-white p-5" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <CalendarCheck className="h-4 w-4 text-brand-600" />
            {isEnglish ? "This month in numbers" : "Bulan ini dalam angka"}
          </h2>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isEnglish ? "Sessions" : "Sesi"}</dt><dd className="mt-1 text-2xl font-bold text-slate-800">{facts.sessionsCount}</dd></div>
            <div className="rounded-xl bg-emerald-50 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{isEnglish ? "Tried" : "Dicoba"}</dt><dd className="mt-1 text-2xl font-bold text-emerald-700">{facts.followUps.done}</dd></div>
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isEnglish ? "Not yet" : "Belum"}</dt><dd className="mt-1 text-2xl font-bold text-slate-600">{facts.followUps.notDone}</dd></div>
          </dl>
          {facts.sessionDates.length > 0 && (
            <p className="mt-3 text-xs font-bold text-slate-500">
              {isEnglish ? "Session dates: " : "Tanggal sesi: "}
              {facts.sessionDates.map(formatDate).join(", ")}
            </p>
          )}
        </section>

        {facts.safetyFlags.length > 0 && (
          <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-800" style={{ boxShadow: "0 3px 0 #fecdd3" }}>
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">{isEnglish ? "Safety priority" : "Prioritas keamanan"}</p>
                <h2 className="mt-0.5 font-bold">{isEnglish ? "A session needed immediate attention" : "Ada sesi yang perlu perhatian segera"}</h2>
                <ul className="mt-2 space-y-2 text-sm font-bold">
                  {facts.safetyFlags.map((flag, index) => (
                    <li key={index}><span className="mr-1.5 text-rose-600">{flag.date && formatDate(flag.date)}</span>{flag.note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {(summary.areas?.length ?? 0) > 0 && (
          <section className="rounded-2xl border-2 border-slate-100 bg-white p-5" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
            <h2 className="mb-3 text-sm font-bold text-slate-800">{isEnglish ? "Areas of guidance" : "Bidang bimbingan"}</h2>
            <ul className="space-y-3">
              {summary.areas!.map((item) => (
                <li key={item.area}>
                  <span className="inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">{areaLabel[item.area] ?? item.area}</span>
                  <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{item.note}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <BkReportList kind="strength" label={isEnglish ? "Progress" : "Perkembangan"} title={isEnglish ? "What has improved" : "Yang sudah berkembang"} items={summary.progress} />
        <BkReportList kind="concern" label={isEnglish ? "Still ongoing" : "Masih berjalan"} title={isEnglish ? "What still needs attention" : "Yang masih perlu perhatian"} items={summary.ongoing_concerns} />
        <BkReportList kind="strength" label={isEnglish ? "Strengths" : "Modal yang dimiliki"} title={isEnglish ? "Strengths to build on" : "Kekuatan yang dapat dikembangkan"} items={summary.strengths} />
        <BkReportList kind="teacher-action" label={isEnglish ? "What was done" : "Yang sudah dilakukan"} title={isEnglish ? "Steps taken this month" : "Langkah bulan ini"} items={summary.actions_taken} />
        <BkReportList kind="goal" label={isEnglish ? "Next month" : "Bulan depan"} title={isEnglish ? "Plan for next month" : "Rencana bulan depan"} items={summary.next_month_plan} />
        <BkReportNote kind="family" label={isEnglish ? "Family collaboration" : "Kolaborasi keluarga"} title={isEnglish ? "Parent communication" : "Komunikasi dengan orang tua"}>{summary.parent_collaboration}</BkReportNote>

        {row.teacher_note?.trim() && (
          <section className="rounded-2xl border-2 border-slate-200 bg-white p-5" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
            <h2 className="mb-2 text-sm font-bold text-slate-800">{isEnglish ? "Counselor's note" : "Catatan guru BK"}</h2>
            <p className="whitespace-pre-line text-sm font-medium leading-relaxed text-slate-700">{row.teacher_note}</p>
          </section>
        )}

        {included.length > 0 && (
          <section className="rounded-2xl border-2 border-slate-100 bg-white p-5 print:hidden" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
            <h2 className="mb-3 text-sm font-bold text-slate-800">{isEnglish ? "Sessions included" : "Sesi yang dirangkum"}</h2>
            <ul className="space-y-2">
              {included.map((session: any) => (
                <li key={session.id}>
                  <Link href={`/bk/reports/${session.id}`} className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700 hover:text-brand-700">
                    <span className="truncate">{session.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">{new Date(session.created_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <BkMonthlySummaryActions
          id={row.id}
          studentId={row.student_id}
          month={month}
          status={row.status}
          overview={summary.overview ?? ""}
          teacherNote={row.teacher_note ?? ""}
          newSessionsCount={newCount}
          isEnglish={isEnglish}
        />

        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-300 print:text-slate-400">
          {isEnglish ? "Draft by AI from session notes · reviewed by the counselor" : "Draft AI dari catatan sesi · ditinjau guru BK"}
        </p>
      </main>
    </div>
  );
}
