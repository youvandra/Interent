import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getLocusApiBase, getLocusApiKey } from "@/lib/locus";

const PROVIDERS = [
  "openai",
  "gemini",
  "firecrawl",
  "exa",
  "clado",
  "apollo",
  "browser-use",
  "x",
  "fal",
  "abstract-api",
  "anthropic",
  "deepseek",
  "grok",
  "perplexity",
  "replicate",
  "stability-ai",
  "suno",
  "mathpix",
  "deepgram",
  "alpha-vantage",
  "sec-edgar",
  "rentcast",
  "openweather",
  "diffbot",
  "builtwith",
  "hunter",
  "ipinfo",
  "whitepages",
  "ofac",
  "judge0",
  "mapbox",
  "brave",
  "coingecko",
  "deepl",
  "groq",
  "mistral",
  "screenshotone",
  "tavily",
  "virustotal",
  "wolframalpha",
  "billboard",
];

function requireAdmin(req: Request) {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return { ok: false as const, error: "ADMIN_SECRET is not set" };
  const got = req.headers.get("x-admin-secret") || "";
  if (!got || got !== expected) return { ok: false as const, error: "Unauthorized" };
  return { ok: true as const };
}

function parseProviderName(md: string, fallback: string) {
  const first = md.split("\n").find((l) => l.trim().startsWith("# "));
  if (!first) return fallback;
  const name = first.replace(/^#\s+/, "").replace(/\s+—\s+Wrapped API.*$/i, "").trim();
  return name || fallback;
}

function extractEndpoints(md: string, provider: string) {
  // Prefer URLs in curl examples: /api/wrapped/<provider>/<endpoint>
  const re = new RegExp(`api\\/wrapped\\/${provider}\\/([a-z0-9-]+)`, "gi");
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    if (m[1]) out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

function makeId(provider: string, endpoint: string) {
  return `${provider}_${endpoint}`.replace(/[^a-z0-9_]/gi, "_");
}

type Body = {
  provider?: string;
  providers?: string[];
  priceUsdc?: number;
};

export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: 401 });

  const { provider, providers, priceUsdc } = (await req.json().catch(() => ({}))) as Body;
  const list =
    (Array.isArray(providers) ? providers : provider ? [provider] : PROVIDERS).map((p) =>
      String(p).trim(),
    );

  const defaultPrice = typeof priceUsdc === "number" && priceUsdc > 0 ? priceUsdc : 0.01;

  const sb = supabaseServer();
  const locusBase = getLocusApiBase();
  const locusKey = getLocusApiKey();

  const results: Array<{ provider: string; endpoints: number; upserted: number }> = [];

  for (const p of list) {
    // Fetch provider markdown from Locus API (source of truth)
    const url = new URL(`${locusBase}/wrapped/md`);
    url.searchParams.set("provider", p);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${locusKey}` },
      cache: "no-store",
    });

    const md = await resp.text();
    if (!resp.ok) {
      results.push({ provider: p, endpoints: 0, upserted: 0 });
      continue;
    }

    const providerName = parseProviderName(md, p);
    const endpoints = extractEndpoints(md, p);

    // If task already exists with same provider+endpoint, reuse its id.
    const { data: existing } = await sb
      .from("tasks")
      .select("id, provider, endpoint")
      .eq("provider", p)
      .in("endpoint", endpoints);
    const existingMap = new Map<string, string>(
      (existing ?? []).map((t: any) => [`${t.provider}/${t.endpoint}`.toLowerCase(), t.id]),
    );

    const rows = endpoints.map((ep) => {
      const key = `${p}/${ep}`.toLowerCase();
      const id = existingMap.get(key) || makeId(p, ep);
      return {
        id,
        title: `${providerName} · ${ep}`,
        description: `Wrapped API endpoint: ${p}/${ep}`,
        price_usdc: defaultPrice,
        provider: p,
        endpoint: ep,
      };
    });

    const { error: upErr } = await sb.from("tasks").upsert(rows, { onConflict: "id" });
    if (upErr) {
      results.push({ provider: p, endpoints: endpoints.length, upserted: 0 });
    } else {
      results.push({ provider: p, endpoints: endpoints.length, upserted: rows.length });
    }
  }

  return NextResponse.json({ ok: true, results });
}
