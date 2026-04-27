import crypto from "crypto";

export function randomToken(prefix = "interent_live_") {
  // 32 bytes -> 64 hex chars
  const raw = crypto.randomBytes(32).toString("hex");
  return `${prefix}${raw}`;
}

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

