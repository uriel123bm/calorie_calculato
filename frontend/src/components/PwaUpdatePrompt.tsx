import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 2500);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <div className="pwa-toast-text">
        {needRefresh ? "גרסה חדשה זמינה" : "האפליקציה זמינה גם אופליין"}
      </div>
      <div className="pwa-toast-actions">
        {needRefresh ? (
          <button
            type="button"
            className="primary pill"
            onClick={() => updateServiceWorker(true)}
          >
            עדכן עכשיו
          </button>
        ) : (
          <button
            type="button"
            className="ghost pill"
            onClick={() => setOfflineReady(false)}
          >
            הבנתי
          </button>
        )}
      </div>
    </div>
  );
}
