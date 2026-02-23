import { ok } from "@/server/http";
import { listPublishLogs } from "@/server/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") || "100");
  return ok(listPublishLogs(Number.isFinite(limit) ? limit : 100));
}
