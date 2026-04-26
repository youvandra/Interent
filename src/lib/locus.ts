export function getLocusApiBase(): string {
  return process.env.LOCUS_API_BASE || "https://beta-api.paywithlocus.com/api";
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL belum di-set");
  return url.replace(/\/$/, "");
}

export function getLocusApiKey(): string {
  const key = process.env.LOCUS_API_KEY;
  if (!key) throw new Error("LOCUS_API_KEY belum di-set");
  return key;
}

