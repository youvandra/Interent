import { NextResponse } from "next/server";

type Body = { code?: string };

export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as Body;
  const expected = process.env.PROMO_CODE || "";
  const ok =
    Boolean(expected) &&
    typeof code === "string" &&
    code.trim().length > 0 &&
    code.trim().toUpperCase() === expected.trim().toUpperCase();

  return NextResponse.json({ valid: ok });
}

