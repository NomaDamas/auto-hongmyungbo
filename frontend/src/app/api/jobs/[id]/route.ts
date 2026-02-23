import { fail, ok } from "@/server/http";
import { getJob } from "@/server/store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(Number(id));
  if (!job) return fail("Job not found", 404);
  return ok({
    id: job.id,
    type: job.type,
    status: job.status,
    payload: job.payload,
    result: job.result,
    error: job.error,
  });
}
