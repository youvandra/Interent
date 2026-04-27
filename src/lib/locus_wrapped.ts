import { getLocusApiBase, getLocusApiKey } from "@/lib/locus";

export async function callWrappedApi<TData = unknown>(
  provider: string,
  endpoint: string,
  body: unknown,
): Promise<TData> {
  const base = getLocusApiBase();
  const key = getLocusApiKey();

  const resp = await fetch(`${base}/wrapped/${provider}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await resp.json().catch(() => null)) as any;
  if (!resp.ok || json?.success === false) {
    throw new Error(
      `Wrapped API failed (${provider}/${endpoint}) status=${resp.status} body=${JSON.stringify(json)}`,
    );
  }

  // Locus wrapped response shape: { success: true, data: ... }
  return (json?.data ?? json) as TData;
}

