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
import type { DailyEntryInput } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** לאחר זיהוי ברקוד + משיכת נתונים מהמאגר — מילוי טופס המוצר */
  onApplyDraft: (draft: ProductFormDraft) => void;
  /** הוספה ישירה ליומן היומי ללא שמירה בספרייה */
  onAddToDaily?: (input: DailyEntryInput) => void;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * זרימה: מצלמה מזהה ברקוד → חיפוש לפי ברקוד (Open Food Facts) →
 * תצוגת ערכים + מחשבון כמות → אישור → מילוי טופס המוצר.
 * HTTPS נדרש בנייד על כתובת IP (Secure Context). הקלדה ידנית כגיבוי.
 */
export function ProductCaptureModal({ open, onClose, onApplyDraft, onAddToDaily }: Props) {
  const [hint, setHint] = useState("");
  const [fetchBusy, setFetchBusy] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [manualBarcode, setManualBarcode] = useState("");
  const [pendingDraft, setPendingDraft] = useState<ProductFormDraft | null>(null);
  const [previewGrams, setPreviewGrams] = useState<number | "">(100);

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
        setManualBarcode("");
        setHint("");
        if (draft.per100g) {
          const defaultGrams = draft.packageGrams ?? 100;
          setPreviewGrams(defaultGrams);
          setPendingDraft(draft);
        } else {
          onApplyDraft(draft);
          onClose();
        }
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

  const confirmPreview = useCallback(() => {
    if (!pendingDraft) return;
    const grams = typeof previewGrams === "number" && previewGrams > 0 ? previewGrams : 100;
    const p100 = pendingDraft.per100g;

    if (p100) {
      const f = grams / 100;
      const scaled: ProductFormDraft = {
        ...pendingDraft,
        unitDescription: `${grams} גרם`,
        servingsCount: 1,
        calories: Math.round(p100.calories * f),
        protein: round1(p100.protein * f),
        carbohydrates: round1(p100.carbohydrates * f),
        fat: round1(p100.fat * f),
      };
      onApplyDraft(scaled);
    } else {
      onApplyDraft(pendingDraft);
    }
    setPendingDraft(null);
    onClose();
  }, [pendingDraft, previewGrams, onApplyDraft, onClose]);

  useEffect(() => {
    if (!open) {
      setHint("");
      setFetchBusy(false);
      setManualBarcode("");
      setPendingDraft(null);
      setPreviewGrams(100);
      stoppedAfterDecodeRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !cameraOk || pendingDraft) return;

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
  }, [open, scanKey, handleBarcodeLookup, cameraOk, pendingDraft]);

  if (!open) return null;

  const p100 = pendingDraft?.per100g;
  const grams = typeof previewGrams === "number" && previewGrams > 0 ? previewGrams : 100;
  const scaled = p100
    ? {
        calories: Math.round(p100.calories * grams / 100),
        protein: round1(p100.protein * grams / 100),
        carbohydrates: round1(p100.carbohydrates * grams / 100),
        fat: round1(p100.fat * grams / 100),
      }
    : null;

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
            {pendingDraft ? "ערכי המוצר" : "סריקת ברקוד"}
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

        {pendingDraft && p100 ? (
          /* ── שלב תצוגה מקדימה ומחשבון כמות ── */
          <div className="barcode-preview">
            <p className="barcode-preview-name">{pendingDraft.name}</p>

            <div className="barcode-preview-amount-row">
              <label htmlFor="barcode-preview-grams" className="barcode-preview-amount-label">
                הזינו כמות:
              </label>
              <input
                id="barcode-preview-grams"
                type="number"
                className="barcode-preview-grams-input"
                min={1}
                step={1}
                value={previewGrams === "" ? "" : previewGrams}
                onChange={(e) =>
                  setPreviewGrams(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))
                }
                aria-label="כמות בגרמים"
              />
              <span className="barcode-preview-grams-unit">גרם</span>
            </div>

            <table className="barcode-preview-table" aria-label="ערכים תזונתיים">
              <thead>
                <tr>
                  <th></th>
                  <th>לכל 100 גרם</th>
                  <th>לכמות שבחרת ({grams} גרם)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>קלוריות</td>
                  <td>{p100.calories}</td>
                  <td className="barcode-preview-scaled">{scaled?.calories ?? "—"}</td>
                </tr>
                <tr>
                  <td>חלבון (גרם)</td>
                  <td>{p100.protein}</td>
                  <td className="barcode-preview-scaled">{scaled?.protein ?? "—"}</td>
                </tr>
                <tr>
                  <td>פחמימות (גרם)</td>
                  <td>{p100.carbohydrates}</td>
                  <td className="barcode-preview-scaled">{scaled?.carbohydrates ?? "—"}</td>
                </tr>
                <tr>
                  <td>שומן (גרם)</td>
                  <td>{p100.fat}</td>
                  <td className="barcode-preview-scaled">{scaled?.fat ?? "—"}</td>
                </tr>
              </tbody>
            </table>

            <p className="barcode-preview-hint">
              הערכים בעמודה הימנית יועברו לטופס — תוכלו לערוך אותם לפני השמירה.
            </p>

            <div className="barcode-preview-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setPendingDraft(null);
                  setPreviewGrams(100);
                  stoppedAfterDecodeRef.current = false;
                  setScanKey((k) => k + 1);
                }}
              >
                חזרה לסריקה
              </button>
              {onAddToDaily && p100 && (
                <button
                  type="button"
                  className="ghost"
                  disabled={typeof previewGrams !== "number" || previewGrams <= 0}
                  onClick={() => {
                    if (!scaled || !pendingDraft) return;
                    onAddToDaily({
                      name: `${pendingDraft.name} (${grams} גרם)`,
                      calories: scaled.calories,
                      protein: scaled.protein,
                      carbohydrates: scaled.carbohydrates,
                      fat: scaled.fat,
                    });
                    setPendingDraft(null);
                    onClose();
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15, verticalAlign: "middle", marginLeft: 3 }}>
                    add_circle
                  </span>
                  הוסף ישירות ליומן
                </button>
              )}
              <button
                type="button"
                className="primary"
                onClick={confirmPreview}
                disabled={typeof previewGrams !== "number" || previewGrams <= 0}
              >
                הוסף לספרייה
              </button>
            </div>
          </div>
        ) : (
          /* ── שלב סריקה רגיל ── */
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
