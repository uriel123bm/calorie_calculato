/**
 * PWAs (בעיקר מסך בית / iOS): בלי ריענון כשה-SW החדש נכנס לשליטה,
 * הקוד הישן נשאר בזיכרון — משתמשים נאלצים למחוק את האיקון.
 * התבנית המומלצת: אחרי skipWaiting — לטפל ב-controllerchange בריענון אחד.
 */
export function registerServiceWorkerLifecycle(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  let reloadScheduled = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadScheduled) return;
    reloadScheduled = true;
    window.location.reload();
  });

  const refreshRegistration = () => {
    void navigator.serviceWorker.getRegistration().then((r) => void r?.update());
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshRegistration();
  });

  window.addEventListener("pageshow", (event: PageTransitionEvent) => {
    if (event.persisted) refreshRegistration();
  });
}
