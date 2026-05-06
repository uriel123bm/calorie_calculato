interface Props {
  recent: string[];
  onPick: (name: string) => void;
}

/** שורת chips של מרכיבים שנחפשו לאחרונה — גישה מהירה לחיפוש חוזר. */
export function RecentIngredientChips({ recent, onPick }: Props) {
  if (recent.length === 0) return null;

  return (
    <div className="recent-ingredient-chips">
      <span className="recent-ingredient-chips-label">אחרונים:</span>
      <div className="recent-ingredient-chips-row" role="list">
        {recent.map((name) => (
          <button
            key={name}
            type="button"
            className="recent-ingredient-chip"
            role="listitem"
            title={name}
            onClick={() => onPick(name)}
          >
            {name.length > 20 ? `${name.slice(0, 18)}…` : name}
          </button>
        ))}
      </div>
    </div>
  );
}
