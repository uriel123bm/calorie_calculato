import { useMemo } from "react";
import type { UserProduct } from "../types";

interface Props {
  products: UserProduct[];
  onPick: (p: UserProduct) => void;
  /** כותרת מעל השורה */
  title?: string;
  max?: number;
}

/** פס צ'יפים למוצרים מהספרייה האישית (ברקוד או ידני) — גישה מהירה בלי לגלול רשימה. */
export function PersonalProductChips({
  products,
  onPick,
  title = "הצעות מהספרייה שלך",
  max = 18,
}: Props) {
  const sorted = useMemo(
    () => [...products].sort((a, b) => b.addedAt - a.addedAt).slice(0, max),
    [products, max]
  );
  if (sorted.length === 0) return null;

  return (
    <div className="personal-product-chips">
      <span className="personal-product-chips-label">{title}</span>
      <div className="personal-product-chips-row" role="list">
        {sorted.map((p) => (
          <button
            key={p.id}
            type="button"
            className="personal-product-chip"
            role="listitem"
            title={p.name}
            onClick={() => onPick(p)}
          >
            {p.name.length > 26 ? `${p.name.slice(0, 24)}…` : p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
