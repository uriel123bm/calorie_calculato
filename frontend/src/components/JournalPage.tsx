import type { DailyEntry, DailyTrackerState, DayLog } from "../types";

interface Props {
  today: DailyTrackerState;
  history: DayLog[];
  onRemoveEntry: (id: string) => void;
  onResetDay: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function DayTotals({ entries }: { entries: DailyEntry[] }) {
  const t = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbohydrates: acc.carbohydrates + e.carbohydrates,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbohydrates: 0, fat: 0 }
  );
  return (
    <div className="journal-day-totals">
      <div className="jdt-item"><span className="jdt-label">קלוריות</span><strong>{Math.round(t.calories)}</strong></div>
      <div className="jdt-item"><span className="jdt-label">חלבון</span><strong>{t.protein.toFixed(0)}ג</strong></div>
      <div className="jdt-item"><span className="jdt-label">פחמימות</span><strong>{t.carbohydrates.toFixed(0)}ג</strong></div>
      <div className="jdt-item"><span className="jdt-label">שומן</span><strong>{t.fat.toFixed(0)}ג</strong></div>
    </div>
  );
}

function EntryCard({ entry, onRemove }: { entry: DailyEntry; onRemove?: () => void }) {
  return (
    <div className="journal-entry">
      <div className="journal-entry-dot" />
      <div className="journal-entry-body">
        <div className="journal-entry-header">
          <span className="journal-entry-name">{entry.name}</span>
          {entry.addedAt > 0 && (
            <span className="journal-entry-time">{formatTime(entry.addedAt)}</span>
          )}
          {onRemove && (
            <button
              type="button"
              className="row-icon-button"
              onClick={onRemove}
              title="מחק"
              aria-label={`מחק ${entry.name}`}
            >✕</button>
          )}
        </div>
        <div className="journal-entry-macros">
          <span className="jmacro calories">{Math.round(entry.calories)} קק"ל</span>
          {entry.protein > 0 && <span className="jmacro protein">חלבון {entry.protein.toFixed(1)}ג</span>}
          {entry.carbohydrates > 0 && <span className="jmacro carbs">פחמימות {entry.carbohydrates.toFixed(1)}ג</span>}
          {entry.fat > 0 && <span className="jmacro fat">שומן {entry.fat.toFixed(1)}ג</span>}
        </div>
      </div>
    </div>
  );
}

function DayBlock({
  dateStr,
  entries,
  targetCalories,
  isToday,
  onRemoveEntry,
  onResetDay,
}: {
  dateStr: string;
  entries: DailyEntry[];
  targetCalories: number;
  isToday: boolean;
  onRemoveEntry?: (id: string) => void;
  onResetDay?: () => void;
}) {
  const totalCal = entries.reduce((s, e) => s + e.calories, 0);
  const pct = targetCalories > 0 ? Math.min(100, (totalCal / targetCalories) * 100) : 0;
  const over = totalCal > targetCalories;

  return (
    <div className={`journal-day-block${isToday ? " today" : ""}`}>
      <div className="journal-day-header">
        <div className="journal-day-date">
          {isToday ? (
            <><span className="today-badge">היום</span> {formatDate(dateStr)}</>
          ) : formatDate(dateStr)}
        </div>
        <div className="journal-day-right">
          <span className={`journal-day-cal${over ? " over" : ""}`}>
            {Math.round(totalCal)} / {targetCalories} קק"ל
          </span>
          {isToday && onResetDay && entries.length > 0 && (
            <button type="button" className="ghost tracker-reset-btn" onClick={onResetDay}>
              איפוס
            </button>
          )}
        </div>
      </div>

      {/* progress bar */}
      <div className="journal-day-bar">
        <div
          className={`journal-day-fill${over ? " over" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <DayTotals entries={entries} />

      {entries.length === 0 ? (
        <p className="journal-empty">אין רשומות ליום זה.</p>
      ) : (
        <div className="journal-timeline">
          {[...entries].reverse().map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onRemove={isToday && onRemoveEntry ? () => onRemoveEntry(e.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function JournalPage({ today, history, onRemoveEntry, onResetDay }: Props) {
  const todayInHistory = history.find((h) => h.date === today.date);
  const pastDays = history.filter((h) => h.date !== today.date);

  return (
    <div className="page-container">
      <div className="page-hero">
        <span className="material-symbols-outlined page-hero-icon">menu_book</span>
        <div>
          <h2 className="page-title">יומן ארוחות</h2>
          <p className="page-subtitle">מעקב אחרי כל מה שאכלת, יום אחר יום</p>
        </div>
      </div>

      <DayBlock
        dateStr={today.date}
        entries={today.entries}
        targetCalories={today.targetCalories}
        isToday={true}
        onRemoveEntry={onRemoveEntry}
        onResetDay={onResetDay}
      />

      {/* Today already in history (archived duplicate) is skipped via todayInHistory */}
      {todayInHistory === undefined && pastDays.length === 0 && (
        <div className="journal-no-history">
          <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.3 }}>history</span>
          <p>אין היסטוריה קודמת. היא תיבנה אוטומטית כל יום.</p>
        </div>
      )}

      {pastDays.map((day) => (
        <DayBlock
          key={day.date}
          dateStr={day.date}
          entries={day.entries}
          targetCalories={day.targetCalories}
          isToday={false}
        />
      ))}
    </div>
  );
}
