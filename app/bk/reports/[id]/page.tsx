import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assertTenantOrganization } from "@/lib/tenant-server";
import { MarkdownText } from "@/components/MarkdownText";
import { BpTreatmentReminderControl } from "@/components/BpTreatmentReminderControl";
import { BkReportList, BkReportNote } from "@/components/BkReportSection";

type TranscriptTurn = { role: "teacher" | "assistant"; text: string };

function parseTranscript(narrative: string): TranscriptTurn[] {
  const rolePattern = /^(Guru|Teacher|Ustadz|Asisten|Assistant|AI)\s*:\s*/i;
  const turns: TranscriptTurn[] = [];
  let current: TranscriptTurn | null = null;

  for (const line of narrative.split("\n")) {
    const match = line.match(rolePattern);
    if (match) {
      if (current) turns.push(current);
      current = {
        role: /^(Guru|Teacher|Ustadz)/i.test(match[1]) ? "teacher" : "assistant",
        text: line.replace(rolePattern, "").trim(),
      };
    } else if (current && line.trim()) {
      current.text += `\n${line.trim()}`;
    }
  }
  if (current) turns.push(current);
  return turns;
}

function SessionTranscript({ narrative }: { narrative: string }) {
  const turns = parseTranscript(narrative);
  if (!turns.length) return null;
  return <section className="rounded-2xl border-2 border-slate-100 bg-white p-5" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
    <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800"><MessageSquareText className="h-4 w-4 text-brand-600" />Percakapan sesi</h2>
    <div className="space-y-3">
      {turns.map((turn, index) => <div key={index} className={turn.role === "teacher" ? "ml-auto max-w-[88%]" : "w-full"}>
        <p className={`mb-1 text-[9px] font-black uppercase tracking-widest ${turn.role === "teacher" ? "text-right text-brand-600" : "text-slate-400"}`}>{turn.role === "teacher" ? "Guru" : "Asisten BK"}</p>
        <div className={turn.role === "teacher" ? "rounded-2xl rounded-br-md bg-brand-500 px-3 py-2.5 text-sm font-bold leading-relaxed text-white" : "rounded-2xl rounded-bl-md border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-bold leading-relaxed text-slate-700"}>
          <MarkdownText>{turn.text}</MarkdownText>
        </div>
      </div>)}
    </div>
  </section>;
}

export default async function BpReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const db = await createClient();
  const { data: report } = await db.from("bp_reports").select("*, students(name)").eq("id", id).maybeSingle();
  if (!report) notFound(); await assertTenantOrganization(db, report.organization_id);
  const { data: reminder } = await db.from("bp_treatment_reminders").select("frequency_days, next_check_at").eq("report_id", report.id).maybeSingle();
  const analysis = typeof report.analysis === "string" ? JSON.parse(report.analysis) : report.analysis ?? {};
  return <div className="min-h-screen bg-paper pb-10">
    <header className="border-b-2 border-slate-100 bg-white px-5 py-4" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
      <Link href="/bk/history" className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-500"><ArrowLeft className="h-4 w-4" /></Link>
    </header>
    <main className="space-y-5 px-5 py-6">
      <section className="rounded-[2rem] bg-brand-500 p-6 text-white" style={{ boxShadow: "0 5px 0 var(--brand-700)" }}>
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-100">Catatan bimbingan • {report.students?.name ?? "Siswa"}</p>
        <h1 className="mt-2 text-2xl font-black leading-tight">{report.title}</h1>
        <MarkdownText className="mt-4 text-sm font-bold leading-relaxed text-white/90">{analysis.summary}</MarkdownText>
      </section>
      <BkReportList kind="concern" label="Pemetaan situasi" title="Hal yang perlu diperhatikan" items={analysis.presenting_concerns} />
      <BkReportList kind="strength" label="Modal yang dimiliki" title="Kekuatan yang dapat dikembangkan" items={analysis.strengths} />
      <BkReportList kind="goal" label="Arah perubahan" title="Tujuan jangka dekat" items={analysis.goals} />
      <BkReportList kind="teacher-action" label="Peran guru" title="Langkah yang disarankan untuk guru" items={analysis.recommended_actions} />
      <BkReportList kind="student-action" label="Langkah siswa" title="Langkah kecil untuk siswa" items={analysis.student_actions} />
      <BkReportNote kind="family" label="Kolaborasi keluarga" title="Komunikasi dengan orang tua">{analysis.parent_communication}</BkReportNote>
      <BkReportNote kind="follow-up" label="Pemantauan berikutnya" title="Tindak lanjut">{analysis.follow_up}</BkReportNote>
      <BpTreatmentReminderControl reportId={report.id} frequencyDays={reminder?.frequency_days} nextCheckAt={reminder?.next_check_at} checkins={Array.isArray(analysis.follow_up_checkins) ? analysis.follow_up_checkins : []} />
      <SessionTranscript narrative={report.narrative} />
    </main>
  </div>;
}
