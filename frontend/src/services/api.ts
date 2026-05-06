import axios, { AxiosError } from "axios";
import type {
  AnalyzeResponse,
  HebrewUnit,
  IngredientRowState,
  RecipeSummary,
} from "../types";
import { OfflineError } from "../utils/network";

// In dev the Vite proxy forwards /auth, /ingredients, /recipe → backend.
// In production the backend runs under /_/backend (Vercel experimentalServices).
const baseURL =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (import.meta.env.PROD ? "/_/backend" : "");

export const client = axios.create({
  baseURL,
  timeout: 25000,
  withCredentials: true, // send httpOnly cookies (refresh_token)
});

// ── Access-token injection ──────────────────────────────
// Stored in localStorage so it survives app close/reopen.
const TOKEN_KEY = "auth:accessToken";

let _accessToken: string | null = (() => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
})();

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(name) + "=";
  const hit = document.cookie.split("; ").find((c) => c.startsWith(encoded));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(encoded.length));
}

export function setAccessToken(token: string | null): void {
  _accessToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else        localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

function dispatchSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

client.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  const csrf = readCookie("csrf_token");
  if (csrf) {
    config.headers["X-CSRF-Token"] = csrf;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return Promise.reject(new OfflineError());
  }
  return config;
});

// ── Silent refresh on 401 ───────────────────────────────
let _isRefreshing = false;
type RefreshWaiter = (r: { ok: true; token: string } | { ok: false; error: unknown }) => void;
const _refreshWaiters: RefreshWaiter[] = [];

function waitForRefresh() {
  return new Promise<string>((resolve, reject) => {
    _refreshWaiters.push((r) => {
      if (r.ok) resolve(r.token);
      else    reject(r.error);
    });
  });
}

function flushRefreshSuccess(token: string): void {
  const q = _refreshWaiters.splice(0, _refreshWaiters.length);
  q.forEach((w) => w({ ok: true, token }));
}

function flushRefreshFailure(err: unknown): void {
  const q = _refreshWaiters.splice(0, _refreshWaiters.length);
  q.forEach((w) => w({ ok: false, error: err }));
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (!original) return Promise.reject(error);

    // Never retry auth routes themselves — would create infinite loops
    const isAuthRoute = original.url?.includes("/auth/");
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (_isRefreshing) {
        try {
          const token = await waitForRefresh();
          original._retry = true;
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        } catch (e) {
          return Promise.reject(e);
        }
      }

      original._retry = true;
      _isRefreshing = true;
      try {
        const { data } = await client.post<{ access_token: string }>("/auth/refresh");
        if (!data?.access_token) {
          throw new Error("no access_token in refresh response");
        }
        setAccessToken(data.access_token);
        flushRefreshSuccess(data.access_token);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return client(original);
      } catch (e) {
        // Only wipe the session when the server rejects the refresh token.
        // Network / timeout / 5xx must NOT log the user out — token may still be valid.
        const status = (e as AxiosError)?.response?.status;
        if (status === 401 || status === 403) {
          setAccessToken(null);
          dispatchSessionExpired();
        }
        flushRefreshFailure(e);
        return Promise.reject(e);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);


// ── Nutrition endpoints ─────────────────────────────────

export async function analyzeIngredient(
  params: {
    ingredient_name: string;
    quantity: number;
    unit: HebrewUnit;
  },
  options?: { signal?: AbortSignal }
): Promise<AnalyzeResponse> {
  const { data } = await client.post<AnalyzeResponse>(
    "/ingredients/analyze",
    params,
    { signal: options?.signal }
  );
  return data;
}

export async function calculateRecipe(payload: {
  recipe_name: string | null;
  servings: number;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: HebrewUnit;
    nutrition_per_100g: IngredientRowState["nutritionPer100g"];
    unit_weight_g?: number;
  }>;
}): Promise<RecipeSummary> {
  const { data } = await client.post<RecipeSummary>("/recipe/calculate", payload);
  return data;
}


// ── Auth endpoints ──────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export async function apiRegister(email: string, username: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/auth/register", { email, username, password });
  return data;
}

export async function apiLogin(email: string, password: string): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/auth/login", { email, password });
  return data;
}

export async function apiMe(): Promise<AuthUser> {
  const { data } = await client.get<AuthUser>("/auth/me");
  return data;
}

export async function apiRefresh(): Promise<TokenResponse> {
  const { data } = await client.post<TokenResponse>("/auth/refresh");
  return data;
}

export async function apiLogout(): Promise<void> {
  await client.post("/auth/logout");
}
