import axios, { AxiosError } from "axios";
import type {
  AnalyzeResponse,
  HebrewUnit,
  IngredientRowState,
  RecipeSummary,
} from "../types";

// In dev the Vite proxy forwards /auth, /ingredients, /recipe → backend.
// In production set VITE_API_BASE to the deployed backend URL.
const baseURL = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export const client = axios.create({
  baseURL,
  timeout: 25000,
  withCredentials: true,   // send httpOnly cookies (refresh_token)
});

// ── Access-token injection ──────────────────────────────
// The access token is stored in memory via AuthContext.
// We expose a setter so AuthContext can register the current token.
let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

client.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// ── Silent refresh on 401 ───────────────────────────────
let _isRefreshing = false;
let _refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  _refreshSubscribers.push(cb);
}
function onTokenRefreshed(newToken: string) {
  _refreshSubscribers.forEach((cb) => cb(newToken));
  _refreshSubscribers = [];
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    if (!original) return Promise.reject(error);

    // Never retry auth routes themselves — would create infinite loops
    const isAuthRoute = original.url?.startsWith("/auth/");
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (_isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(client(original));
          });
        });
      }
      original._retry = true;
      _isRefreshing = true;
      try {
        const { data } = await client.post<{ access_token: string }>("/auth/refresh");
        _accessToken = data.access_token;
        setAccessToken(data.access_token);
        onTokenRefreshed(data.access_token);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return client(original);
      } catch {
        _accessToken = null;
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);


// ── Nutrition endpoints ─────────────────────────────────

export async function analyzeIngredient(params: {
  ingredient_name: string;
  quantity: number;
  unit: HebrewUnit;
}): Promise<AnalyzeResponse> {
  const { data } = await client.post<AnalyzeResponse>("/ingredients/analyze", params);
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
