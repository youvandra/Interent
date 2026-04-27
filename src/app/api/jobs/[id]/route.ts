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
    .select("id, task_id, status, created_at, paid_at, completed_at, error_message, job_token_hash, input_json, result_json")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (!tokenMatchesHash(token, job.job_token_hash)) {
    return NextResponse.json({ error: "Invalid job token" }, { status: 403 });
  }

  return NextResponse.json({
    jobId: job.id,
    taskId: job.task_id,
    status: job.status,
    createdAt: job.created_at,
    paidAt: job.paid_at,
    completedAt: job.completed_at,
    error: job.error_message,
    inputJson: job.input_json,
    resultJson: job.result_json,
  });
}
