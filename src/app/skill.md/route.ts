import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const skillPath = path.join(process.cwd(), "skill.md");
  const content = await readFile(skillPath, "utf8");
  return new NextResponse(content, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      // Keep fresh so agents always see the latest guide.
      "cache-control": "no-store",
    },
  });
}

