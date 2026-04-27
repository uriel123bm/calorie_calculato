/**
 * AuthContext — manages the authenticated user state.
 *
 * Strategy:
 *  • Access token  → kept in memory (never in localStorage/sessionStorage)
 *  • Refresh token → httpOnly cookie set by the backend (JS can't read it)
 *  • On app load   → attempt a silent /auth/refresh to restore session
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
  apiRefresh,
  apiRegister,
  AuthUser,
  setAccessToken,
} from "../services/api";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;   // true while checking existing session on mount
}

interface AuthContextValue extends AuthState {
  login:    (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout:   () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  // On mount: try to restore session via refresh cookie (8s timeout to handle Render cold start)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAccessToken(null);
      setState({ user: null, loading: false });
    }, 8000);

    apiRefresh()
      .then(({ access_token, user }) => {
        clearTimeout(timeout);
        setAccessToken(access_token);
        setState({ user, loading: false });
      })
      .catch(() => {
        clearTimeout(timeout);
        setAccessToken(null);
        setState({ user: null, loading: false });
      });

    return () => clearTimeout(timeout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user } = await apiLogin(email, password);
    setAccessToken(access_token);
    setState({ user, loading: false });
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { access_token, user } = await apiRegister(email, username, password);
      setAccessToken(access_token);
      setState({ user, loading: false });
    },
    []
  );

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setAccessToken(null);
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
