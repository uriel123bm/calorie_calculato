/** טיוטת מילוי לטופס "הוספת מוצר" (ברקוד / OCR) — המשתמש מאמת לפני שמירה */

export interface Per100gNutrition {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}

export interface ProductFormDraft {
  name: string;
  unitDescription?: string;
  servingsCount: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  /** ערכים תזונתיים לכל 100 גרם — לשימוש במחשבון כמות לפני הוספה לספרייה */
  per100g?: Per100gNutrition;
  /** משקל האריזה בגרמים (מוצע כברירת מחדל במחשבון הכמות) */
  packageGrams?: number;
}
