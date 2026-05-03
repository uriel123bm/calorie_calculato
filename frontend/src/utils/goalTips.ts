import type { Goal } from "../types";

export interface GoalTipsInput {
  goal?: Goal;
  currentWeightKg: number;
  goalWeightKg?: number | null;
  heightCm: number;
}

export interface GoalTipsResult {
  title: string;
  items: string[];
}

function bmi(weightKg: number, heightCm: number): number | null {
  if (heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function uniqLines(lines: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** גיבוב קטן ויציב — לסיבוב יומי (לא קריפטוגרפי). */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return Math.abs(h);
}

function rotateArray<T>(arr: T[], start: number): T[] {
  if (arr.length === 0) return arr;
  const k = ((start % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
}

const POOL_CAP = 48;
const SHOW_COUNT = 4;

const GOAL_LABEL: Record<Goal, string> = {
  lose: "ירידה במשקל",
  cut: "חיטוב",
  maintain: "שמירה על משקל",
  gain: "עלייה במסה",
};

function tipsForGoal(goal: Goal | undefined): string[] {
  if (goal === "lose") {
    return [
      'גירעון קלוריות מתון (למשל סביב 300–500 קלוריות מההוצאה המשוערת) קל יותר לשמירה מאשר "דיאטה" קיצונית.',
      "חלבון מספיק בכל ארוחה עוזר לשובע ולשמירה על מסת שריר בזמן ירידה.",
      "שינה סדירה ושתייה מספקת משפיעות על רעב והחלטות אוכל — לא רק הקלוריות ביומן.",
      "פחמימות מלאות וירקות מוסיפים נפח לארוחה בלי הרבה קלוריות.",
      "הליכה קצרה אחרי ארוחה יכולה לעזור לתחושת קלילות — בלי להישען על 'שריפת' קלוריות כתירוץ לאכול יותר.",
      "כשקשה לעמוד ביעד — הקטינו את השינוי לשבוע הבא במקום לוותר לגמרי.",
    ];
  }
  if (goal === "cut") {
    return [
      "בחיטוב לרוב משלבים גירעון קטן עם אימון התנגדות — לשמר כוח, תזינו חלבון בעקביות.",
      "מעקב אחרי ממוצע שבועי של קלוריות עוזר להימנע מתסכול מימים עם ארוחה חברתית.",
      "סיבים ונוזלים מספיק — תחושת רעב קלה לפעמים מבלבלת עם צמא.",
      "בימים עם אימון כוח — אל תזניחו פחמימות סביב האימון אם זה עוזר לכם לביצועים ולהתאוששות.",
      "שינוי איטי במראה הגוף נפוץ יותר משינוי במספר על המשקל — שני המדדים שווים תיעוד.",
    ];
  }
  if (goal === "maintain") {
    return [
      "בשמירת משקל המטרה היא יציבות: מדידת משקל פעם בשבועיים–חודש יכולה להספיק.",
      "אם המשקל זז לאט — קודם ממוצע שבועי של קלוריות, לא תיקונים קיצוניים כל יום.",
      "פעילות יומית קלה (הליכה, מדרגות) תומכת בהוצאה בלי להישען רק על הגבלה באוכל.",
      "שגרת ארוחות דומה מיום ליום קלה יותר לתכנון מאשר 'ארוחת פאר' פעם בשבוע ופיצוי למחרת.",
      "אם היעד הקלורי נשמר בממוצע — תנודות יום־יומיות לגיטימיות.",
    ];
  }
  if (goal === "gain") {
    return [
      "בעלייה במסה לרוב צריך עודף קלוריות מתון וחלבון גבוה יחסית למשקל הגוף.",
      "ארוחות צפופות בקלוריות (אגוזים, שמנים בריאים, דגנים מלאים) עוזרות כשקשה לאכול נפח גדול.",
      "אימון התנגדות משלים עלייה במשקל בריאה — לא רק המספר על המשקל.",
      "עלייה מהירה מדי בשבוע עלולה להיות בעיקר שומן — קצב מתון נותן זמן להסתגלות.",
      "ארוחות קטנות יותר ותכופות יותר מתאימות לחלק מהאנשים מאשר שלוש ארוחות גדולות.",
    ];
  }
  return [
    "בחרו מטרה בעמוד התקדמות כדי לקבל טיפים ממוקדים יותר.",
    "קלוריות שבועיות חשובות לא פחות מיום בודד — המערכת כאן עוזרת לראות תמונה מצטברת.",
    "חלבון, ירקות ושינה טובה תומכים ברוב המטרות, גם כשמשנים משקל לאט.",
    "תיעוד עקבי חושף דפוסים — גם כשהיום לא ‘מושלם’.",
    "מים ופחמימות מורכבות יכולים לעזור לשובע לטווח ארוך יותר מממתקים ריקים.",
  ];
}

function contextualTips(
  currentWeightKg: number,
  goalWeightKg: number | null | undefined,
  heightCm: number
): string[] {
  const out: string[] = [];
  const gap =
    goalWeightKg != null && Number.isFinite(goalWeightKg)
      ? currentWeightKg - goalWeightKg
      : null;

  if (gap != null && Math.abs(gap) > 0.05) {
    if (gap > 8) {
      out.push(
        "מרחק ניכר מהמשקל שקבעתם — קצב מתון (בערך חצי עד קילוגרם בשבוע) נוטה להיות יציב יותר מנסיגות חדות."
      );
    } else if (gap > 2) {
      out.push(
        "עדיין מעל יעד המשקל — עקביות בשגרה חשובה יותר מיום ‘מושלם’ בודד."
      );
    } else if (gap >= -1.5 && gap <= 2) {
      out.push(
        "קרובים למשקל היעד — שימו לב לממוצע של כמה ימים ולא רק ליום אחד."
      );
    }
    if (gap < -1) {
      out.push(
        "מתחת למשקל היעד שהוגדר — אם זה לא מתוכנן, כדאי לשקול התאמת יעד או פנייה למומחה."
      );
    }
  }

  const b = bmi(currentWeightKg, heightCm);
  if (b != null) {
    if (b < 18.5) {
      out.push(
        "BMI נמוך מהטווח הנפוץ — אם זו לא מטרה מודעת, שווה להתייעץ עם איש מקצוע."
      );
    } else if (b >= 30) {
      out.push(
        "שינוי אטי וקבוע לטווח ארוך בדרך כלל בטוח יותר מקיצוניות קצרות."
      );
    }
  }

  return out;
}

export interface GetGoalTipsOptions {
  /** YYYY-MM-DD מקומי — קובע איזה טיפים מוצגים היום (חידוש יומי). */
  dateKey?: string;
}

/**
 * טיפים כלליים בלבד — לא תחליף לייעוץ רפואי או תזונאי.
 * עם `dateKey` — סדר הטיפים המוצגים משתנה מדי יום (אותו יום = אותה בחירה).
 */
export function getGoalTips(
  input: GoalTipsInput,
  options?: GetGoalTipsOptions
): GoalTipsResult | null {
  const { goal, currentWeightKg, goalWeightKg, heightCm } = input;
  if (!Number.isFinite(heightCm) || heightCm <= 0 || !Number.isFinite(currentWeightKg)) {
    return null;
  }

  const ctx = contextualTips(currentWeightKg, goalWeightKg, heightCm);
  const goalLines = tipsForGoal(goal);
  const pool = uniqLines([...ctx, ...goalLines], POOL_CAP);

  const dateKey = options?.dateKey?.trim() ?? "";
  const rotationSeed =
    dateKey.length > 0
      ? hashString(`${dateKey}:${goal ?? "none"}`)
      : 0;
  const rotated =
    pool.length > 0 ? rotateArray(pool, pool.length ? rotationSeed % pool.length : 0) : [];
  const merged = rotated.slice(0, SHOW_COUNT);

  const title =
    goal != null
      ? `טיפים בהתאם ל־${GOAL_LABEL[goal]}`
      : "טיפים כלליים";

  if (merged.length === 0) {
    return {
      title,
      items: [
        "שמרו על עקביות במעקב — הנתונים האישיים שלכם עוזרים לזהות דפוסים לאורך זמן.",
      ],
    };
  }

  return { title, items: merged };
}
