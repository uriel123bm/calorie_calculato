import { useMemo } from "react";
import type { DailyTrackerState, DayLog } from "../types";

interface Props {
  today: DailyTrackerState;
  history: DayLog[];
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function InsightsCard({ today, history }: Props) {
  const insights = useMemo(() => {
    const allDays = [
      { date: today.date, entries: today.entries, targetCalories: today.targetCalories },
      ...history,
    ].filter((d) => d.entries.length > 0);

    if (allDays.length < 3) return null;

    const last7 = allDays.filter((d) => {
      const diff = (new Date(today.date).getTime() - new Date(d.date).getTime()) / 86400000;
      return diff < 7;
    });
    const last30 = allDays.filter((d) => {
      const diff = (new Date(today.date).getTime() - new Date(d.date).getTime()) / 86400000;
      return diff < 30;
    });

    const avg7 = last7.length
      ? Math.round(last7.reduce((s, d) => s + d.entries.reduce((a, e) => a + e.calories, 0), 0) / last7.length)
      : null;

    const avg30 = last30.length >= 7
      ? Math.round(last30.reduce((s, d) => s + d.entries.reduce((a, e) => a + e.calories, 0), 0) / last30.length)
      : null;

    // Best protein day in last 7
    let bestProteinDay: { date: string; protein: number } | null = null;
    for (const d of last7) {
      const p = Math.round(d.entries.reduce((s, e) => s + e.protein, 0));
      if (!bestProteinDay || p > bestProteinDay.protein) {
        bestProteinDay = { date: d.date, protein: p };
      }
    }

    // Consistency: % of last 7 calendar days with entries
    const loggedDates = new Set(last7.map((d) => d.date));
    const consistency7 = Math.round((loggedDates.size / 7) * 100);

    // Best day of week
    const dayTotals: Record<number, number[]> = {};
    for (const d of last30) {
      const dow = new Date(d.date).getDay();
      const cal = d.entries.reduce((s, e) => s + e.calories, 0);
      if (!dayTotals[dow]) dayTotals[dow] = [];
      dayTotals[dow].push(cal);
    }
    let lowestDow: number | null = null;
    let lowestAvg = Infinity;
    for (const [dow, cals] of Object.entries(dayTotals)) {
      if (cals.length >= 2) {
        const avg = cals.reduce((s, c) => s + c, 0) / cals.length;
        if (avg < lowestAvg) {
          lowestAvg = avg;
          lowestDow = Number(dow);
        }
      }
    }

    return { avg7, avg30, consistency7, bestProteinDay, lowestDow };
  }, [today, history]);

  if (!insights) return null;

  const { avg7, avg30, consistency7, bestProteinDay, lowestDow } = insights;

  return (
    <div className="section insights-card">
      <h2>
        <span className="material-symbols-outlined">insights</span>
        תובנות
      </h2>
      <div className="insights-grid">
        {avg7 !== null && (
          <div className="insight-tile">
            <span className="material-symbols-outlined insight-icon">bar_chart</span>
            <span className="insight-label">ממוצע שבועי</span>
            <span className="insight-value">{avg7.toLocaleString()}</span>
            <span className="insight-unit">קלוריות/יום</span>
            {avg30 !== null && avg7 !== avg30 && (
              <span className={`insight-trend ${avg7 < avg30 ? "down" : "up"}`}>
                {avg7 < avg30 ? "▼" : "▲"} לעומת ממוצע חודשי ({avg30.toLocaleString()})
              </span>
            )}
          </div>
        )}

        <div className="insight-tile">
          <span className="material-symbols-outlined insight-icon">local_fire_department</span>
          <span className="insight-label">עקביות שבועית</span>
          <span className="insight-value">{consistency7}%</span>
          <span className="insight-unit">מ-7 הימים האחרונים</span>
          <div className="insight-bar-wrap">
            <div className="insight-bar-fill" style={{ width: `${consistency7}%` }} />
          </div>
        </div>

        {bestProteinDay && bestProteinDay.protein > 0 && (
          <div className="insight-tile">
            <span className="material-symbols-outlined insight-icon">egg</span>
            <span className="insight-label">יום חלבון מוביל</span>
            <span className="insight-value">{bestProteinDay.protein} גרם</span>
            <span className="insight-unit">
              {new Date(bestProteinDay.date).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
        )}

        {lowestDow !== null && (
          <div className="insight-tile">
            <span className="material-symbols-outlined insight-icon">sentiment_satisfied</span>
            <span className="insight-label">יום קל בשבוע</span>
            <span className="insight-value">{DAY_NAMES[lowestDow]}</span>
            <span className="insight-unit">צריכה נמוכה בממוצע</span>
          </div>
        )}
      </div>
    </div>
  );
}
