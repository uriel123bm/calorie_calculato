import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type ManualCheckState = "idle" | "checking" | "available" | "none";

function waitUntilInstalled(sw: ServiceWorker): Promise<void> {
  if (sw.state === "installed" || sw.state === "activated") return Promise.resolve();
  return new Promise((resolve) => {
    sw.addEventListener("statechange", () => {
      if (sw.state === "installed" || sw.state === "activated") resolve();
    });
  });
}

/** אחרי registration.update(): ממתינים ל-waiting או להורדת גרסה חדשה בלי לסיים מוקדם מדי. */
async function detectUpdateWaiting(registration: ServiceWorkerRegistration): Promise<boolean> {
  if (registration.waiting) return true;
  await registration.update();
  if (registration.waiting) return true;

  const installingNow = registration.installing;
  if (installingNow) {
    await waitUntilInstalled(installingNow);
    return !!registration.waiting;
  }

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const hardCap = window.setTimeout(() => finish(!!registration.waiting), 25000);
    const noNewsTimer = window.setTimeout(() => {
      window.clearTimeout(hardCap);
      finish(false);
    }, 1600);

    registration.addEventListener(
      "updatefound",
      () => {
        window.clearTimeout(noNewsTimer);
        const nw = registration.installing;
        if (!nw) {
          window.clearTimeout(hardCap);
          finish(!!registration.waiting);
          return;
        }
        void waitUntilInstalled(nw).then(() => {
          window.clearTimeout(hardCap);
          finish(!!registration.waiting);
        });
      },
      { once: true }
    );
  });
}

export function PwaUpdatePrompt() {
  const updateRegistrationRef = useRef<(() => Promise<void> | void) | null>(null);
  const needRefreshRef = useRef(false);
  const checkSeqRef = useRef(0);
  const [manualCheckState, setManualCheckState] = useState<ManualCheckState>("idle");
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      updateRegistrationRef.current = async () => {
        await registration?.update();
      };
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
      if (!("serviceWorker" in navigator)) {
        setManualCheckState("none");
        return;
      }

      const seq = ++checkSeqRef.current;
      setManualCheckState("checking");

      void (async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (seq !== checkSeqRef.current) return;
          if (!registration) {
            setManualCheckState("none");
            return;
          }

          const waiting = await detectUpdateWaiting(registration);
          if (seq !== checkSeqRef.current) return;

          setManualCheckState(waiting ? "available" : "none");
        } catch {
          if (seq !== checkSeqRef.current) return;
          setManualCheckState("none");
        }
      })();
    };

    window.addEventListener("pwa:check-update", handleManualCheck);
    return () => {
      checkSeqRef.current += 1;
      window.removeEventListener("pwa:check-update", handleManualCheck);
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
