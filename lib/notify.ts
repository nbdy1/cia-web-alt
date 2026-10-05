/**
 * lib/notify.ts
 *
 * Safe wrapper around browser notifications. Never throws.
 *
 * Android Chrome does not allow `new Notification(...)` — the constructor throws
 * "Illegal constructor … use ServiceWorkerRegistration.showNotification()". Called
 * from a React effect that uncaught TypeError used to unmount the whole page (it
 * surfaced as /students failing for phone users who had allowed notifications and
 * had a follow-up due). So we prefer the service worker (public/sw.js, registered
 * by components/ServiceWorkerRegistration.tsx), fall back to the constructor for
 * browsers without a worker, and swallow every failure: a system notification is
 * best-effort, the in-page reminder card is the real UI.
 */
export type LocalNotificationOptions = NotificationOptions & {
  /** Same-origin path opened when the notification is tapped. */
  url?: string;
};

const WORKER_WAIT_MS = 2000;

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  // `ready` never settles when no worker is registered, so cap the wait.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => window.setTimeout(resolve, WORKER_WAIT_MS)),
  ]).catch(() => undefined);
}

export async function showLocalNotification(
  title: string,
  { url = "/", ...options }: LocalNotificationOptions = {},
): Promise<void> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const registration = await getRegistration();
    if (registration) {
      await registration.showNotification(title, { ...options, data: { url } });
      return;
    }

    // No worker available: desktop-style constructor (blocked on Android, hence try/catch).
    const notification = new Notification(title, options);
    notification.onclick = () => window.focus();
  } catch {
    // Notifications are optional — never let them break the page.
  }
}
