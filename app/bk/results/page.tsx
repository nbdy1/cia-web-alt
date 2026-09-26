"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2, Save } from "lucide-react";
import { saveBpReportAction } from "@/app/actions/save-bp-report";
import { useSettings } from "@/lib/context/settings-context";
import { MarkdownText } from "@/components/MarkdownText";
import { ConfirmModal } from "@/components/ConfirmModal";
import { BkReportList, BkReportNote } from "@/components/BkReportSection";

export default function BpResultsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { language } = useSettings();
  const isEnglish = language === "en";
  const studentId = params.get("id") ?? "";
  const studentName = params.get("name") ?? (isEnglish ? "Student" : "Siswa");
  const [analysis, setAnalysis] = useState<any>(null);
  const [narrative, setNarrative] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);

  useEffect(() => {
    try {
      setAnalysis(JSON.parse(sessionStorage.getItem("bp_analysis") ?? "null"));
      setNarrative(sessionStorage.getItem("bp_narrative") ?? "");
    } catch {}
  }, []);

  async function save() {
    if (!analysis || !studentId) return;
    setSaving(true);
    const result = await saveBpReportAction({ studentId, narrative, analysis });
    if (!result.success) {
      alert((isEnglish ? "Could not save: " : "Tidak dapat menyimpan: ") + result.error);
      setSaving(false);
      return;
    }
    sessionStorage.removeItem("bp_analysis");
    sessionStorage.removeItem("bp_narrative");
    sessionStorage.removeItem(`bp_draft_${studentId}`);
    router.push(`/bk/reports/${result.id}`);
  }

  if (!analysis) return <div className="flex min-h-screen items-center justify-center bg-paper"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>;

  return <div className="min-h-screen bg-paper pb-32">
    <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-slate-100 bg-white px-5 py-4" style={{ boxShadow: "0 3px 0 #e2e8f0" }}>
      <button onClick={() => setConfirmBack(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 text-slate-500"><ArrowLeft className="h-4 w-4" /></button>
      <div className="text-center"><h1 className="text-sm font-black text-slate-800">{studentName}</h1><p className="text-[10px] font-black uppercase tracking-widest text-brand-600">{isEnglish ? "Counselling plan" : "Rencana bimbingan"}</p></div>
      <div className="w-9" />
    </header>
    <main className="space-y-5 px-5 py-5">
      <section className="rounded-[2rem] bg-brand-500 p-6 text-white" style={{ boxShadow: "0 5px 0 var(--brand-700)" }}>
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-100">{isEnglish ? "Counselling note" : "Catatan bimbingan"}</p>
        <h2 className="mt-2 text-2xl font-black leading-tight">{analysis.title}</h2>
        <MarkdownText className="mt-4 text-sm font-bold leading-relaxed text-white/90">{analysis.summary}</MarkdownText>
      </section>
      {analysis.needs_immediate_attention && <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-800" style={{ boxShadow: "0 3px 0 #fecdd3" }}><div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white"><AlertTriangle className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-widest text-rose-700">{isEnglish ? "Safety priority" : "Prioritas keamanan"}</p><h2 className="mt-0.5 font-black">{isEnglish ? "Needs immediate attention" : "Perlu perhatian segera"}</h2><MarkdownText className="mt-1 text-sm font-bold">{analysis.safety_note}</MarkdownText></div></div></section>}
      <BkReportList kind="concern" label={isEnglish ? "Situation map" : "Pemetaan situasi"} title={isEnglish ? "What needs attention" : "Hal yang perlu diperhatikan"} items={analysis.presenting_concerns ?? []} />
      <BkReportList kind="strength" label={isEnglish ? "Existing strengths" : "Modal yang dimiliki"} title={isEnglish ? "Strengths to build on" : "Kekuatan yang dapat dikembangkan"} items={analysis.strengths ?? []} />
      <BkReportList kind="goal" label={isEnglish ? "Direction of change" : "Arah perubahan"} title={isEnglish ? "Near-term goals" : "Tujuan jangka dekat"} items={analysis.goals ?? []} />
      <BkReportList kind="teacher-action" label={isEnglish ? "Teacher role" : "Peran guru"} title={isEnglish ? "Suggested actions for teachers" : "Langkah yang disarankan untuk guru"} items={analysis.recommended_actions ?? []} />
      <BkReportList kind="student-action" label={isEnglish ? "Student steps" : "Langkah siswa"} title={isEnglish ? "Small actions for the student" : "Langkah kecil untuk siswa"} items={analysis.student_actions ?? []} />
      <BkReportNote kind="family" label={isEnglish ? "Family collaboration" : "Kolaborasi keluarga"} title={isEnglish ? "Parent communication" : "Komunikasi dengan orang tua"}>{analysis.parent_communication}</BkReportNote>
      <BkReportNote kind="follow-up" label={isEnglish ? "Next check-in" : "Pemantauan berikutnya"} title={isEnglish ? "Follow-up" : "Tindak lanjut"}>{analysis.follow_up}</BkReportNote>
    </main>
    <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[450px] -translate-x-1/2 border-t-2 border-slate-100 bg-white p-4">
      <button onClick={save} disabled={saving} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 py-3 text-sm font-black text-white disabled:bg-slate-300" style={{ boxShadow: "0 4px 0 var(--brand-700)" }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? (isEnglish ? "Saving…" : "Menyimpan…") : (isEnglish ? "Save counselling note" : "Simpan catatan bimbingan")}</button>
    </div>
    <ConfirmModal isOpen={confirmBack} title={isEnglish ? "Continue the conversation?" : "Lanjutkan percakapan?"} description={isEnglish ? "Returning lets you add more context before saving this note." : "Kembali akan membuka percakapan agar Anda dapat menambahkan konteks sebelum menyimpan."} confirmLabel={isEnglish ? "Continue conversation" : "Lanjutkan percakapan"} cancelLabel={isEnglish ? "Stay here" : "Tetap di sini"} confirmVariant="success" onConfirm={() => router.push(`/bk/assessment?id=${encodeURIComponent(studentId)}&name=${encodeURIComponent(studentName)}`)} onCancel={() => setConfirmBack(false)} />
  </div>;
}
