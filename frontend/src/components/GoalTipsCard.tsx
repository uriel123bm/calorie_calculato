import { useEffect, useMemo, useState } from "react";
import { todayStr } from "../utils/date";
import type { GoalTipsInput } from "../utils/goalTips";
import { getGoalTips } from "../utils/goalTips";

type Variant = "full" | "compact";

/** מסנכרן את מפתח היום כשעוברות חצות או כשחוזרים לטאב. */
function useCalendarDayKey(): string {
  const [dayKey, setDayKey] = useState(() => todayStr());

  useEffect(() => {
    const sync = () => {
      const next = todayStr();
      setDayKey((prev) => (next !== prev ? next : prev));
    };
    const id = window.setInterval(sync, 60_000);
    window.addEventListener("focus", sync);
    const onVis = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return dayKey;
}

function hebrewDayHeading(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function GoalTipsCard({
  input,
  variant = "full",
}: {
  input: GoalTipsInput;
  variant?: Variant;
}) {
  const dayKey = useCalendarDayKey();

  const tips = useMemo(
    () => getGoalTips(input, { dateKey: dayKey }),
    [
      dayKey,
      input.goal,
      input.currentWeightKg,
      input.goalWeightKg,
      input.heightCm,
    ]
  );

  if (!tips || tips.items.length === 0) return null;

  const dayLabel = hebrewDayHeading(dayKey);

  if (variant === "compact") {
    const line = tips.items[0];
    return (
      <div className="goal-tips-strip" role="note">
        <span className="material-symbols-outlined goal-tips-strip-icon" aria-hidden="true">
          tips_and_updates
        </span>
        <div className="goal-tips-strip-body">
          <p className="goal-tips-strip-text">{line}</p>
          {dayLabel && (
            <span className="goal-tips-strip-meta">חידוש יומי · {dayLabel}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="goal-tips-card" aria-labelledby="goal-tips-heading">
      <div className="goal-tips-card-head">
        <span className="material-symbols-outlined goal-tips-card-icon" aria-hidden="true">
          lightbulb
        </span>
        <div className="goal-tips-card-titles">
          <h2 id="goal-tips-heading" className="goal-tips-card-title">
            {tips.title}
          </h2>
          {dayLabel && (
            <p className="goal-tips-card-sub">חידוש יומי · {dayLabel}</p>
          )}
        </div>
      </div>
      <ul className="goal-tips-list">
        {tips.items.map((t, i) => (
          <li key={`${dayKey}-${i}`}>{t}</li>
        ))}
      </ul>
      <p className="goal-tips-disclaimer">
        המידע כללי בלבד ואינו מהווה ייעוץ רפואי או תזונתי מקצועי. הרשימה מתחלפת כל יום.
      </p>
    </section>
  );
}
