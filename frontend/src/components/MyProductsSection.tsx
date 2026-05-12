import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProductInput, ProductSaveResult } from "../hooks/useUserProducts";
import type { ProductFormDraft } from "../services/productFormDraft";
import { subscribeSyncRefreshed } from "../services/sync";
import type { DailyEntryInput, UserProduct } from "../types";
import { scaleServingMacros } from "../utils/nutritionMath";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";
import { ProductCaptureModal } from "./ProductCaptureModal";

interface Props {
  userId: string;
  products: UserProduct[];
  onAddProduct: (input: ProductInput) => ProductSaveResult;
  onDeleteProduct: (id: string) => void;
  onAddToDaily: (input: DailyEntryInput) => void;
}

// ── Add-product form ──────────────────────────────────────
function AddProductForm({
  userId,
  meals,
  onAdd,
  onAddToDaily,
}: {
  userId: string;
  meals: string[];
  onAdd: (input: ProductInput) => ProductSaveResult;
  onAddToDaily: (input: DailyEntryInput) => void;
}) {
  type ScanTarget = "daily" | "meal" | "library";
  const targetPrefKey = `user_${userId}:scan_target_pref:v1`;
  const [captureOpen, setCaptureOpen] = useState(false);
  const [name, setName]                   = useState("");
  const [unitDescription, setUnitDescription] = useState("");
  const [servingsCount, setServingsCount] = useState<number | "">(1);
  const [calories, setCalories]           = useState<number | "">("");
  const [protein, setProtein]             = useState<number | "">("");
  const [carbohydrates, setCarbohydrates] = useState<number | "">("");
  const [fat, setFat]                     = useState<number | "">("");
  const [feedback, setFeedback]           = useState<"" | "saved" | "duplicate" | "invalid">("");
  const [scanTarget, setScanTarget] = useState<ScanTarget>(() => {
    try {
      const raw = localStorage.getItem(targetPrefKey);
      return raw === "meal" || raw === "library" ? raw : "daily";
    } catch {
      return "daily";
    }
  });
  const [selectedMealName, setSelectedMealName] = useState<string>(() => meals[0] ?? "");
  const [scanQuantity, setScanQuantity] = useState(1);
  const portions = typeof servingsCount === "number" ? servingsCount : 0;
  const safePortions = portions > 0 ? portions : 1;
  const totalCalories = typeof calories === "number" ? calories : 0;
  const totalProtein = typeof protein === "number" ? protein : 0;
  const totalCarbs = typeof carbohydrates === "number" ? carbohydrates : 0;
  const totalFat = typeof fat === "number" ? fat : 0;
  const perUnitPreview = {
    calories: totalCalories / safePortions,
    protein: totalProtein / safePortions,
    carbohydrates: totalCarbs / safePortions,
    fat: totalFat / safePortions,
  };
  const canQuickAdd = name.trim().length > 0 && totalCalories > 0;

  useEffect(() => {
    if (!selectedMealName && meals.length > 0) {
      setSelectedMealName(meals[0]);
    }
  }, [meals, selectedMealName]);

  const reset = () => {
    setName("");
    setUnitDescription("");
    setServingsCount(1);
    setCalories("");
    setProtein("");
    setCarbohydrates("");
    setFat("");
    setScanQuantity(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const portions = typeof servingsCount === "number" ? servingsCount : 0;
    const cal = typeof calories === "number" ? calories : 0;
    if (!name.trim() || portions <= 0 || cal < 0) {
      setFeedback("invalid");
      setTimeout(() => setFeedback(""), 2500);
      return;
    }
    const perUnitFactor = 1 / portions;
    const result = onAdd({
      name: name.trim(),
      servingValue: 1,
      servingUnit: "יחידה",
      unitDescription: unitDescription.trim() || undefined,
      servingsCount: portions,
      calories: cal * perUnitFactor,
      protein:       (typeof protein       === "number" ? protein       : 0) * perUnitFactor,
      carbohydrates: (typeof carbohydrates === "number" ? carbohydrates : 0) * perUnitFactor,
      fat:           (typeof fat           === "number" ? fat           : 0) * perUnitFactor,
    });
    setFeedback(result === "saved" ? "saved" : "duplicate");
    if (result === "saved") reset();
    setTimeout(() => setFeedback(""), 2500);
  };

  const numericChange =
    (setter: (v: number | "") => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") return setter("");
      const num = Number(raw.replace(",", "."));
      if (Number.isFinite(num) && num >= 0) setter(num);
    };

  const applyDraftFromCapture = useCallback((draft: ProductFormDraft) => {
    setName((prev) => (draft.name.trim() ? draft.name.trim() : prev));
    setUnitDescription(draft.unitDescription ?? "");
    const portions =
      typeof draft.servingsCount === "number" && draft.servingsCount >= 1
        ? Math.floor(draft.servingsCount)
        : 1;
    setServingsCount(portions);
    setCalories(draft.calories > 0 ? Math.round(draft.calories) : "");
    setProtein(draft.protein > 0 ? draft.protein : "");
    setCarbohydrates(draft.carbohydrates > 0 ? draft.carbohydrates : "");
    setFat(draft.fat > 0 ? draft.fat : "");
    setScanQuantity(1);
  }, []);

  const rememberTarget = useCallback(
    (target: ScanTarget) => {
      setScanTarget(target);
      try {
        localStorage.setItem(targetPrefKey, target);
      } catch {
        /* ignore */
      }
    },
    [targetPrefKey]
  );

  const quickAddFromScan = useCallback(() => {
    if (!canQuickAdd) return;
    const productName = name.trim();
    const perUnit = {
      calories:      Math.max(0, perUnitPreview.calories)      * scanQuantity,
      protein:       Math.max(0, perUnitPreview.protein)       * scanQuantity,
      carbohydrates: Math.max(0, perUnitPreview.carbohydrates) * scanQuantity,
      fat:           Math.max(0, perUnitPreview.fat)           * scanQuantity,
    };

    if (scanTarget === "library") {
      const result = onAdd({
        name: productName,
        servingValue: 1,
        servingUnit: "יחידה",
        unitDescription: unitDescription.trim() || undefined,
        servingsCount: safePortions,
        calories: perUnitPreview.calories,
        protein: perUnitPreview.protein,
        carbohydrates: perUnitPreview.carbohydrates,
        fat: perUnitPreview.fat,
      });
      setFeedback(result === "saved" ? "saved" : "duplicate");
      if (result === "saved") reset();
      return;
    }

    const unitLabel = scanQuantity === 1 ? "1 יח׳" : `${scanQuantity} יח׳`;
    const entryName =
      scanTarget === "meal" && selectedMealName.trim()
        ? `${selectedMealName.trim()} • ${productName}`
        : `${productName} (${unitLabel})`;
    onAddToDaily({
      name: entryName,
      calories: roundCalories(perUnit.calories),
      protein: roundMacro(perUnit.protein),
      carbohydrates: roundMacro(perUnit.carbohydrates),
      fat: roundMacro(perUnit.fat),
    });
    setFeedback("saved");
    setTimeout(() => setFeedback(""), 2500);
  }, [
    canQuickAdd,
    name,
    onAdd,
    onAddToDaily,
    perUnitPreview.calories,
    perUnitPreview.carbohydrates,
    perUnitPreview.fat,
    perUnitPreview.protein,
    safePortions,
    scanQuantity,
    scanTarget,
    selectedMealName,
    unitDescription,
  ]);

  return (
    <>
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="product-form-row">
        <label className="product-form-label">
          שם המוצר
          <input
            type="text"
            placeholder="למשל: משקה חלבון אישי"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="שם המוצר"
          />
        </label>
      </div>

      <div className="product-form-row product-form-grid">
        <label className="product-form-label">
          תיאור יחידה (אופציונלי)
          <input
            type="text"
            placeholder='למשל: פחית 330 מ"ל'
            value={unitDescription}
            onChange={(e) => setUnitDescription(e.target.value)}
            aria-label="תיאור יחידה"
          />
        </label>
        <label className="product-form-label">
          כמה מנות זה כולל?
          <input
            type="number"
            min={1}
            step="1"
            value={servingsCount === "" ? "" : servingsCount}
            onChange={numericChange(setServingsCount)}
            aria-label="מספר מנות במוצר"
          />
        </label>
      </div>

      <div className="product-form-row product-form-grid product-form-grid-4">
        <label className="product-form-label">
          קלוריות
          <input
            type="number"
            min={0}
            step="1"
            placeholder="0"
            value={calories === "" ? "" : calories}
            onChange={numericChange(setCalories)}
            aria-label="קלוריות במנה"
          />
        </label>
        <label className="product-form-label">
          חלבון (ג)
          <input
            type="number"
            min={0}
            step="0.1"
            placeholder="0"
            value={protein === "" ? "" : protein}
            onChange={numericChange(setProtein)}
            aria-label="חלבון במנה"
          />
        </label>
        <label className="product-form-label">
          פחמימה (ג)
          <input
            type="number"
            min={0}
            step="0.1"
            placeholder="0"
            value={carbohydrates === "" ? "" : carbohydrates}
            onChange={numericChange(setCarbohydrates)}
            aria-label="פחמימה במנה"
          />
        </label>
        <label className="product-form-label">
          שומן (ג)
          <input
            type="number"
            min={0}
            step="0.1"
            placeholder="0"
            value={fat === "" ? "" : fat}
            onChange={numericChange(setFat)}
            aria-label="שומן במנה"
          />
        </label>
      </div>

      <p className="product-form-hint">
        הערכים שתזינו הם לכל המוצר. המערכת שומרת אוטומטית ערכים <strong>ליחידה אחת</strong>.
        לדוגמה: אם הזנתם 400 קלוריות ו־2 מנות, כל יחידה תישמר כ־200 קלוריות.
      </p>
      <div className="product-unit-preview" aria-live="polite">
        <span className="product-unit-preview-title">ערכים מחושבים ליחידה אחת:</span>
        <span className="badge calories">{Math.round(perUnitPreview.calories)} קלוריות</span>
        <span className="badge protein">חלבון {perUnitPreview.protein.toFixed(1)} גרם</span>
        <span className="badge carbs">פחמימה {perUnitPreview.carbohydrates.toFixed(1)} גרם</span>
        <span className="badge fat">שומן {perUnitPreview.fat.toFixed(1)} גרם</span>
      </div>

      <div className="product-scan-trigger-row">
        <button
          type="button"
          className="ghost product-scan-open-btn"
          onClick={() => setCaptureOpen(true)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            photo_camera
          </span>
          סריקת ברקוד מהאריזה
        </button>
      </div>

      <div className="scan-target-box">
        <span className="scan-target-title">אחרי סריקה/מילוי - לאן להוסיף?</span>
        <div className="scan-target-options">
          <label>
            <input
              type="radio"
              name="scan-target"
              checked={scanTarget === "daily"}
              onChange={() => rememberTarget("daily")}
            />
            הוסף מיד ליום
          </label>
          <label>
            <input
              type="radio"
              name="scan-target"
              checked={scanTarget === "meal"}
              onChange={() => rememberTarget("meal")}
            />
            הוסף תחת ארוחה
          </label>
          <label>
            <input
              type="radio"
              name="scan-target"
              checked={scanTarget === "library"}
              onChange={() => rememberTarget("library")}
            />
            שמור למוצרים שלי
          </label>
        </div>
        {scanTarget === "meal" && (
          <select
            className="scan-target-meal-select"
            value={selectedMealName}
            onChange={(e) => setSelectedMealName(e.target.value)}
            aria-label="בחירת ארוחה להוספה"
          >
            {meals.length === 0 ? (
              <option value="">אין ארוחות מוגדרות</option>
            ) : (
              meals.map((mealName) => (
                <option key={mealName} value={mealName}>
                  {mealName}
                </option>
              ))
            )}
          </select>
        )}
        {canQuickAdd && scanTarget !== "library" && (
          <div className="scan-quantity-row">
            <span className="scan-quantity-label">כמה יחידות אכלת?</span>
            <div className="scan-quantity-stepper">
              <button
                type="button"
                className="scan-quantity-btn"
                onClick={() => setScanQuantity((q) => Math.max(1, q - 1))}
                aria-label="הפחת יחידה"
                disabled={scanQuantity <= 1}
              >−</button>
              <span className="scan-quantity-value">{scanQuantity}</span>
              <button
                type="button"
                className="scan-quantity-btn"
                onClick={() => setScanQuantity((q) => q + 1)}
                aria-label="הוסף יחידה"
              >+</button>
            </div>
            <span className="scan-quantity-preview">
              = <strong>{Math.round(perUnitPreview.calories * scanQuantity)}</strong> קלוריות
            </span>
          </div>
        )}
        <button
          type="button"
          className="primary scan-target-action-btn"
          disabled={!canQuickAdd || (scanTarget === "meal" && !selectedMealName)}
          onClick={quickAddFromScan}
        >
          בצע פעולה מהירה
        </button>
      </div>

      <div className="product-form-actions">
        <button type="submit" className="primary">
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>
            add_circle
          </span>
          הוסף לרשימה שלי
        </button>
        {feedback === "saved" && (
          <span className="product-feedback ok">המוצר נוסף!</span>
        )}
        {feedback === "duplicate" && (
          <span className="product-feedback warn">כבר קיים מוצר בשם הזה.</span>
        )}
        {feedback === "invalid" && (
          <span className="product-feedback warn">מלאו שם, מספר מנות וקלוריות.</span>
        )}
      </div>
    </form>
    <ProductCaptureModal
      open={captureOpen}
      onClose={() => setCaptureOpen(false)}
      onApplyDraft={applyDraftFromCapture}
    />
    </>
  );
}

// ── Single product card ───────────────────────────────────
function ProductCard({
  product,
  onDelete,
  onAddToDaily,
}: {
  product: UserProduct;
  onDelete: () => void;
  onAddToDaily: (input: DailyEntryInput) => void;
}) {
  const [quantity, setQuantity] = useState<number | "">(1);
  const [added, setAdded]       = useState(false);

  const qNum = typeof quantity === "number" ? quantity : 0;
  const preview = qNum > 0 ? scaleServingMacros(product, qNum) : null;

  const handleAdd = () => {
    if (!preview || qNum <= 0) return;
    onAddToDaily({
      name: `${product.name} (${qNum} יח׳)`,
      calories:      roundCalories(preview.calories),
      protein:       roundMacro(preview.protein),
      carbohydrates: roundMacro(preview.carbohydrates),
      fat:           roundMacro(preview.fat),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const savedDate = new Date(product.addedAt).toLocaleDateString("he-IL", {
    day: "numeric", month: "short",
  });

  return (
    <div className="my-recipe-card">
      <div className="my-recipe-header">
        <div className="my-recipe-title-row">
          <span className="material-symbols-outlined my-recipe-icon">inventory_2</span>
          <div>
            <h3 className="my-recipe-name">{product.name}</h3>
            <span className="my-recipe-meta">
              נוסף {savedDate} · יחידה 1 = {Math.round(product.calories)} קלוריות
              {product.unitDescription ? ` · ${product.unitDescription}` : ""}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="row-icon-button"
          onClick={onDelete}
          title="מחק מוצר"
          aria-label={`מחק ${product.name}`}
        >✕</button>
      </div>

      <div className="my-recipe-per100">
        <span>ביחידה אחת יש:</span>
        <span className="badge calories">{Math.round(product.calories)} קלוריות</span>
        {product.protein > 0 && (
          <span className="badge protein">חלבון {product.protein.toFixed(1)} גרם</span>
        )}
        {product.fat > 0 && (
          <span className="badge fat">שומן {product.fat.toFixed(1)} גרם</span>
        )}
      </div>

      <div className="my-recipe-portion-row">
        <label className="my-recipe-portion-label">כמה יחידות אכלת?</label>
        <div className="my-recipe-portion-inputs">
          <input
            type="number"
            min={0}
            step={1}
            value={quantity === "" ? "" : quantity}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return setQuantity("");
              const num = Number(raw.replace(",", "."));
              if (Number.isFinite(num) && num >= 0) setQuantity(num);
            }}
            className="portion-input"
            aria-label="כמות יחידות"
          />
          <span className="portion-unit">יח׳</span>
        </div>

        {preview && qNum > 0 && (
          <div className="my-recipe-preview">
            <span className="preview-cal">{Math.round(preview.calories)} קלוריות</span>
            {preview.protein > 0 && (
              <span className="preview-prot">חלבון {preview.protein.toFixed(1)} גרם</span>
            )}
          </div>
        )}

        <button
          type="button"
          className={`primary${added ? " added" : ""}`}
          onClick={handleAdd}
          disabled={qNum <= 0 || added}
        >
          {added ? (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle" }}>
                check_circle
              </span> נוסף!
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>
                add_circle
              </span> הוסף ליומן
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────
export function MyProductsSection({
  userId,
  products,
  onAddProduct,
  onDeleteProduct,
  onAddToDaily,
}: Props) {
  const [libraryQuery, setLibraryQuery] = useState("");
  const readMealNames = useCallback(() => {
    try {
      const raw = localStorage.getItem(`user_${userId}:meals:v1`);
      if (!raw) return ["ארוחה כללית"];
      const parsed = JSON.parse(raw) as Array<{ name?: unknown }>;
      const names = parsed
        .map((m) => (typeof m?.name === "string" ? m.name.trim() : ""))
        .filter(Boolean);
      return names.length > 0 ? names : ["ארוחה כללית"];
    } catch {
      return ["ארוחה כללית"];
    }
  }, [userId]);
  const [mealNames, setMealNames] = useState<string[]>(() => readMealNames());

  useEffect(() => {
    setMealNames(readMealNames());
  }, [readMealNames]);

  useEffect(() => {
    const onMealsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === userId) {
        setMealNames(readMealNames());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== `user_${userId}:meals:v1`) return;
      setMealNames(readMealNames());
    };
    const unsub = subscribeSyncRefreshed((uid) => {
      if (uid === userId) setMealNames(readMealNames());
    });
    window.addEventListener("meals:updated", onMealsUpdated as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("meals:updated", onMealsUpdated as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [readMealNames, userId]);

  const filteredProducts = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, libraryQuery]);

  return (
    <div className="page-container">
      <div className="page-hero">
        <span className="material-symbols-outlined page-hero-icon">inventory_2</span>
        <div>
          <h2 className="page-title">המוצרים שלי</h2>
          <p className="page-subtitle">
            הגדירו פעם אחת ערכים תזונתיים של מוצרים שאתם צורכים — והוסיפו ליומן בלחיצה.
          </p>
        </div>
      </div>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">add_box</span>
          הוספת מוצר חדש
        </h2>
        <AddProductForm
          userId={userId}
          meals={mealNames}
          onAdd={onAddProduct}
          onAddToDaily={onAddToDaily}
        />
      </section>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">inventory</span>
          הספרייה שלי {products.length > 0 ? `(${products.length})` : ""}
        </h2>

        {products.length > 5 && (
          <div className="library-toolbar">
            <label htmlFor="my-products-filter" className="library-filter-label">
              חיפוש
            </label>
            <input
              id="my-products-filter"
              type="search"
              className="library-filter-input"
              placeholder="סינון לפי שם מוצר…"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              aria-label="סינון מוצרים לפי שם"
            />
          </div>
        )}

        {products.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined empty-state-icon">inventory_2</span>
            <p className="empty-state-title">הספרייה ריקה</p>
            <p className="empty-state-sub">הוסיפו מוצר ראשון למעלה — הוא ישמר ויהיה זמין גם בארוחות וב"הוספה מהירה"</p>
          </div>
        ) : (
          <div className="my-recipes-list">
            {filteredProducts.length === 0 ? (
              <p className="library-filter-empty">לא נמצאו מוצרים התואמים לחיפוש.</p>
            ) : (
              filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onDelete={() => onDeleteProduct(p.id)}
                  onAddToDaily={onAddToDaily}
                />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
