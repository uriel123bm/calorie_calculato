import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { Result } from "@zxing/library";
import { fetchOpenFoodFactsByBarcode } from "../services/openFoodFacts";
import type { ProductFormDraft } from "../services/productFormDraft";
import {
  cameraUnavailableMessage,
  isCameraApiAvailable,
} from "../utils/cameraEligibility";
import { OfflineError } from "../utils/network";

interface Props {
  open: boolean;
  onClose: () => void;
  /** לאחר זיהוי ברקוד + משיכת נתונים מהמאגר — מילוי טופס המוצר */
  onApplyDraft: (draft: ProductFormDraft) => void;
}

/**
 * זרימה: מצלמה מזהה ברקוד → חיפוש לפי ברקוד (Open Food Facts) → טיוטה בשדות.
 * HTTPS נדרש בנייד על כתובת IP (Secure Context). הקלדה ידנית כגיבוי.
 */
export function ProductCaptureModal({ open, onClose, onApplyDraft }: Props) {
  const [hint, setHint] = useState("");
  const [fetchBusy, setFetchBusy] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [manualBarcode, setManualBarcode] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const stoppedAfterDecodeRef = useRef(false);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);

  const cameraOk = isCameraApiAvailable();
  const cameraBlockedText = cameraOk ? "" : cameraUnavailableMessage();

  const handleBarcodeLookup = useCallback(
    async (rawCode: string) => {
      const code = rawCode.replace(/\D/g, "");
      if (code.length < 8) {
        setHint("קוד צריך לכלול לפחות 8 ספרות.");
        stoppedAfterDecodeRef.current = false;
        setScanKey((k) => k + 1);
        return;
      }
      setFetchBusy(true);
      setHint("מושך ערכים תזונתיים לפי הברקוד…");
      try {
        if (!navigator.onLine) throw new OfflineError();
        const { draft } = await fetchOpenFoodFactsByBarcode(code);
        onApplyDraft(draft);
        setManualBarcode("");
        setHint("");
        onClose();
      } catch (e) {
        const msg =
          e instanceof OfflineError
            ? e.message
            : e instanceof Error
              ? e.message
              : "לא ניתן לטעון את המוצר.";
        setHint(msg);
        stoppedAfterDecodeRef.current = false;
        setScanKey((k) => k + 1);
      } finally {
        setFetchBusy(false);
      }
    },
    [onApplyDraft, onClose]
  );

  useEffect(() => {
    if (!open) {
      setHint("");
      setFetchBusy(false);
      setManualBarcode("");
      stoppedAfterDecodeRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !cameraOk) return;

    scannerControlsRef.current = null;
    let cancelled = false;

    const reader = new BrowserMultiFormatReader();

    const startScan = async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      if (cancelled) return;

      const videoEl = videoRef.current;
      if (!videoEl) {
        if (!cancelled) {
          setHint("המצלמה לא מוכנה — הקלידו ברקוד למטה.");
        }
        return;
      }

      const onDecode = (
        result: Result | undefined,
        _err: unknown,
        controls: { stop: () => void }
      ) => {
        if (cancelled || stoppedAfterDecodeRef.current || !result) return;
        stoppedAfterDecodeRef.current = true;
        try {
          controls.stop();
        } catch {
          /* ignore */
        }
        void handleBarcodeLookup(result.getText());
      };

      try {
        const c = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoEl,
          onDecode
        );
        scannerControlsRef.current = c;
        if (cancelled) c.stop();
      } catch {
        try {
          const c = await reader.decodeFromVideoDevice(
            undefined,
            videoEl,
            onDecode
          );
          scannerControlsRef.current = c;
          if (cancelled) c.stop();
        } catch (e) {
          if (!cancelled) {
            setHint(
              e instanceof Error
                ? `${e.message} — אפשר להקליד ברקוד למטה.`
                : "לא ניתן להפעיל מצלמה. הקלידו ברקוד ידנית."
            );
          }
        }
      }
    };

    void startScan();

    return () => {
      cancelled = true;
      try {
        scannerControlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      scannerControlsRef.current = null;
    };
  }, [open, scanKey, handleBarcodeLookup, cameraOk]);

  if (!open) return null;

  return (
    <div
      className="onboarding-overlay product-scan-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-scan-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="onboarding-card product-scan-card" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-head">
          <h3 id="product-scan-title" className="product-scan-title">
            סריקת ברקוד
          </h3>
          <button
            type="button"
            className="ghost onboarding-close"
            onClick={onClose}
            aria-label="סגור"
          >
            סגור
          </button>
        </div>

        <p className="onboarding-text product-scan-intro">
          לאחר זיהוי הברקוד במצלמה, הנתונים נמשכים מהמאגר וממלאים את השדות בטופס (יש לאמת מול האריזה).
          דורש חיבור לאינטרנט. בסמרטפון מומלץ להיכנס לכתובת <strong>https</strong> של השרת (לא http על IP ברשת).
        </p>
        <p className="product-scan-attribution">
          נתונים לפי ברקוד מ־{" "}
          <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">
            Open Food Facts
          </a>
          .
        </p>

        <div className="product-scan-panel" role="region" aria-label="סורק ברקוד">
          {cameraOk ? (
            <video
              key={scanKey}
              ref={videoRef}
              className="product-scan-video"
              muted
              playsInline
              autoPlay
              aria-label="תצוגת מצלמה לסריקת ברקוד"
            />
          ) : (
            <div className="product-scan-camera-blocked" role="status">
              <span className="material-symbols-outlined product-scan-camera-blocked-icon" aria-hidden="true">
                videocam_off
              </span>
              <p className="product-scan-camera-blocked-text">{cameraBlockedText}</p>
            </div>
          )}
          <p className="product-scan-status" aria-live="polite">
            {fetchBusy
              ? "טוען מהמאגר…"
              : cameraOk
                ? "כוונו את הברקוד אל המסך — הנתונים יתעדכנו אוטומטית לפי הקוד."
                : "מצלמה לא פעילה — הקלידו ברקוד למטה."}
          </p>

          <div className="product-scan-manual-bc">
            <label htmlFor="product-manual-barcode" className="product-scan-manual-label">
              {cameraOk ? "גיבוי: הקלדת ברקוד (בלי מצלמה)" : "הקלדת ברקוד"}
            </label>
            <div className="product-scan-manual-row">
              <input
                id="product-manual-barcode"
                className="product-scan-manual-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="למשל 7290001234567"
                value={manualBarcode}
                disabled={fetchBusy}
                onChange={(e) => setManualBarcode(e.target.value.replace(/[^\d]/g, ""))}
                aria-label="הקלדת ברקוד ידנית"
              />
              <button
                type="button"
                className="primary product-scan-manual-btn"
                disabled={fetchBusy || manualBarcode.replace(/\D/g, "").length < 8}
                onClick={() => void handleBarcodeLookup(manualBarcode)}
              >
                חיפוש לפי ברקוד
              </button>
            </div>
          </div>
        </div>

        {hint && (
          <p className="product-scan-hint warn" role="status">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
