import { useState } from "react";
import type { ProductInput, ProductSaveResult } from "../hooks/useUserProducts";
import type { DailyEntryInput, UserProduct } from "../types";
import { scaleServingMacros } from "../utils/nutritionMath";
import { roundCalories, roundMacro } from "../utils/nutritionRounding";

interface Props {
  products: UserProduct[];
  onAddProduct: (input: ProductInput) => ProductSaveResult;
  onDeleteProduct: (id: string) => void;
  onAddToDaily: (input: DailyEntryInput) => void;
}

// ── Add-product form ──────────────────────────────────────
function AddProductForm({
  onAdd,
}: {
  onAdd: (input: ProductInput) => ProductSaveResult;
}) {
  const [name, setName]                   = useState("");
  const [unitDescription, setUnitDescription] = useState("");
  const [servingsCount, setServingsCount] = useState<number | "">(1);
  const [calories, setCalories]           = useState<number | "">("");
  const [protein, setProtein]             = useState<number | "">("");
  const [carbohydrates, setCarbohydrates] = useState<number | "">("");
  const [fat, setFat]                     = useState<number | "">("");
  const [feedback, setFeedback]           = useState<"" | "saved" | "duplicate" | "invalid">("");
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

  const reset = () => {
    setName("");
    setUnitDescription("");
    setServingsCount(1);
    setCalories("");
    setProtein("");
    setCarbohydrates("");
    setFat("");
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

  return (
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
        לדוגמה: אם הזנתם 400 קק״ל ו־2 מנות, כל יחידה תישמר כ־200 קק״ל.
      </p>
      <div className="product-unit-preview" aria-live="polite">
        <span className="product-unit-preview-title">ערכים מחושבים ליחידה אחת:</span>
        <span className="badge calories">{Math.round(perUnitPreview.calories)} קק"ל</span>
        <span className="badge protein">חלבון {perUnitPreview.protein.toFixed(1)}ג</span>
        <span className="badge carbs">פחמימה {perUnitPreview.carbohydrates.toFixed(1)}ג</span>
        <span className="badge fat">שומן {perUnitPreview.fat.toFixed(1)}ג</span>
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
              נוסף {savedDate} · יחידה 1 = {Math.round(product.calories)} קק"ל
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
        <span className="badge calories">{Math.round(product.calories)} קק"ל</span>
        {product.protein > 0 && (
          <span className="badge protein">חלבון {product.protein.toFixed(1)}ג</span>
        )}
        {product.fat > 0 && (
          <span className="badge fat">שומן {product.fat.toFixed(1)}ג</span>
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
            <span className="preview-cal">{Math.round(preview.calories)} קק"ל</span>
            {preview.protein > 0 && (
              <span className="preview-prot">חלבון {preview.protein.toFixed(1)}ג</span>
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
  products,
  onAddProduct,
  onDeleteProduct,
  onAddToDaily,
}: Props) {
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
        <AddProductForm onAdd={onAddProduct} />
      </section>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">inventory</span>
          הספרייה שלי {products.length > 0 ? `(${products.length})` : ""}
        </h2>

        {products.length === 0 ? (
          <div className="my-recipes-empty">
            <span className="material-symbols-outlined" style={{ fontSize: 44, opacity: 0.3 }}>
              inventory_2
            </span>
            <p>עדיין אין מוצרים אישיים.</p>
            <p className="hint">
              הוסיפו מעל את <strong>המוצר הראשון</strong> שלכם — הוא ישמר ויהיה זמין מכאן וגם ב<strong>ארוחות</strong>.
            </p>
          </div>
        ) : (
          <div className="my-recipes-list">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onDelete={() => onDeleteProduct(p.id)}
                onAddToDaily={onAddToDaily}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
