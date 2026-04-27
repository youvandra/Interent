import { sha256Hex } from "@/lib/auth";

export function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function tokenMatchesHash(token: string, expectedHash: string) {
  return sha256Hex(token) === expectedHash;
}

