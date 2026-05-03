/**
 * Combined Login / Register screen.
 * Single component with an internal `mode` toggle — keeps bundle small.
 */
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { trackEvent } from "../services/analytics";

function signupErrorMeta(err: unknown): { http_status?: number } {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" ? { http_status: status } : {};
}

type Mode = "login" | "register";

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response?: { data?: { detail?: unknown } } }).response;
    const detail = r?.data?.detail;
    if (typeof detail === "string") return detail;
    // Pydantic validation errors come as an array
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg.replace(/^Value error, /, "");
    }
  }
  if (err instanceof Error && err.message.includes("Network Error")) {
    return "לא ניתן להתחבר לשרת. ודאו שהשרת פועל (uvicorn).";
  }
  return "אירעה שגיאה, נסו שוב.";
}

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");

  useEffect(() => {
    trackEvent("auth_screen_viewed", { initial_tab: "login" });
  }, []);

  const [email,    setEmail]    = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [showPw,  setShowPw]  = useState(false);

  const clearForm = () => {
    setEmail(""); setUsername(""); setPassword(""); setConfirm(""); setError("");
  };

  const switchMode = (next: Mode) => {
    if (next === "register") {
      trackEvent("signup_tab_opened");
    }
    clearForm();
    setMode(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (password !== confirm) { setError("הסיסמאות אינן תואמות"); return; }
      if (password.length < 8)  { setError("סיסמה חייבת להכיל לפחות 8 תווים"); return; }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        trackEvent("signup_submit_attempted");
        await register(email, username, password);
      }
    } catch (err) {
      if (mode === "register") {
        trackEvent("signup_failed", signupErrorMeta(err));
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* background orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="material-symbols-outlined auth-logo-icon">nutrition</span>
          <h1 className="auth-logo-title">מחשבון קלוריות</h1>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            התחברות
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            הרשמה
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="auth-field">
            <label htmlFor="auth-email">
              <span className="material-symbols-outlined">mail</span>
              כתובת אימייל
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              dir="ltr"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              required
              disabled={loading}
            />
          </div>

          {/* Username (register only) */}
          {mode === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-username">
                <span className="material-symbols-outlined">person</span>
                שם משתמש
              </label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                placeholder="לדוגמה: user"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="auth-password">
              <span className="material-symbols-outlined">lock</span>
              סיסמה
            </label>
            <div className="auth-pw-wrap">
              <input
                id="auth-password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="לפחות 8 תווים"
                dir="ltr"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
                aria-label={showPw ? "הסתר סיסמה" : "הצג סיסמה"}
              >
                <span className="material-symbols-outlined">
                  {showPw ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Confirm password (register only) */}
          {mode === "register" && (
            <div className="auth-field">
              <label htmlFor="auth-confirm">
                <span className="material-symbols-outlined">lock_reset</span>
                אימות סיסמה
              </label>
              <input
                id="auth-confirm"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="הקלידו את הסיסמה שוב"
                dir="ltr"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="auth-error" role="alert">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? <span className="auth-spinner" />
              : mode === "login" ? "התחבר" : "הירשם"}
          </button>
        </form>

        {/* Switch mode link */}
        <p className="auth-switch">
          {mode === "login" ? "אין לך חשבון עדיין? " : "כבר יש לך חשבון? "}
          <button
            type="button"
            className="auth-link"
            onClick={() => switchMode(mode === "login" ? "register" : "login")}
            disabled={loading}
          >
            {mode === "login" ? "הירשם כאן" : "התחבר"}
          </button>
        </p>
      </div>
    </div>
  );
}
