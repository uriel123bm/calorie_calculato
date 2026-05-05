export function generateId(prefix = ""): string {
  const hasCrypto = typeof globalThis !== "undefined" && "crypto" in globalThis;
  if (hasCrypto && typeof globalThis.crypto.randomUUID === "function") {
    return `${prefix}${globalThis.crypto.randomUUID()}`;
  }
  const fallback = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}${fallback}`;
}
