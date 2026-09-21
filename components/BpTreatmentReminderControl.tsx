"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { saveBpTreatmentReminder } from "@/app/actions/bp-treatment-reminders";
import { useSettings } from "@/lib/context/settings-context";

const OPTIONS = [
  { days: 1, id: "Setiap hari", en: "Every day" },
  { days: 3, id: "Setiap 3 hari", en: "Every 3 days" },
  { days: 7, id: "Setiap minggu", en: "Every week" },
  { days: 14, id: "Setiap 2 minggu", en: "Every 2 weeks" },
] as const;

export function BpTreatmentReminderControl({
  reportId,
  frequencyDays,
  nextCheckAt,
  checkins = [],
}: {
  reportId: string;
  frequencyDays?: number | null;
  nextCheckAt?: string | null;
  checkins?: Array<{ outcome?: string; reflection?: string; created_at?: string }>;
}) {
  const { language } = useSettings();
  const isEnglish = language === "en";
  const [selectedDays, setSelectedDays] = useState(frequencyDays ?? 7);
  const [nextAt, setNextAt] = useState(nextCheckAt ?? null);
  const [message, setMessage] = useState("");
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | "unsupported">(
    typeof window === "undefined" || !("Notification" in window) ? "unsupported" : Notification.permission,
  );
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveBpTreatmentReminder(reportId, selectedDays);
      if (!result.success) {
        setMessage(result.error ?? (isEnglish ? "Reminder could not be saved." : "Pengingat belum dapat disimpan."));
        return;
      }
      setNextAt(result.nextCheckAt ?? null);
      setMessage(isEnglish ? "Reminder is active." : "Pengingat aktif.");
    });
  }

  async function allowNotifications() {
    if (!("Notification" in window)) return;
    setNotificationStatus(await Notification.requestPermission());
  }

  const nextLabel = nextAt
    ? new Intl.DateTimeFormat(isEnglish ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(nextAt))
    : null;
  const recentCheckins = checkins.slice(-3).reverse();

  return (
    <section className="rounded-2xl border-2 border-brand-100 bg-brand-50/70 p-5" style={{ boxShadow: "0 3px 0 #d1fae5" }}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}><Bell className="h-5 w-5" /></span>
        <div>
          <h2 className="text-sm font-black text-slate-800">{isEnglish ? "Review this support plan" : "Pantau rencana bimbingan"}</h2>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{isEnglish ? "Set a check-in so the next counselling conversation can build on what was tried." : "Atur pengecekan agar sesi bimbingan berikutnya dapat melanjutkan langkah yang sudah dicoba."}</p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-black text-slate-600">
        {isEnglish ? "Reminder frequency" : "Frekuensi pengingat"}
        <select value={selectedDays} onChange={(event) => setSelectedDays(Number(event.target.value))} className="mt-1.5 h-11 w-full rounded-xl border-2 border-brand-100 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-brand-400">
          {OPTIONS.map((option) => <option key={option.days} value={option.days}>{isEnglish ? option.en : option.id}</option>)}
        </select>
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-black text-white disabled:bg-slate-300" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {frequencyDays ? (isEnglish ? "Update reminder" : "Perbarui pengingat") : (isEnglish ? "Enable reminder" : "Aktifkan pengingat")}
        </button>
        {notificationStatus === "default" && <button type="button" onClick={allowNotifications} className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-brand-200 bg-white px-3 text-xs font-black text-brand-700"><Bell className="h-4 w-4" />{isEnglish ? "Allow notifications" : "Izinkan notifikasi"}</button>}
        {notificationStatus === "granted" && <span className="text-[11px] font-black text-brand-700">{isEnglish ? "Browser notifications are on" : "Notifikasi browser aktif"}</span>}
      </div>
      {nextLabel && <p className="mt-3 text-xs font-bold text-slate-500">{isEnglish ? "Next review:" : "Pengecekan berikutnya:"} {nextLabel}</p>}
      {message && <p role="status" className={`mt-2 text-xs font-bold ${message === "Pengingat aktif." || message === "Reminder is active." ? "text-brand-700" : "text-rose-600"}`}>{message}</p>}
      {recentCheckins.length > 0 && <div className="mt-4 border-t border-brand-100 pt-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{isEnglish ? "Recent follow-ups" : "Tindak lanjut terakhir"}</p>
        <div className="mt-2 space-y-2">
          {recentCheckins.map((checkin, index) => <div key={`${checkin.created_at ?? "checkin"}-${index}`} className="rounded-xl bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-600">
            <span className={`font-black ${checkin.outcome === "done" ? "text-brand-700" : "text-slate-600"}`}>{checkin.outcome === "done" ? (isEnglish ? "Tried" : "Sudah dicoba") : (isEnglish ? "Not yet" : "Belum sempat")}</span>
            {checkin.reflection && <span className="font-medium"> — {checkin.reflection}</span>}
          </div>)}
        </div>
      </div>}
    </section>
  );
}
