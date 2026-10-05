/**
 * lib/notify.ts
 *
 * Safe wrapper around browser notifications. Never throws.
 *
 * Why: Chrome on Android does not allow `new Notification(...)` — the
 * constructor throws "Illegal constructor … use ServiceWorkerRegistration
 * .showNotification()" once permission is granted. Called from a React effect,
 * that uncaught TypeError unmounts the whole page (it surfaced as the
 * /students "profile" page failing for phone users who had allowed
 * notifications and had a follow-up due). A reminder notification is
 * best-effort; the in-page reminder card is the real UI, so on any failure we
 * simply skip the system notification.
 */
export function showLocalNotification(
  title: string,
  options: NotificationOptions & { onClick?: () => void } = {},
) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const { onClick, ...notificationOptions } = options;
    try {
      const notification = new Notification(title, notificationOptions);
      if (onClick) notification.onclick = onClick;
      return;
    } catch {
      // Android Chrome: the constructor is blocked. Fall through to the
      // service-worker route if (and only if) one is registered.
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.showNotification(title, notificationOptions))
        .catch(() => undefined);
    }
  } catch {
    // Notifications are optional — never let them break the page.
  }
}
