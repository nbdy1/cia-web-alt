"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { recordTreatmentFollowup } from "@/app/actions/treatment-followups";
import { useSettings } from "@/lib/context/settings-context";

type Checkin = { outcome?: string; reflection?: string; created_at?: string };

export function TreatmentFollowupControl({
  reminderId,
  nextCheckAt,
  isActive,
  checkins = [],
}: {
  reminderId: string;
  nextCheckAt: string;
  isActive: boolean;
  checkins?: Checkin[];
}) {
  const { language } = useSettings();
  const isEnglish = language === "en";
  const [outcome, setOutcome] = useState<"done" | "not_done" | null>(null);
  const [reflection, setReflection] = useState("");
  const [currentActive, setCurrentActive] = useState(isActive);
  const [currentNextAt, setCurrentNextAt] = useState(nextCheckAt);
  const [history, setHistory] = useState<Checkin[]>(checkins);
  const [error, setError] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">(
    typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission,
  );
  const [pending, startTransition] = useTransition();
  const isDue = new Date(currentNextAt).getTime() <= Date.now();
  const nextLabel = new Intl.DateTimeFormat(isEnglish ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(currentNextAt));

  function submit() {
    if (!outcome || reflection.trim().length < 12) {
      setError(isEnglish ? "Choose a status and write a brief observation or reason." : "Pilih status dan tuliskan sedikit hasil pengamatan atau alasan.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await recordTreatmentFollowup(reminderId, outcome, reflection);
      if (!result.success) {
        setError(result.error ?? (isEnglish ? "Follow-up could not be saved." : "Tindak lanjut belum dapat disimpan."));
        return;
      }
      const entry = { outcome, reflection: reflection.trim(), created_at: new Date().toISOString() };
      setHistory((previous) => [...previous, entry].slice(-6));
      setReflection("");
      setOutcome(null);
      if (outcome === "done") setCurrentActive(false);
      else if (result.nextCheckAt) setCurrentNextAt(result.nextCheckAt);
    });
  }

  async function allowNotifications() {
    if (!("Notification" in window)) return;
    setNotificationStatus(await Notification.requestPermission());
  }

  const recentCheckins = history.slice(-3).reverse();
  return (
    <section className="mt-4 rounded-2xl border-2 border-brand-100 bg-white p-4" style={{ boxShadow: "0 3px 0 #d1fae5" }}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>{currentActive ? <Bell className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</span>
        <div>
          <h4 className="text-sm font-black text-slate-800">{currentActive ? (isEnglish ? "Required treatment follow-up" : "Tindak lanjut treatment") : (isEnglish ? "Treatment recorded" : "Treatment telah dicatat")}</h4>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-600">{currentActive ? (isDue ? (isEnglish ? "It is time to record whether this plan has been tried." : "Sudah waktunya mencatat apakah rencana ini telah dicoba.") : (isEnglish ? `This plan needs to be tried by ${nextLabel}.` : `Rencana ini perlu dicoba paling lambat ${nextLabel}.`)) : (isEnglish ? "Thank you. This outcome will inform later assessments." : "Terima kasih. Hasil ini akan menjadi konteks asesmen berikutnya.")}</p>
        </div>
      </div>

      {currentActive && <>
        {isDue ? <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setOutcome("done")} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-black ${outcome === "done" ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-brand-50 text-brand-700"}`}>{isEnglish ? "Treatment was tried" : "Treatment sudah dicoba"}</button>
          <button type="button" onClick={() => setOutcome("not_done")} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-black ${outcome === "not_done" ? "border-slate-600 bg-slate-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{isEnglish ? "Not done yet" : "Belum dilakukan"}</button>
        </div> : <button type="button" onClick={() => setOutcome("done")} className={`mt-4 w-full rounded-xl border-2 px-3 py-2.5 text-xs font-black ${outcome === "done" ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-brand-50 text-brand-700"}`}>{isEnglish ? "Record treatment now" : "Catat treatment sudah dilakukan"}</button>}

        {outcome && <label className="mt-3 block text-xs font-bold text-slate-600">
          {outcome === "done" ? (isEnglish ? "What did you do and what was the student’s response?" : "Apa yang dilakukan dan bagaimana respons siswa?") : (isEnglish ? "What prevented it from being done?" : "Apa yang membuat treatment belum dilakukan?")}
          <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} rows={3} placeholder={isEnglish ? "Write a brief note for the next assessment…" : "Tulis catatan singkat untuk asesmen berikutnya…"} className="mt-1.5 w-full resize-none rounded-xl border-2 border-brand-100 bg-brand-50/40 px-3 py-2 text-sm font-medium leading-relaxed text-slate-700 outline-none focus:border-brand-400" />
        </label>}
        {outcome && <button type="button" onClick={submit} disabled={pending} className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-black text-white disabled:bg-slate-300" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{isEnglish ? "Save follow-up" : "Simpan tindak lanjut"}</button>}
        {notificationStatus === "default" && <button type="button" onClick={allowNotifications} className="mt-3 ml-2 inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-brand-200 bg-white px-3 text-xs font-black text-brand-700"><Bell className="h-4 w-4" />{isEnglish ? "Allow notifications" : "Izinkan notifikasi"}</button>}
        {notificationStatus === "granted" && <p className="mt-3 text-[11px] font-black text-brand-700">{isEnglish ? "Browser notifications are on" : "Notifikasi browser aktif"}</p>}
      </>}

      {recentCheckins.length > 0 && <div className="mt-4 border-t border-brand-100 pt-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isEnglish ? "Follow-up history" : "Riwayat tindak lanjut"}</p>
        <div className="mt-2 space-y-2">{recentCheckins.map((checkin, index) => <div key={`${checkin.created_at ?? "entry"}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"><span className={`font-black ${checkin.outcome === "done" ? "text-brand-700" : "text-slate-600"}`}>{checkin.outcome === "done" ? (isEnglish ? "Treatment tried" : "Treatment sudah dicoba") : (isEnglish ? "Not done yet" : "Belum dilakukan")}</span>{checkin.reflection && <span className="font-medium"> — {checkin.reflection}</span>}</div>)}</div>
      </div>}
      {error && <p role="alert" className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
    </section>
  );
}
