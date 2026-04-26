export const BUYER_ID_STORAGE_KEY = "lmm_buyer_id";

export function getOrCreateBuyerId(): string {
  if (typeof window === "undefined") return "unknown";
  const existing = window.localStorage.getItem(BUYER_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(BUYER_ID_STORAGE_KEY, id);
  return id;
}

