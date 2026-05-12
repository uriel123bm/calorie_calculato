import { FormEvent, useState } from "react";
import type { UseVitaminsResult } from "../hooks/useVitamins";
import { todayStr } from "../hooks/useDailyTracker";

const DAY_NAMES = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

interface Props {
  hook: UseVitaminsResult;
}

export function VitaminsSection({ hook }: Props) {
  const { vitamins, allTakenToday, addVitamin, removeVitamin, toggleTaken, isTaken, lastNDays } = hook;
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  const today = todayStr();
  const week  = lastNDays(7);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addVitamin(name.trim(), dose.trim() || undefined);
    setName("");
    setDose("");
    setShowAdd(false);
  };

  return (
    <div className="vitamins-section page-container" style={{ paddingTop: 0 }}>
      {/* ── Header ── */}
      <div className="vitamins-header">
        <div className="vitamins-title">
          <span className="material-symbols-outlined vitamins-icon">medication</span>
          <h3>ויטמינים ותוספים</h3>
          {vitamins.length > 0 && (
            <span className={`vitamins-badge ${allTakenToday ? "vitamins-badge--done" : "vitamins-badge--pending"}`}>
              {allTakenToday ? "✓ הכל נלקח היום" : `${vitamins.filter((v) => isTaken(v.id)).length}/${vitamins.length}`}
            </span>
          )}
        </div>
        <div className="vitamins-actions">
          {vitamins.length > 0 && (
            <button
              type="button"
              className="vitamins-btn-icon"
              onClick={() => setShowGrid((v) => !v)}
              title="מעקב שבועי"
              aria-label="מעקב שבועי"
            >
              <span className="material-symbols-outlined">calendar_view_week</span>
            </button>
          )}
          <button
            type="button"
            className="vitamins-btn-icon"
            onClick={() => setShowAdd((v) => !v)}
            title="הוסף ויטמין"
            aria-label="הוסף ויטמין"
          >
            <span className="material-symbols-outlined">{showAdd ? "close" : "add"}</span>
          </button>
        </div>
      </div>

      {/* ── Add form ── */}
      {showAdd && (
        <form className="vitamins-add-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="שם הויטמין / תוסף"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
          <input
            type="text"
            placeholder="מינון (אופציונלי)"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!name.trim()}>
            הוסף
          </button>
        </form>
      )}

      {/* ── Empty state ── */}
      {vitamins.length === 0 && !showAdd && (
        <p className="vitamins-empty">
          לחצו על <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle" }}>add</span> להוספת ויטמין או תוסף
        </p>
      )}

      {/* ── Daily checklist ── */}
      {vitamins.length > 0 && (
        <ul className="vitamins-list">
          {vitamins.map((v) => {
            const taken = isTaken(v.id, today);
            return (
              <li key={v.id} className={`vitamins-item ${taken ? "vitamins-item--taken" : ""}`}>
                <button
                  type="button"
                  className="vitamins-check"
                  onClick={() => toggleTaken(v.id)}
                  aria-label={taken ? `סמן ${v.name} כלא נלקח` : `סמן ${v.name} כנלקח`}
                  aria-pressed={taken}
                >
                  <span className="material-symbols-outlined">
                    {taken ? "check_circle" : "radio_button_unchecked"}
                  </span>
                </button>
                <span className="vitamins-name">
                  {v.name}
                  {v.dose && <span className="vitamins-dose">{v.dose}</span>}
                </span>
                <button
                  type="button"
                  className="vitamins-btn-remove"
                  onClick={() => removeVitamin(v.id)}
                  aria-label={`הסר ${v.name}`}
                  title="הסר"
                >
                  <span className="material-symbols-outlined">delete_outline</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Weekly grid ── */}
      {showGrid && vitamins.length > 0 && (
        <div className="vitamins-grid-wrap">
          <table className="vitamins-grid" aria-label="מעקב שבועי">
            <thead>
              <tr>
                <th className="vitamins-grid-name-col">ויטמין</th>
                {week.map((d) => (
                  <th key={d} className={d === today ? "vitamins-grid-today" : ""}>
                    {dayLabel(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vitamins.map((v) => (
                <tr key={v.id}>
                  <td className="vitamins-grid-name-col" title={v.dose}>
                    {v.name}
                  </td>
                  {week.map((d) => {
                    const taken = isTaken(v.id, d);
                    const isToday = d === today;
                    return (
                      <td key={d} className={isToday ? "vitamins-grid-today" : ""}>
                        <button
                          type="button"
                          className={`vitamins-grid-cell ${taken ? "vitamins-grid-cell--taken" : ""}`}
                          onClick={() => toggleTaken(v.id, d)}
                          aria-label={`${v.name} — ${d} — ${taken ? "נלקח" : "לא נלקח"}`}
                          aria-pressed={taken}
                        >
                          {taken ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
