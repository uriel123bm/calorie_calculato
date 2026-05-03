import { useMemo, useState } from "react";
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

function formatMonthTitle(d: Date): string {
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

/** יום ראשון עד שבת — תואם ל-getDay() */
const WEEKDAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

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
      <div className="jdt-item"><span className="jdt-label">חלבון</span><strong>{t.protein.toFixed(0)} גרם</strong></div>
      <div className="jdt-item"><span className="jdt-label">פחמימות</span><strong>{t.carbohydrates.toFixed(0)} גרם</strong></div>
      <div className="jdt-item"><span className="jdt-label">שומן</span><strong>{t.fat.toFixed(0)} גרם</strong></div>
    </div>
  );
}

function EntryCard({ entry, onRemove }: { entry: DailyEntry; onRemove?: () => void }) {
  const lines = entry.lines?.filter((l) => l.name.trim()) ?? [];
  const hasBreakdown = lines.length > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className={`journal-entry${hasBreakdown ? " journal-entry--expandable" : ""}`}>
      <div className="journal-entry-dot" />
      <div className="journal-entry-body">
        <div className="journal-entry-header">
          {hasBreakdown ? (
            <button
              type="button"
              className="journal-entry-name-btn"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="journal-entry-name">{entry.name}</span>
              <span className="material-symbols-outlined journal-entry-chevron" aria-hidden="true">
                {open ? "expand_less" : "expand_more"}
              </span>
            </button>
          ) : (
            <span className="journal-entry-name">{entry.name}</span>
          )}
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
            >
              ✕
            </button>
          )}
        </div>
        <div className="journal-entry-macros">
          <span className="jmacro calories">{Math.round(entry.calories)} קלוריות</span>
          {entry.protein > 0 && <span className="jmacro protein">חלבון {entry.protein.toFixed(1)} גרם</span>}
          {entry.carbohydrates > 0 && (
            <span className="jmacro carbs">פחמימות {entry.carbohydrates.toFixed(1)} גרם</span>
          )}
          {entry.fat > 0 && <span className="jmacro fat">שומן {entry.fat.toFixed(1)} גרם</span>}
        </div>
        {open && hasBreakdown && (
          <ul className="journal-entry-breakdown">
            {lines.map((line, idx) => (
              <li key={idx}>
                <span className="journal-line-name">
                  {line.detail ? `${line.name} (${line.detail})` : line.name}
                </span>
                <span>{Math.round(line.calories)} קל׳</span>
              </li>
            ))}
          </ul>
        )}
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
            {Math.round(totalCal)} / {targetCalories} קלוריות
          </span>
          {isToday && onResetDay && entries.length > 0 && (
            <button type="button" className="ghost tracker-reset-btn" onClick={onResetDay}>
              איפוס
            </button>
          )}
        </div>
      </div>

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

function resolveDayLog(
  dateStr: string,
  today: DailyTrackerState,
  history: DayLog[]
): DayLog | null {
  if (dateStr === today.date) {
    return {
      date: today.date,
      targetCalories: today.targetCalories,
      entries: today.entries,
    };
  }
  return history.find((h) => h.date === dateStr) ?? null;
}

function isoDateInMonth(year: number, month0: number, day: number): string {
  const m = String(month0 + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function JournalPage({ today, history, onRemoveEntry, onResetDay }: Props) {
  const [viewMonth, setViewMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const datesWithData = useMemo(() => {
    const set = new Set<string>();
    for (const h of history) {
      if (h.entries.length > 0) set.add(h.date);
    }
    if (today.entries.length > 0) set.add(today.date);
    return set;
  }, [history, today.date, today.entries.length]);

  const year = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  const calendarCells = useMemo(() => {
    const cells: Array<{ dateStr: string | null; inMonth: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ dateStr: null, inMonth: false });
    }
    for (let day = 1; day <= lastDay; day++) {
      cells.push({
        dateStr: isoDateInMonth(year, monthIndex, day),
        inMonth: true,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ dateStr: null, inMonth: false });
    }
    return cells;
  }, [year, monthIndex, lastDay, firstWeekday]);

  const goPrevMonth = () => {
    setViewMonth(new Date(year, monthIndex - 1, 1));
  };

  const goNextMonth = () => {
    setViewMonth(new Date(year, monthIndex + 1, 1));
  };

  const goThisMonth = () => {
    const t = new Date();
    setViewMonth(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  const selectedLog =
    selectedDate != null ? resolveDayLog(selectedDate, today, history) : null;

  const hasArchivedMeals = history.some((h) => h.entries.length > 0);

  return (
    <div className="page-container">
      <div className="page-hero">
        <span className="material-symbols-outlined page-hero-icon">menu_book</span>
        <div>
          <h2 className="page-title">יומן ארוחות</h2>
          <p className="page-subtitle">היום בפירוט — ימים קודמים בלוח השנה</p>
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

      <section className="section journal-calendar-section">
        <h2>
          <span className="material-symbols-outlined">calendar_month</span>
          לוח שנה
        </h2>
        <p className="hint journal-calendar-hint">
          ימים עם רשומות מסומנים. לחצו על יום כדי לראות מה נאכל.
        </p>

        <div className="journal-cal-nav">
          <button type="button" className="ghost journal-cal-nav-btn" onClick={goPrevMonth} aria-label="חודש קודם">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
          <div className="journal-cal-title-wrap">
            <strong className="journal-cal-title">{formatMonthTitle(viewMonth)}</strong>
            <button type="button" className="ghost journal-cal-today-link" onClick={goThisMonth}>
              חודש נוכחי
            </button>
          </div>
          <button type="button" className="ghost journal-cal-nav-btn" onClick={goNextMonth} aria-label="חודש הבא">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
        </div>

        <div className="journal-cal-weekdays" aria-hidden="true">
          {WEEKDAY_LABELS.map((l) => (
            <div key={l} className="journal-cal-weekday">
              {l}
            </div>
          ))}
        </div>

        <div className="journal-cal-grid" role="grid" aria-label="לוח שנה">
          {calendarCells.map((cell, idx) => {
            if (!cell.dateStr) {
              return <div key={`pad-${idx}`} className="journal-cal-day journal-cal-day--empty" />;
            }
            const hasData = datesWithData.has(cell.dateStr);
            const isTodayCell = cell.dateStr === today.date;
            return (
              <button
                key={cell.dateStr}
                type="button"
                className={`journal-cal-day${hasData ? " journal-cal-day--data" : ""}${isTodayCell ? " journal-cal-day--today" : ""}`}
                onClick={() => setSelectedDate(cell.dateStr)}
              >
                <span className="journal-cal-day-num">
                  {Number(cell.dateStr.slice(8, 10))}
                </span>
                {hasData && <span className="journal-cal-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {!hasArchivedMeals && (
          <p className="journal-no-history journal-calendar-empty-msg">
            אין עדיין ימים קודמים בארכיון. היסטוריה נצברת אוטומטית מדי לילה.
          </p>
        )}
      </section>

      {selectedDate && (
        <div
          className="onboarding-overlay journal-day-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="פירוט יום"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="onboarding-card journal-day-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="onboarding-head">
              <strong>
                {selectedDate === today.date ? "היום" : formatDate(selectedDate)}
              </strong>
              <button type="button" className="ghost onboarding-close" onClick={() => setSelectedDate(null)}>
                סגור
              </button>
            </div>
            {selectedLog ? (
              <div className="journal-modal-body">
                <DayBlock
                  dateStr={selectedLog.date}
                  entries={selectedLog.entries}
                  targetCalories={selectedLog.targetCalories}
                  isToday={selectedDate === today.date}
                  onRemoveEntry={
                    selectedDate === today.date ? onRemoveEntry : undefined
                  }
                  onResetDay={
                    selectedDate === today.date ? onResetDay : undefined
                  }
                />
              </div>
            ) : (
              <p className="journal-empty" style={{ margin: "12px 0 0" }}>
                אין נתונים ליום זה.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
