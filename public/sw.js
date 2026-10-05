/*
 * public/sw.js
 *
 * Minimal service worker. Its only jobs are:
 *   1. Let pages show system notifications on Android Chrome, where
 *      `new Notification()` is not allowed and only
 *      ServiceWorkerRegistration.showNotification() works (see lib/notify.ts).
 *   2. Open/focus the app when a notification is tapped.
 *   3. Display Web Push messages if/when server push is added later.
 *
 * Deliberately NO fetch handler and NO caching: the app is redeployed often and
 * a caching worker would serve stale JS to teachers after a release.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only ever navigate within our own origin.
  const requested = (event.notification.data && event.notification.data.url) || "/";
  const target = new URL(requested, self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin + "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => {
            if ("navigate" in focused) return focused.navigate(target.href).catch(() => undefined);
          });
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

// Reserved for server-sent Web Push (not wired up yet). Harmless when unused.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "CDS", {
      body: payload.body || "",
      icon: payload.icon || "/icon.png",
      tag: payload.tag,
      data: { url: payload.url || "/" },
    }),
  );
});
