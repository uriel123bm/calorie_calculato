/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope;

// Injected by vite-plugin-pwa (injectManifest mode).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string } = {};
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title ?? "מחשבון קלוריות";
  const body  = payload.body  ?? "";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:   "/icon-192.png",
      badge:  "/icon-192.png",
      dir:    "rtl",
      lang:   "he",
      tag:    "calorie-reminder",
    })
  );
});

// ── Notification click — open / focus the app ─────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow("/");
      })
  );
});
