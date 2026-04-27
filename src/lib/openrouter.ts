export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API belum di-set");
  return key;
}

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

