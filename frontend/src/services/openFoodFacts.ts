import type { ProductFormDraft } from "./productFormDraft";

/** נדרש ע״י Open Food Facts לזיהוי האפליקציה */
const OFF_HEADERS = {
  "User-Agent": "CalorieCalculator-Web/1.0 (personal calorie tracker; no commercial use)",
  Accept: "application/json",
};

export interface OpenFoodFactsLookupMeta {
  barcode: string;
  countries?: string;
}

interface OffNutriments {
  [key: string]: unknown;
}

interface OffProductDoc {
  product_name?: string;
  product_name_he?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
}

interface OffApiResponse {
  status: number;
  status_verbose?: string;
  product?: OffProductDoc;
}

function num(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v;
}

function pickName(p: OffProductDoc): string {
  const raw =
    (p.product_name_he || "").trim() ||
    (p.product_name || "").trim() ||
    (p.generic_name || "").trim() ||
    (p.product_name_en || "").trim();
  if (raw) return raw;
  const b = (p.brands || "").trim();
  return b ? `מוצר (${b})` : "מוצר מהמאגר";
}

/** מנסה לחלץ משקל אריזה בגרם (או מ״ל המתורגם כמילוי גס לנוזלים) */
export function parsePackagingGramsHint(quantity?: string, serving?: string): number | null {
  for (const s of [quantity, serving]) {
    if (!s) continue;
    const m = s.match(/(\d+[.,]?\d*)\s*(g|גרם|grams?|ml|מ["״]?ל|mL)/i);
    if (!m) continue;
    const val = parseFloat(m[1].replace(",", "."));
    if (Number.isFinite(val) && val > 0) return val;
  }
  return null;
}

function kcalPer100g(n: OffNutriments): number {
  const k = num(n["energy-kcal_100g"]);
  if (k > 0) return k;
  const kj = num(n["energy-kj_100g"]);
  if (kj > 0) return kj / 4.184;
  return 0;
}

function macrosPer100g(n: OffNutriments): {
  protein: number;
  carbohydrates: number;
  fat: number;
} {
  return {
    protein: num(n["proteins_100g"]),
    carbohydrates: num(n["carbohydrates_100g"]),
    fat: num(n["fat_100g"]),
  };
}

/** כשאין per-100g — ניסיון לפי מנה מהמאגר */
function draftFromServing(n: OffNutriments, name: string): ProductFormDraft | null {
  const kcal = num(n["energy-kcal_serving"]);
  if (kcal <= 0) return null;
  return {
    name,
    unitDescription: "לפי מנה במאגר Open Food Facts — יש להשוות לאריזה",
    servingsCount: 1,
    calories: Math.round(kcal),
    protein: num(n["proteins_serving"]),
    carbohydrates: num(n["carbohydrates_serving"]),
    fat: num(n["fat_serving"]),
  };
}

export function mapOpenFoodFactsToDraft(product: OffProductDoc, barcode: string): ProductFormDraft {
  const name = pickName(product);
  const n = product.nutriments ?? {};
  const packG = parsePackagingGramsHint(product.quantity, product.serving_size);

  const k100 = kcalPer100g(n);
  const m100 = macrosPer100g(n);

  const per100g = k100 > 0
    ? {
        calories: Math.round(k100 * 10) / 10,
        protein: Math.round(m100.protein * 10) / 10,
        carbohydrates: Math.round(m100.carbohydrates * 10) / 10,
        fat: Math.round(m100.fat * 10) / 10,
      }
    : undefined;

  if (k100 > 0 && packG && packG > 0) {
    const f = packG / 100;
    return {
      name,
      unitDescription:
        (product.quantity || "").trim() ||
        `${Math.round(packG)} גרם (הוערך מהמאגר)`,
      servingsCount: 1,
      calories: Math.round(k100 * f),
      protein: Math.round(m100.protein * f * 10) / 10,
      carbohydrates: Math.round(m100.carbohydrates * f * 10) / 10,
      fat: Math.round(m100.fat * f * 10) / 10,
      per100g,
      packageGrams: Math.round(packG),
    };
  }

  if (k100 > 0) {
    return {
      name,
      unitDescription:
        "ערכים לפי 100 גרם מהמאגר — אם האריזה אחרת, התאימו את הסכומים",
      servingsCount: 1,
      calories: Math.round(k100),
      protein: Math.round(m100.protein * 10) / 10,
      carbohydrates: Math.round(m100.carbohydrates * 10) / 10,
      fat: Math.round(m100.fat * 10) / 10,
      per100g,
    };
  }

  const servingDraft = draftFromServing(n, name);
  if (servingDraft) return servingDraft;

  return {
    name: `${name} (${barcode})`,
    unitDescription: "לא נמצאו ערכי תזונה במאגר — מלאו ידנית",
    servingsCount: 1,
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
  };
}

const OFF_BASES = [
  "https://world.openfoodfacts.org",
  "https://il.openfoodfacts.org",
];

export async function fetchOpenFoodFactsByBarcode(
  barcode: string
): Promise<{ draft: ProductFormDraft; meta: OpenFoodFactsLookupMeta }> {
  const clean = barcode.replace(/\D/g, "");
  if (clean.length < 8 || clean.length > 14) {
    throw new Error("קוד ברקוד לא תקין.");
  }

  let lastErr: unknown;
  for (const base of OFF_BASES) {
    const url = `${base}/api/v2/product/${encodeURIComponent(clean)}.json`;
    const ac = new AbortController();
    const timeoutMs = 20000;
    const timer = window.setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: OFF_HEADERS,
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as OffApiResponse;
      if (data.status !== 1 || !data.product) continue;
      const draft = mapOpenFoodFactsToDraft(data.product, clean);
      return {
        draft,
        meta: { barcode: clean },
      };
    } catch (e) {
      lastErr = e;
    } finally {
      window.clearTimeout(timer);
    }
  }

  if (lastErr instanceof Error) throw lastErr;
  throw new Error("המוצר לא נמצא במאגר. נסו ברקוד אחר או מלאו ידנית.");
}
