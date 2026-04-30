/** טיוטת מילוי לטופס "הוספת מוצר" (ברקוד / OCR) — המשתמש מאמת לפני שמירה */

export interface ProductFormDraft {
  name: string;
  unitDescription?: string;
  servingsCount: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
}
