/**
 * AuthContext — manages the authenticated user state.
 *
 * Strategy:
 *  • Access token  → localStorage (survives app close; iOS PWA often drops cookies)
 *  • Refresh token → httpOnly cookie (fallback when access token expires)
 *  • User profile  → localStorage cache for instant first paint
 *  • On app load   → if token exists, validate with /auth/me; on 401 try /auth/refresh.
 *                    Only clear session on explicit 401/403 from the server.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRefresh,
  apiRegister,
  AuthUser,
  setAccessToken,
} from "../services/api";
import { pullSync, setSyncUserId } from "../services/sync";

const USER_CACHE_KEY = "auth:cachedUser";

function loadCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function _getStoredToken(): string | null {
  try { return localStorage.getItem("auth:accessToken"); } catch { return null; }
}

function saveCachedUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch { /* ignore */ }
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login:    (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const cached = loadCachedUser();

  // If we have a cached user, start with loading=false so the app opens instantly.
  // Otherwise show the loading screen while we contact the backend.
  const [state, setState] = useState<AuthState>({
    user: cached,
    loading: !cached,
  });

  // Keep the sync layer aware of which user's buckets are active (for pull
  // on tab focus + online).
  useEffect(() => {
    setSyncUserId(state.user?.id ?? null);
  }, [state.user?.id]);

  // When the refresh token is gone/invalid, axios clears the session; sync UI to login.
  useEffect(() => {
    const onSessionExpired = () => {
      setAccessToken(null);
      saveCachedUser(null);
      setState({ user: null, loading: false });
    };
    window.addEventListener("auth:session-expired", onSessionExpired);
    return () => window.removeEventListener("auth:session-expired", onSessionExpired);
  }, []);

  useEffect(() => {
    // Restore session strategy:
    //  1. If an access token exists, call /auth/me (works without cookies on iOS PWA).
    //  2. On 401 from /auth/me, fall back to /auth/refresh (httpOnly cookie).
    //  3. With no stored token, try /auth/refresh only (first visit after old builds).
    const restore = async (): Promise<{ user: AuthUser; access_token: string | null }> => {
      const token = _getStoredToken();
      if (token) {
        try {
          const user = await apiMe();
          return { user, access_token: token };
        } catch (err: unknown) {
          const st = (err as { response?: { status?: number } })?.response?.status;
          if (st !== 401) throw err;
        }
      }
      const { user, access_token } = await apiRefresh();
      return { user, access_token };
    };

    restore()
      .then(({ user, access_token }) => {
        if (access_token) setAccessToken(access_token);
        saveCachedUser(user);
        setState({ user, loading: false });
        void pullSync(user.id);
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401) {
          // Both /auth/me and /auth/refresh rejected — must log in again.
          setAccessToken(null);
          saveCachedUser(null);
          setState({ user: null, loading: false });
        } else {
          // Network error / server cold start — keep cached session.
          setState((prev) => ({ ...prev, loading: false }));
        }
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user } = await apiLogin(email, password);
    setAccessToken(access_token);
    saveCachedUser(user);
    setState({ user, loading: false });
    void pullSync(user.id);
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { access_token, user } = await apiRegister(email, username, password);
      setAccessToken(access_token);
      saveCachedUser(user);
      setState({ user, loading: false });
      void pullSync(user.id);
    },
    []
  );

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setAccessToken(null);
    saveCachedUser(null);
    setState({ user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
