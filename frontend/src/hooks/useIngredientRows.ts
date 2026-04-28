import { useCallback, useMemo, useRef, useState } from "react";
import { analyzeIngredient } from "../services/api";
import {
  EMPTY_NUTRITION,
  HebrewUnit,
  IngredientRowState,
  NutritionPer100g,
  UNITS,
} from "../types";

const FIELDS: (keyof NutritionPer100g)[] = [
  "calories",
  "protein",
  "carbohydrates",
  "sugar",
  "fat",
  "sodium",
];

const PLACEHOLDERS = [
  "פתיבר",
  "ביצה L",
  "קמח",
  "סוכר",
  "שמן זית",
  "חלב",
  "קקאו",
  "אגוזים",
  "תפוח",
  "בננה",
  "אורז",
  "שקדים",
  "דבש",
  "יוגורט",
  "טונה",
  "גזר",
  "שום",
  "בצל",
  "עגבנייה",
  "חמאה",
  "שוקולד",
  "פסטה",
  "עדשים",
  "ביצה M",
  "גביע יוגורט",
  "פרוסת לחם",
  "קופסת טונה",
  "פרכיות",
  "בורגול",
  "חזה עוף",
  "סלמון",
];

function makeRowId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function pickPlaceholder(): string {
  return PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)];
}

export function newRow(): IngredientRowState {
  return {
    id: makeRowId(),
    name: "",
    quantity: "",
    unit: UNITS[0],
    nutritionPer100g: { ...EMPTY_NUTRITION },
    quantityInGrams: 0,
    nutritionForQuantity: { ...EMPTY_NUTRITION },
    confidence: 0,
    source: null,
    matchedName: null,
    status: "idle",
    showEditor: false,
    manualEdit: false,
    placeholder: pickPlaceholder(),
  };
}

export function gramsFromUnit(
  quantity: number,
  unit: HebrewUnit,
  unitWeightG?: number
): number {
  switch (unit) {
    case "גרם":
    case 'מ"ל':
      return quantity;
    case "כף":
      return quantity * 15;
    case "כפית":
      return quantity * 5;
    case "כוס":
      return quantity * 240;
    case "יחידה":
      return quantity * (unitWeightG && unitWeightG > 0 ? unitWeightG : 100);
  }
}

export function scaleNutrition(
  per100g: NutritionPer100g,
  grams: number
): NutritionPer100g {
  if (grams <= 0) return { ...EMPTY_NUTRITION };
  const factor = grams / 100;
  return FIELDS.reduce((acc, key) => {
    acc[key] = per100g[key] * factor;
    return acc;
  }, {} as NutritionPer100g);
}

export function sumNutrition(items: NutritionPer100g[]): NutritionPer100g {
  return items.reduce((acc, item) => {
    FIELDS.forEach((k) => {
      acc[k] += item[k];
    });
    return acc;
  }, { ...EMPTY_NUTRITION });
}

function computeRowDerived(row: IngredientRowState): IngredientRowState {
  const qty = typeof row.quantity === "number" ? row.quantity : 0;
  const grams = qty > 0 ? gramsFromUnit(qty, row.unit, row.unitWeightG) : 0;
  return {
    ...row,
    quantityInGrams: grams,
    nutritionForQuantity: scaleNutrition(row.nutritionPer100g, grams),
  };
}

export interface UseIngredientRowsResult {
  rows: IngredientRowState[];
  patchRow: (id: string, patch: Partial<IngredientRowState>) => void;
  addRow: () => void;
  removeRow: (id: string) => void;
  analyzeRow: (id: string) => Promise<void>;
  handleNutritionEdit: (id: string, next: NutritionPer100g) => void;
  reset: (count?: number) => void;
  totalGrams: number;
  total: NutritionPer100g;
  per100g: NutritionPer100g;
}

export function useIngredientRows(initialCount: number = 4): UseIngredientRowsResult {
  const [rows, setRows] = useState<IngredientRowState[]>(() =>
    Array.from({ length: initialCount }, () => newRow())
  );

  const patchRow = useCallback(
    (id: string, patch: Partial<IngredientRowState>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? computeRowDerived({ ...r, ...patch }) : r))
      );
    },
    []
  );

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, newRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }, []);

  const handleNutritionEdit = useCallback(
    (id: string, next: NutritionPer100g) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated: IngredientRowState = {
            ...r,
            nutritionPer100g: next,
            manualEdit: true,
            source: r.source ?? "manual",
            status: r.status === "idle" ? "ready" : r.status,
          };
          return computeRowDerived(updated);
        })
      );
    },
    []
  );

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const analyzeRow = useCallback(
    async (id: string) => {
      const target = rowsRef.current.find((r) => r.id === id);
      if (!target) return;
      const qty = Number(target.quantity);
      if (!target.name.trim() || !qty || qty <= 0) return;

      patchRow(id, { status: "loading", error: undefined });

      try {
        const res = await analyzeIngredient({
          ingredient_name: target.name.trim(),
          quantity: qty,
          unit: target.unit,
        });
        const inferredUnitG =
          res.unit_weight_g != null && res.unit_weight_g > 0
            ? res.unit_weight_g
            : target.unit === "יחידה" && qty > 0 && res.quantity_in_grams > 0
              ? res.quantity_in_grams / qty
              : undefined;
        patchRow(id, {
          nutritionPer100g: res.nutrition_per_100g,
          nutritionForQuantity: res.nutrition_for_quantity,
          quantityInGrams: res.quantity_in_grams,
          unitWeightG: inferredUnitG,
          confidence: res.confidence,
          source: res.source,
          matchedName: res.matched_name,
          status: "ready",
          manualEdit: false,
        });
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "שגיאה בזיהוי המצרך";
        patchRow(id, { status: "error", error: message });
      }
    },
    [patchRow]
  );

  const { totalGrams, total, per100g } = useMemo(() => {
    const totalGrams = rows.reduce((acc, r) => acc + r.quantityInGrams, 0);
    const total = sumNutrition(rows.map((r) => r.nutritionForQuantity));
    const per100g =
      totalGrams > 0
        ? FIELDS.reduce((acc, k) => {
            acc[k] = (total[k] * 100) / totalGrams;
            return acc;
          }, {} as NutritionPer100g)
        : { ...EMPTY_NUTRITION };
    return { totalGrams, total, per100g };
  }, [rows]);

  const reset = useCallback(
    (count: number = initialCount) => {
      setRows(Array.from({ length: count }, () => newRow()));
    },
    [initialCount]
  );

  return {
    rows,
    patchRow,
    addRow,
    removeRow,
    analyzeRow,
    handleNutritionEdit,
    reset,
    totalGrams,
    total,
    per100g,
  };
}
