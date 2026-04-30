/** האם ניתן לקרוא ל-getUserMedia מהדף הנוכחי (Secure Context + תמיכת דפדפן). */

export function isCameraApiAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

/** הסבר בעברית למשתמש כשהמצלמה לא זמינה מהדף */
export function cameraUnavailableMessage(): string {
  if (typeof window === "undefined") return "";
  if (!window.isSecureContext) {
    return (
      "גישה למצלמה חסומה: הדף נטען ב־HTTP שאינו «מאובטח» בכתובת ברשת (למשל 10.0.0.x). " +
      "ב‑Safari ב‑iPhone זה חוסם את המצלמה. פתרון: הפעילו את שרת הפיתוח עם HTTPS " +
      "(בפרויקט זה מופעל אוטומטית — יוצג כתובת https בטרמינל), אשרו את האישור בפעם הראשונה, " +
      "או הקלידו את מספר הברקוד בשדה למטה."
    );
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
    return "הדפדפן לא מאפשר גישה למצלמה מדף זה — עדכנו דפדפן או הקלידו ברקוד למטה.";
  }
  return "";
}
