"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { getDueTreatmentFollowups, recordTreatmentFollowup } from "@/app/actions/treatment-followups";
import { useAuth } from "@/lib/context/auth-context";
import { useTerminology } from "@/lib/hooks/use-terminology";

type DueReminder = { id: string; reportId: string; studentName: string; title: string; actionPlan: string };

export function DueTreatmentFollowups() {
  const { activeOrganizationId } = useAuth();
  const t = useTerminology();
  const isEnglish = t.language === "en";
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const [active, setActive] = useState<DueReminder | null>(null);
  const [outcome, setOutcome] = useState<"done" | "not_done" | null>(null);
  const [reflection, setReflection] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const notified = useRef(new Set<string>());

  useEffect(() => {
    if (!activeOrganizationId) return;
    void getDueTreatmentFollowups(activeOrganizationId).then((items) => {
      setReminders(items);
      setActive(items[0] ?? null);
    });
  }, [activeOrganizationId]);

  useEffect(() => {
    if (!active || !("Notification" in window) || Notification.permission !== "granted" || notified.current.has(active.id)) return;
    notified.current.add(active.id);
    const notification = new Notification("CDS", { body: isEnglish ? `Time to record ${active.studentName}'s treatment follow-up.` : `Saatnya mencatat tindak lanjut treatment ${active.studentName}.`, icon: "/icon.png", tag: `treatment-followup-${active.id}` });
    notification.onclick = () => window.focus();
  }, [active, isEnglish]);

  if (!active) return null;
  function submit() {
    const reminder = active;
    if (!reminder) return;
    if (!outcome || reflection.trim().length < 12) {
      setError(isEnglish ? "Choose a status and add a brief observation or reason." : "Pilih status dan tuliskan sedikit hasil pengamatan atau alasan.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await recordTreatmentFollowup(reminder.id, outcome, reflection);
      if (!result.success) { setError(result.error ?? (isEnglish ? "Follow-up could not be saved." : "Tindak lanjut belum dapat disimpan.")); return; }
      const remaining = reminders.filter((item) => item.id !== reminder.id);
      setReminders(remaining); setActive(remaining[0] ?? null); setOutcome(null); setReflection("");
    });
  }

  return <section className="mb-6 rounded-2xl border-2 border-brand-200 bg-brand-50 p-4" style={{ boxShadow: "0 3px 0 #d1fae5" }}>
    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}><BellRing className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-brand-700">{isEnglish ? "Treatment follow-up" : "Tindak lanjut treatment"}</p><h2 className="mt-0.5 truncate text-base font-black text-slate-800">{active.studentName} — {active.title}</h2>{active.actionPlan && <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-600">{active.actionPlan}</p>}</div></div>
    <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setOutcome("done")} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-black ${outcome === "done" ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-brand-700"}`}>{isEnglish ? "Treatment was tried" : "Treatment sudah dicoba"}</button><button type="button" onClick={() => setOutcome("not_done")} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-black ${outcome === "not_done" ? "border-slate-600 bg-slate-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{isEnglish ? "Not done yet" : "Belum dilakukan"}</button></div>
    <label className="mt-3 block text-xs font-bold text-slate-600">{outcome === "done" ? (isEnglish ? "What was done and how did the student respond?" : "Apa yang dilakukan dan bagaimana respons siswa?") : (isEnglish ? "What prevented it from being done?" : "Apa yang membuat treatment belum dilakukan?")}<textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={3} placeholder={isEnglish ? "Write a brief note for the next assessment…" : "Tulis catatan singkat untuk asesmen berikutnya…"} className="mt-1.5 w-full resize-none rounded-xl border-2 border-brand-100 bg-white px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 outline-none focus:border-brand-400" /></label>
    <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] font-medium leading-relaxed text-slate-500">{isEnglish ? "A missed plan will be reminded again in two days." : "Treatment yang belum dilakukan akan diingatkan kembali dua hari lagi."}</p><button type="button" onClick={submit} disabled={pending} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-black text-white disabled:bg-slate-300" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isEnglish ? "Save" : "Simpan"}</button></div>
    {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
  </section>;
}
