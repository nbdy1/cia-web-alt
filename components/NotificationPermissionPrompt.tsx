"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { useSettings } from "@/lib/context/settings-context";

const SNOOZE_KEY_PREFIX = "cia:notification-prompt-snooze:";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Browser notification consent is device-wide for the CDS domain. Ask from the
 * normal signed-in flow once, rather than requiring teachers to find a report.
 */
export function NotificationPermissionPrompt() {
  const { user, loading } = useAuth();
  const { language } = useSettings();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const isEnglish = language === "en";

  useEffect(() => {
    if (loading || !user || pathname === "/login" || pathname === "/reset-password") return;
    if (!("Notification" in window) || Notification.permission !== "default") return;

    const snoozeKey = `${SNOOZE_KEY_PREFIX}${user.id}`;
    const snoozedUntil = Number(window.localStorage.getItem(snoozeKey) ?? 0);
    if (Number.isFinite(snoozedUntil) && snoozedUntil > Date.now()) return;

    const timeout = window.setTimeout(() => setVisible(true), 650);
    return () => window.clearTimeout(timeout);
  }, [loading, pathname, user]);

  function dismiss() {
    if (user) window.localStorage.setItem(`${SNOOZE_KEY_PREFIX}${user.id}`, String(Date.now() + SNOOZE_MS));
    setVisible(false);
  }

  async function allow() {
    if (!("Notification" in window)) return;
    setRequesting(true);
    await Notification.requestPermission();
    setRequesting(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/35 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="notification-consent-title">
      <section className="w-full max-w-sm rounded-2xl border-2 border-brand-100 bg-white p-5 shadow-2xl" style={{ boxShadow: "0 5px 0 var(--brand-700)" }}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>
            <BellRing className="h-5 w-5" />
          </span>
          <button type="button" onClick={dismiss} aria-label={isEnglish ? "Not now" : "Nanti saja"} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="notification-consent-title" className="mt-4 text-lg font-black text-slate-800">
          {isEnglish ? "Keep treatment follow-ups on track" : "Jangan lewatkan tindak lanjut treatment"}
        </h2>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">
          {isEnglish
            ? "Allow CDS notifications to remind you when a treatment follow-up is due. You will still be asked to record what happened."
            : "Izinkan notifikasi CDS agar Anda diingatkan saat tindak lanjut treatment sudah jatuh tempo. Anda tetap akan diminta mencatat hasilnya."}
        </p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={dismiss} className="h-11 flex-1 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs font-black text-slate-600">
            {isEnglish ? "Not now" : "Nanti saja"}
          </button>
          <button type="button" onClick={allow} disabled={requesting} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 text-xs font-black text-white disabled:bg-slate-300" style={{ boxShadow: "0 3px 0 var(--brand-700)" }}>
            <BellRing className="h-4 w-4" />
            {requesting ? (isEnglish ? "Opening..." : "Membuka...") : (isEnglish ? "Allow" : "Izinkan")}
          </button>
        </div>
      </section>
    </div>
  );
}
