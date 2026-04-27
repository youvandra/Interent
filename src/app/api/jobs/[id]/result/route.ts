import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getBearerToken, tokenMatchesHash } from "@/lib/job_auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Missing Bearer token" }, { status: 401 });

  const { id } = await params;
  const sb = supabaseServer();
  const { data: job, error } = await sb
    .from("jobs")
    .select("id, status, result_json, error_message, job_token_hash")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!tokenMatchesHash(token, job.job_token_hash)) {
    return NextResponse.json({ error: "Invalid job token" }, { status: 403 });
  }

  if (job.status !== "DONE") {
    return NextResponse.json(
      { error: "Job not completed", status: job.status, details: job.error_message },
      { status: 409 },
    );
  }

  return NextResponse.json({ result: job.result_json });
}
