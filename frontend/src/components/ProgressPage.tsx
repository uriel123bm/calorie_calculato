import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BodyOnboarding, UseBodyMetricsResult } from "../hooks/useBodyMetrics";
import type { BodyCircumferences, BodyMetrics, Goal, Sex } from "../types";
import { GoalTipsCard } from "./GoalTipsCard";
import { todayStr } from "../utils/date";

interface Props {
  body: UseBodyMetricsResult;
}

const SEX_OPTIONS: Array<{ id: Sex; label: string }> = [
  { id: "male",   label: "זכר" },
  { id: "female", label: "נקבה" },
  { id: "other",  label: "אחר" },
];

const GOAL_OPTIONS: Array<{ id: Goal; label: string }> = [
  { id: "lose",     label: "ירידה במשקל" },
  { id: "cut",      label: "חיטוב" },
  { id: "maintain", label: "שמירה" },
  { id: "gain",     label: "עלייה במסה" },
];

// ── Helpers ──────────────────────────────────────────────
function calcBmi(weightKg: number, heightCm: number): number | null {
  if (heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "תת-משקל";
  if (bmi < 25)   return "תקין";
  if (bmi < 30)   return "עודף משקל";
  return "השמנה";
}

function formatChartDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

// ── Onboarding form ──────────────────────────────────────
function OnboardingForm({
  onSubmit,
}: {
  onSubmit: (input: BodyOnboarding) => void;
}) {
  const [name, setName]                 = useState("");
  const [heightCm, setHeightCm]         = useState<number | "">("");
  const [startWeightKg, setStartWeight] = useState<number | "">("");
  const [age, setAge]                   = useState<number | "">("");
  const [sex, setSex]                   = useState<Sex | "">("");
  const [goal, setGoal]                 = useState<Goal | "">("");
  const [goalWeightKg, setGoalWeight]   = useState<number | "">("");
  const [error, setError]               = useState("");

  const numericChange =
    (setter: (v: number | "") => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") return setter("");
      const num = Number(raw.replace(",", "."));
      if (Number.isFinite(num) && num >= 0) setter(num);
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = typeof heightCm === "number" ? heightCm : 0;
    const w = typeof startWeightKg === "number" ? startWeightKg : 0;
    if (h < 80 || h > 260) {
      setError("גובה חייב להיות בין 80 ל-260 ס\"מ.");
      return;
    }
    if (w < 20 || w > 400) {
      setError("משקל חייב להיות בין 20 ל-400 ק\"ג.");
      return;
    }
    setError("");
    onSubmit({
      name: name.trim() || undefined,
      heightCm: h,
      startWeightKg: w,
      age:          typeof age          === "number" ? age          : undefined,
      sex:          sex || undefined,
      goal:         goal || undefined,
      goalWeightKg: typeof goalWeightKg === "number" ? goalWeightKg : undefined,
    });
  };

  return (
    <form className="onboarding-form" onSubmit={handleSubmit}>
      <p className="onboarding-intro">
        מלאו פרטים בסיסיים — נשתמש בהם רק כדי להציג לכם BMI והתקדמות לאורך זמן.
      </p>

      <div className="product-form-row">
        <label className="product-form-label">
          שם (אופציונלי)
          <input
            type="text"
            placeholder="למשל: יוסי"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>

      <div className="product-form-row product-form-grid">
        <label className="product-form-label">
          גובה (ס"מ)
          <input
            type="number"
            min={80}
            max={260}
            step="1"
            placeholder="175"
            value={heightCm === "" ? "" : heightCm}
            onChange={numericChange(setHeightCm)}
          />
        </label>
        <label className="product-form-label">
          משקל נוכחי (ק"ג)
          <input
            type="number"
            min={20}
            max={400}
            step="0.1"
            placeholder="70"
            value={startWeightKg === "" ? "" : startWeightKg}
            onChange={numericChange(setStartWeight)}
          />
        </label>
      </div>

      <div className="product-form-row product-form-grid">
        <label className="product-form-label">
          גיל (אופציונלי)
          <input
            type="number"
            min={1}
            max={120}
            step="1"
            placeholder="30"
            value={age === "" ? "" : age}
            onChange={numericChange(setAge)}
          />
        </label>
        <label className="product-form-label">
          מין (אופציונלי)
          <select value={sex} onChange={(e) => setSex(e.target.value as Sex | "")}>
            <option value="">— בחרו —</option>
            {SEX_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="product-form-row product-form-grid">
        <label className="product-form-label">
          מטרה (אופציונלי)
          <select value={goal} onChange={(e) => setGoal(e.target.value as Goal | "")}>
            <option value="">— בחרו —</option>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="product-form-label">
          משקל יעד (ק"ג, אופציונלי)
          <input
            type="number"
            min={20}
            max={400}
            step="0.1"
            placeholder="68"
            value={goalWeightKg === "" ? "" : goalWeightKg}
            onChange={numericChange(setGoalWeight)}
          />
        </label>
      </div>

      {error && <p className="product-feedback warn">{error}</p>}

      <div className="product-form-actions">
        <button type="submit" className="primary">
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>
            check_circle
          </span>
          שמור התחל מעקב
        </button>
      </div>
    </form>
  );
}

// ── Add weight form ───────────────────────────────────────
function AddWeightRow({
  onAdd,
}: {
  onAdd: (weight: number, date?: string, circumferences?: BodyCircumferences) => void;
}) {
  const [weight, setWeight] = useState<number | "">("");
  const [date, setDate]     = useState<string>(todayStr());
  const [waistCm, setWaistCm] = useState<number | "">("");
  const [hipsCm, setHipsCm] = useState<number | "">("");
  const [chestCm, setChestCm] = useState<number | "">("");
  const [feedback, setFeedback] = useState("");

  const num =
    (setter: (v: number | "") => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "") return setter("");
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n) && n >= 0) setter(n);
    };

  const handleAdd = () => {
    const w = typeof weight === "number" ? weight : 0;
    if (w <= 0) {
      setFeedback("הכניסו משקל תקין.");
      setTimeout(() => setFeedback(""), 2500);
      return;
    }
    const circumferences: BodyCircumferences = {};
    if (typeof waistCm === "number" && waistCm > 0) circumferences.waistCm = waistCm;
    if (typeof hipsCm === "number" && hipsCm > 0) circumferences.hipsCm = hipsCm;
    if (typeof chestCm === "number" && chestCm > 0) circumferences.chestCm = chestCm;
    const hasCirc = Object.keys(circumferences).length > 0;
    onAdd(w, date, hasCirc ? circumferences : undefined);
    setWeight("");
    setWaistCm("");
    setHipsCm("");
    setChestCm("");
    setFeedback("נשמר!");
    setTimeout(() => setFeedback(""), 1500);
  };

  return (
    <div className="weight-add-stack">
      <div className="weight-add-row">
        <label className="product-form-label">
          תאריך
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="product-form-label">
          משקל (ק"ג)
          <input
            type="number"
            min={20}
            max={400}
            step="0.1"
            placeholder="70.5"
            value={weight === "" ? "" : weight}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return setWeight("");
              const n = Number(raw.replace(",", "."));
              if (Number.isFinite(n) && n >= 0) setWeight(n);
            }}
          />
        </label>
        <button type="button" className="primary weight-add-btn" onClick={handleAdd}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>
            add_circle
          </span>
          הוסף מדידה
        </button>
        {feedback && <span className="product-feedback ok">{feedback}</span>}
      </div>
      <p className="weight-circ-hint">היקפים (אופציונלי, ס"מ) — למעקב אחרי מותן, ירכיים וחזה</p>
      <div className="weight-add-row weight-circ-row">
        <label className="product-form-label">
          מותן
          <input
            type="number"
            min={1}
            max={300}
            step="0.1"
            placeholder="—"
            value={waistCm === "" ? "" : waistCm}
            onChange={num(setWaistCm)}
          />
        </label>
        <label className="product-form-label">
          ירכיים
          <input
            type="number"
            min={1}
            max={300}
            step="0.1"
            placeholder="—"
            value={hipsCm === "" ? "" : hipsCm}
            onChange={num(setHipsCm)}
          />
        </label>
        <label className="product-form-label">
          חזה
          <input
            type="number"
            min={1}
            max={300}
            step="0.1"
            placeholder="—"
            value={chestCm === "" ? "" : chestCm}
            onChange={num(setChestCm)}
          />
        </label>
      </div>
    </div>
  );
}

// ── Chart + log ──────────────────────────────────────────
function WeightChart({ metrics }: { metrics: BodyMetrics }) {
  const data = useMemo(
    () =>
      metrics.log.map((e) => ({
        date: e.date,
        label: formatChartDate(e.date),
        weight: Number(e.weightKg.toFixed(2)),
      })),
    [metrics.log]
  );

  const minWeight = data.length > 0 ? Math.min(...data.map((d) => d.weight)) : 0;
  const maxWeight = data.length > 0 ? Math.max(...data.map((d) => d.weight)) : 0;
  const padded =
    data.length > 0
      ? [Math.floor(minWeight - 1), Math.ceil(maxWeight + 1)]
      : [0, 100];

  if (data.length === 0) {
    return (
      <div className="weight-chart-empty">
        <span className="material-symbols-outlined" style={{ fontSize: 44, opacity: 0.3 }}>
          monitoring
        </span>
        <p>עוד אין מדידות. הוסיפו את המדידה הראשונה למעלה.</p>
      </div>
    );
  }

  return (
    <div className="weight-chart-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(34, 139, 64, 0.12)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#3a5a40" }}
            tickMargin={6}
          />
          <YAxis
            domain={padded}
            tick={{ fontSize: 12, fill: "#3a5a40" }}
            tickFormatter={(v: number) => `${v}`}
            width={40}
          />
          <Tooltip
            formatter={(value) => [`${value} ק"ג`, "משקל"] as [string, string]}
            labelFormatter={(label) => String(label ?? "")}
            contentStyle={{
              direction: "rtl",
              borderRadius: 12,
              border: "1px solid rgba(34, 139, 64, 0.25)",
              fontSize: 13,
            }}
          />
          {metrics.goalWeightKg && (
            <ReferenceLine
              y={metrics.goalWeightKg}
              stroke="#2e7d32"
              strokeDasharray="6 4"
              label={{
                value: `יעד ${metrics.goalWeightKg}`,
                fill: "#2e7d32",
                fontSize: 11,
                position: "insideTopRight",
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#2e7d32"
            strokeWidth={2.5}
            dot={{ fill: "#2e7d32", r: 4 }}
            activeDot={{ r: 6 }}
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function lastCircumferences(metrics: BodyMetrics): BodyCircumferences | null {
  for (let i = metrics.log.length - 1; i >= 0; i--) {
    const c = metrics.log[i].circumferences;
    if (!c) continue;
    if (c.waistCm || c.hipsCm || c.chestCm) return c;
  }
  return null;
}

function CircumferenceChart({ metrics }: { metrics: BodyMetrics }) {
  const entriesWithCirc = useMemo(
    () =>
      metrics.log.filter(
        (e) =>
          e.circumferences &&
          (e.circumferences.waistCm ||
            e.circumferences.hipsCm ||
            e.circumferences.chestCm)
      ),
    [metrics.log]
  );

  const data = useMemo(
    () =>
      entriesWithCirc.map((e) => ({
        label: formatChartDate(e.date),
        waist: e.circumferences?.waistCm,
        hips: e.circumferences?.hipsCm,
        chest: e.circumferences?.chestCm,
      })),
    [entriesWithCirc]
  );

  if (entriesWithCirc.length === 0) {
    return (
      <p className="hint">
        כשתזינו מותן, ירכיים או חזה יחד עם מדידת משקל — הם יופיעו כאן.
      </p>
    );
  }

  if (entriesWithCirc.length < 2) {
    return (
      <p className="hint circ-chart-hint">
        נשמרה מדידת היקפים אחת. אחרי מדידה נוספת יוצג גרף מגמה.
      </p>
    );
  }

  return (
    <div className="circ-chart-wrap">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 16, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="rgba(21, 101, 192, 0.12)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#3a5a40" }}
            tickMargin={6}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: "#3a5a40" }}
            width={40}
          />
          <Tooltip
            formatter={(value, name) => {
              const raw =
                typeof value === "number"
                  ? value
                  : typeof value === "string"
                    ? Number(value)
                    : NaN;
              const v = Number.isFinite(raw) ? raw : null;
              const seriesLabel =
                name === "waist"
                  ? "מותן"
                  : name === "hips"
                    ? "ירכיים"
                    : name === "chest"
                      ? "חזה"
                      : String(name);
              return [v != null ? `${v.toFixed(1)} ס"מ` : "—", seriesLabel];
            }}
            labelFormatter={(label) => String(label ?? "")}
            contentStyle={{
              direction: "rtl",
              borderRadius: 12,
              border: "1px solid rgba(21, 101, 192, 0.25)",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="waist"
            name="מותן"
            stroke="#1565c0"
            strokeWidth={2}
            dot={{ fill: "#1565c0", r: 3 }}
            connectNulls
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="hips"
            name="ירכיים"
            stroke="#6a1b9a"
            strokeWidth={2}
            dot={{ fill: "#6a1b9a", r: 3 }}
            connectNulls
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="chest"
            name="חזה"
            stroke="#c62828"
            strokeWidth={2}
            dot={{ fill: "#c62828", r: 3 }}
            connectNulls
            isAnimationActive
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export function ProgressPage({ body }: Props) {
  const { metrics, setOnboarding, addWeight, removeWeight, reset } = body;

  if (!metrics) {
    return (
      <div className="page-container">
        <div className="page-hero">
          <span className="material-symbols-outlined page-hero-icon">monitoring</span>
          <div>
            <h2 className="page-title">התקדמות</h2>
            <p className="page-subtitle">
              מלאו פעם אחת את הפרטים, וכל מדידה שתעדכנו תופיע על גרף ההתקדמות.
            </p>
          </div>
        </div>

        <section className="section">
          <h2>
            <span className="material-symbols-outlined">person_add</span>
            פרטים בסיסיים
          </h2>
          <OnboardingForm onSubmit={setOnboarding} />
        </section>
      </div>
    );
  }

  const bmi = calcBmi(metrics.currentWeightKg, metrics.heightCm);
  const startBmi = calcBmi(metrics.startWeightKg, metrics.heightCm);
  const delta = metrics.currentWeightKg - metrics.startWeightKg;
  const goalDelta =
    metrics.goalWeightKg != null ? metrics.currentWeightKg - metrics.goalWeightKg : null;
  const circSnap = lastCircumferences(metrics);

  return (
    <div className="page-container">
      <div className="page-hero">
        <span className="material-symbols-outlined page-hero-icon">monitoring</span>
        <div>
          <h2 className="page-title">
            התקדמות{metrics.name ? ` · ${metrics.name}` : ""}
          </h2>
          <p className="page-subtitle">
            מעקב משקל ו-BMI לאורך זמן. הוסיפו מדידה כדי לעדכן את הגרף.
          </p>
        </div>
      </div>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">insights</span>
          תמונת מצב
        </h2>
        <div className="progress-stats-grid">
          <div className="progress-stat-card">
            <span className="progress-stat-label">משקל נוכחי</span>
            <span className="progress-stat-value">
              {metrics.currentWeightKg.toFixed(1)} <small>ק"ג</small>
            </span>
            {Math.abs(delta) > 0.05 && (
              <span className={`progress-stat-delta ${delta < 0 ? "down" : "up"}`}>
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)} מההתחלה
              </span>
            )}
          </div>
          <div className="progress-stat-card">
            <span className="progress-stat-label">BMI נוכחי</span>
            <span className="progress-stat-value">
              {bmi != null ? bmi.toFixed(1) : "—"}
            </span>
            {bmi != null && (
              <span className="progress-stat-delta">{bmiCategory(bmi)}</span>
            )}
          </div>
          <div className="progress-stat-card">
            <span className="progress-stat-label">משקל יעד</span>
            <span className="progress-stat-value">
              {metrics.goalWeightKg != null
                ? <>{metrics.goalWeightKg.toFixed(1)} <small>ק"ג</small></>
                : "—"}
            </span>
            {goalDelta != null && Math.abs(goalDelta) > 0.05 && (
              <span className={`progress-stat-delta ${goalDelta > 0 ? "down" : "up"}`}>
                {goalDelta > 0
                  ? `נשארו ${goalDelta.toFixed(1)} ק"ג`
                  : `${Math.abs(goalDelta).toFixed(1)} ק"ג מתחת ליעד`}
              </span>
            )}
          </div>
          <div className="progress-stat-card">
            <span className="progress-stat-label">משקל התחלתי</span>
            <span className="progress-stat-value">
              {metrics.startWeightKg.toFixed(1)} <small>ק"ג</small>
            </span>
            {startBmi != null && (
              <span className="progress-stat-delta">BMI {startBmi.toFixed(1)}</span>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">add_circle</span>
          עדכון מדידה
        </h2>
        <AddWeightRow onAdd={addWeight} />
      </section>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">show_chart</span>
          גרף משקל
        </h2>
        <WeightChart metrics={metrics} />
      </section>

      <div className="section">
        <GoalTipsCard
          variant="full"
          input={{
            goal: metrics.goal,
            currentWeightKg: metrics.currentWeightKg,
            goalWeightKg: metrics.goalWeightKg ?? null,
            heightCm: metrics.heightCm,
          }}
        />
      </div>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">straighten</span>
          מעקב היקפים
        </h2>
        <p className="hint circ-section-intro">
          שדות ההיקף מופיעים יחד עם מדידת המשקל. רק מי שמעוניין צריך למלא.
        </p>
        {circSnap && (
          <div className="circ-snapshot-grid">
            {circSnap.waistCm != null && (
              <div className="progress-stat-card circ-snap-card">
                <span className="progress-stat-label">מותן (אחרון)</span>
                <span className="progress-stat-value">
                  {circSnap.waistCm.toFixed(1)} <small>ס"מ</small>
                </span>
              </div>
            )}
            {circSnap.hipsCm != null && (
              <div className="progress-stat-card circ-snap-card">
                <span className="progress-stat-label">ירכיים (אחרון)</span>
                <span className="progress-stat-value">
                  {circSnap.hipsCm.toFixed(1)} <small>ס"מ</small>
                </span>
              </div>
            )}
            {circSnap.chestCm != null && (
              <div className="progress-stat-card circ-snap-card">
                <span className="progress-stat-label">חזה (אחרון)</span>
                <span className="progress-stat-value">
                  {circSnap.chestCm.toFixed(1)} <small>ס"מ</small>
                </span>
              </div>
            )}
          </div>
        )}
        <CircumferenceChart metrics={metrics} />
      </section>

      <section className="section">
        <h2>
          <span className="material-symbols-outlined">history</span>
          היסטוריית מדידות ({metrics.log.length})
        </h2>
        {metrics.log.length === 0 ? (
          <p className="hint">אין מדידות להצגה.</p>
        ) : (
          <ul className="weight-log-list">
            {[...metrics.log].reverse().map((entry) => (
              <li key={entry.date} className="weight-log-row">
                <span className="weight-log-date">{formatChartDate(entry.date)}</span>
                <span className="weight-log-main">
                  <span className="weight-log-weight">
                    {entry.weightKg.toFixed(1)} ק"ג
                  </span>
                  {entry.circumferences &&
                    (entry.circumferences.waistCm ||
                      entry.circumferences.hipsCm ||
                      entry.circumferences.chestCm) && (
                      <span className="weight-log-circ">
                        {entry.circumferences.waistCm != null && (
                          <>מותן {entry.circumferences.waistCm.toFixed(1)}</>
                        )}
                        {entry.circumferences.waistCm != null &&
                          (entry.circumferences.hipsCm != null ||
                            entry.circumferences.chestCm != null) &&
                          " · "}
                        {entry.circumferences.hipsCm != null && (
                          <>ירכיים {entry.circumferences.hipsCm.toFixed(1)}</>
                        )}
                        {entry.circumferences.hipsCm != null &&
                          entry.circumferences.chestCm != null &&
                          " · "}
                        {entry.circumferences.chestCm != null && (
                          <>חזה {entry.circumferences.chestCm.toFixed(1)}</>
                        )}
                        <span className="weight-log-circ-unit"> ס"מ</span>
                      </span>
                    )}
                </span>
                <button
                  type="button"
                  className="row-icon-button"
                  onClick={() => removeWeight(entry.date)}
                  aria-label={`מחק מדידה מתאריך ${entry.date}`}
                  title="מחק מדידה"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section progress-danger-zone">
        <button type="button" className="ghost" onClick={reset}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 4 }}>
            refresh
          </span>
          אתחול נתוני התקדמות
        </button>
        <p className="hint">פעולה זו תמחק את כל הנתונים והמדידות.</p>
      </section>
    </div>
  );
}
