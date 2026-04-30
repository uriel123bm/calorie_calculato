/** הודעת משתמש כשאין רשת (לא להציג שגיאות Axios גולמיות). */
export const OFFLINE_MESSAGE_HE =
  "אין חיבור לאינטרנט. בדקו את הרשת ונסו שוב.";

export class OfflineError extends Error {
  constructor(message = OFFLINE_MESSAGE_HE) {
    super(message);
    this.name = "OfflineError";
  }
}

export function isOfflineError(e: unknown): e is OfflineError {
  return e instanceof OfflineError;
}
