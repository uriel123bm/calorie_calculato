import { useCallback, useEffect, useState } from "react";
import { schedulePush, subscribeSyncRefreshed } from "../services/sync";
import type { UserProduct } from "../types";

const storageKey = (uid: string) => `user_${uid}:products:v1`;

function load(uid: string): UserProduct[] {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    return raw ? (JSON.parse(raw) as UserProduct[]) : [];
  } catch {
    return [];
  }
}

function save(uid: string, products: UserProduct[]): void {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(products));
  } catch {
    /* ignore quota errors */
  }
}

export type ProductSaveResult = "saved" | "duplicate";

export type ProductInput = Omit<UserProduct, "id" | "addedAt">;

export interface UseUserProductsResult {
  products: UserProduct[];
  addProduct: (input: ProductInput) => ProductSaveResult;
  updateProduct: (id: string, patch: Partial<ProductInput>) => void;
  deleteProduct: (id: string) => void;
}

/**
 * Manages the user's personal products library.
 *
 * Each product is stored *per serving* (e.g. "500 מ\"ל = 50g protein").
 * When adding to the daily tracker the consumer scales the macros by
 * `quantity / servingValue`.
 *
 * Same persistence + cross-device sync pattern as `useSavedRecipes`:
 *  - localStorage `user_${uid}:products:v1`
 *  - subscribes to `subscribeSyncRefreshed` so server pulls update the UI
 *  - listens to the `storage` event so other tabs stay consistent
 *  - calls `schedulePush(uid)` after every mutation
 */
export function useUserProducts(userId: string): UseUserProductsResult {
  const [products, setProducts] = useState<UserProduct[]>(() => load(userId));

  useEffect(() => {
    setProducts(load(userId));
  }, [userId]);

  useEffect(() => {
    return subscribeSyncRefreshed((uid) => {
      if (uid !== userId) return;
      setProducts(load(userId));
    });
  }, [userId]);

  useEffect(() => {
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== key) return;
      setProducts(load(userId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  const addProduct = useCallback(
    (input: ProductInput): ProductSaveResult => {
      const trimmed = input.name.trim() || "מוצר ללא שם";
      const normalised = trimmed.toLowerCase();
      const current = load(userId);
      if (current.some((p) => p.name.toLowerCase() === normalised)) {
        return "duplicate";
      }
      const entry: UserProduct = {
        ...input,
        name: trimmed,
        id: Math.random().toString(36).slice(2, 11),
        addedAt: Date.now(),
      };
      const updated = [entry, ...current];
      save(userId, updated);
      setProducts(updated);
      schedulePush(userId);
      return "saved";
    },
    [userId]
  );

  const updateProduct = useCallback(
    (id: string, patch: Partial<ProductInput>) => {
      setProducts((prev) => {
        const updated = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
        save(userId, updated);
        schedulePush(userId);
        return updated;
      });
    },
    [userId]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      setProducts((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        save(userId, updated);
        schedulePush(userId);
        return updated;
      });
    },
    [userId]
  );

  return { products, addProduct, updateProduct, deleteProduct };
}
