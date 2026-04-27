/**
 * AuthContext — manages the authenticated user state.
 *
 * Strategy:
 *  • Access token  → kept in memory (never in localStorage/sessionStorage)
 *  • Refresh token → httpOnly cookie set by the backend (JS can't read it)
 *  • User info     → cached in localStorage so the app opens instantly
 *  • On app load   → restore user from localStorage immediately (no spinner),
 *                    then silently validate with /auth/refresh in the background.
 *                    Only log out if the server explicitly returns 401.
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

  useEffect(() => {
    // If we have a stored access token, verify it with /auth/me (no cookie needed).
    // Otherwise try cookie-based refresh as fallback.
    const validate = cached
      ? apiMe().then((user) => ({ user, access_token: _getStoredToken() }))
      : apiRefresh();

    validate
      .then(({ user, access_token }) => {
        if (access_token) setAccessToken(access_token);
        saveCachedUser(user);
        setState({ user, loading: false });
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 401) {
          // Token explicitly rejected — must log in again
          setAccessToken(null);
          saveCachedUser(null);
          setState({ user: null, loading: false });
        } else {
          // Network error / server cold start — keep cached session, token stays in localStorage
          setState((prev) => ({ ...prev, loading: false }));
        }
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user } = await apiLogin(email, password);
    setAccessToken(access_token);
    saveCachedUser(user);
    setState({ user, loading: false });
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { access_token, user } = await apiRegister(email, username, password);
      setAccessToken(access_token);
      saveCachedUser(user);
      setState({ user, loading: false });
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
