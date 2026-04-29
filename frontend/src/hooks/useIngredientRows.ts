import { useCallback, useMemo, useRef, useState } from "react";

import { analyzeIngredient } from "../services/api";

import {

  aggregatePer100g,

  gramsFromUnit,

  NUTRITION_FIELDS,

  scaleNutrition,

  sumNutrition,

} from "../utils/nutritionMath";

import {

  EMPTY_NUTRITION,

  IngredientRowState,

  NutritionPer100g,

  UNITS,

} from "../types";



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



/**

 * Re-derives quantity-dependent fields (`quantityInGrams`, `nutritionForQuantity`)

 * from the row's current `quantity`, `unit`, `unitWeightG` and `nutritionPer100g`.

 *

 * Robustness notes:

 *  • `row.quantity` is typed as `number | ""` but at runtime we may also

 *    receive numeric strings or NaN (after server merges, sync pulls, etc.).

 *    We coerce with `Number(...)` and validate via `Number.isFinite` so that

 *    a stray string never silently collapses to 0 — which used to cause

 *    every row to display the same nutrition values.

 *  • `nutritionPer100g` is also coerced field-by-field for the same reason.

 */

function safePer100g(values: NutritionPer100g): NutritionPer100g {

  return NUTRITION_FIELDS.reduce((acc, key) => {

    const raw = (values as unknown as Record<string, unknown>)[key];

    const num = typeof raw === "number" ? raw : Number(raw);

    acc[key] = Number.isFinite(num) && num > 0 ? num : 0;

    return acc;

  }, { ...EMPTY_NUTRITION });

}



function computeRowDerived(row: IngredientRowState): IngredientRowState {

  const rawQty = row.quantity;

  const qty =

    typeof rawQty === "number" && Number.isFinite(rawQty) && rawQty > 0

      ? rawQty

      : typeof rawQty === "string" && rawQty.trim() !== ""

        ? (() => {

            const n = Number(rawQty);

            return Number.isFinite(n) && n > 0 ? n : 0;

          })()

        : 0;



  const per100g = safePer100g(row.nutritionPer100g);

  const grams = qty > 0 ? gramsFromUnit(qty, row.unit, row.unitWeightG) : 0;



  return {

    ...row,

    nutritionPer100g: per100g,

    quantityInGrams: grams,

    nutritionForQuantity: scaleNutrition(per100g, grams),

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
  hydrateRows: (rows: IngredientRowState[]) => void;

  totalGrams: number;

  total: NutritionPer100g;

  per100g: NutritionPer100g;

}



export function useIngredientRows(initialCount: number = 4): UseIngredientRowsResult {

  const [rows, setRows] = useState<IngredientRowState[]>(() =>

    Array.from({ length: initialCount }, () => newRow())

  );



  /** Ignores stale responses when the user re-triggers analyze before the prior request finishes. */

  const analyzeEpochRef = useRef<Map<string, number>>(new Map());



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



      const epoch = (analyzeEpochRef.current.get(id) ?? 0) + 1;

      analyzeEpochRef.current.set(id, epoch);



      patchRow(id, { status: "loading", error: undefined });



      try {

        const res = await analyzeIngredient({

          ingredient_name: target.name.trim(),

          quantity: qty,

          unit: target.unit,

        });

        if (analyzeEpochRef.current.get(id) !== epoch) return;



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

        if (analyzeEpochRef.current.get(id) !== epoch) return;

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

    const per100g = aggregatePer100g(total, totalGrams);

    return { totalGrams, total, per100g };

  }, [rows]);



  const reset = useCallback(

    (count: number = initialCount) => {

      setRows(Array.from({ length: count }, () => newRow()));

    },

    [initialCount]

  );

  const hydrateRows = useCallback(
    (nextRows: IngredientRowState[]) => {
      const saneRows =
        nextRows.length > 0
          ? nextRows.map((row) =>
              computeRowDerived({
                ...newRow(),
                ...row,
                id: row.id || makeRowId(),
              })
            )
          : Array.from({ length: initialCount }, () => newRow());
      setRows(saneRows);
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
    hydrateRows,

    totalGrams,

    total,

    per100g,

  };

}


