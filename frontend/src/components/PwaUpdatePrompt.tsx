import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type ManualCheckState = "idle" | "checking" | "available" | "none";

export function PwaUpdatePrompt() {
  const updateRegistrationRef = useRef<(() => Promise<void> | void) | null>(null);
  const needRefreshRef = useRef(false);
  const checkTimerRef = useRef<number | null>(null);
  const [manualCheckState, setManualCheckState] = useState<ManualCheckState>("idle");
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      updateRegistrationRef.current = () => registration?.update();
    },
  });

  useEffect(() => {
    needRefreshRef.current = needRefresh;
    if (needRefresh) {
      setManualCheckState("available");
    }
  }, [needRefresh]);

  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), 2500);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    const handleManualCheck = () => {
      if (needRefreshRef.current) {
        setManualCheckState("available");
        return;
      }
      setManualCheckState("checking");
      void updateRegistrationRef.current?.();
      if (checkTimerRef.current !== null) {
        window.clearTimeout(checkTimerRef.current);
      }
      checkTimerRef.current = window.setTimeout(() => {
        setManualCheckState(needRefreshRef.current ? "available" : "none");
        checkTimerRef.current = null;
      }, 1400);
    };
    window.addEventListener("pwa:check-update", handleManualCheck);
    return () => window.removeEventListener("pwa:check-update", handleManualCheck);
  }, []);

  useEffect(() => {
    return () => {
      if (checkTimerRef.current !== null) {
        window.clearTimeout(checkTimerRef.current);
      }
    };
  }, []);

  const show =
    needRefresh || offlineReady || manualCheckState === "checking" || manualCheckState === "none";
  if (!show) return null;

  const showAvailable = needRefresh || manualCheckState === "available";
  const checking = manualCheckState === "checking";
  const noUpdates = manualCheckState === "none";

  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <div className="pwa-toast-text">
        {checking
          ? "בודק עדכונים..."
          : showAvailable
            ? "כן, קיימים עדכונים נוספים"
            : noUpdates
              ? "לא קיימים עדכונים נוספים"
              : "האפליקציה זמינה גם אופליין"}
      </div>
      <div className="pwa-toast-actions">
        {showAvailable ? (
          <button
            type="button"
            className="primary pill"
            onClick={() => {
              setManualCheckState("idle");
              void updateServiceWorker(true);
            }}
          >
            עדכן עכשיו
          </button>
        ) : checking ? (
          <button type="button" className="ghost pill" disabled>
            בודק...
          </button>
        ) : (
          <button
            type="button"
            className="ghost pill"
            onClick={() => {
              setOfflineReady(false);
              setManualCheckState("idle");
            }}
          >
            {noUpdates ? "סגור" : "הבנתי"}
          </button>
        )}
        {showAvailable && (
          <button
            type="button"
            className="ghost pill"
            onClick={() => setManualCheckState("idle")}
          >
            מאוחר יותר
          </button>
        )}
      </div>
    </div>
  );
}
