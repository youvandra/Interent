export function getLocusApiBase(): string {
  const base = process.env.LOCUS_API_BASE;
  if (!base) throw new Error("LOCUS_API_BASE is not set");
  return base;
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/$/, "");
}

export function getLocusApiKey(): string {
  const key = process.env.LOCUS_API_KEY;
  if (!key) throw new Error("LOCUS_API_KEY is not set");
  return key;
}
