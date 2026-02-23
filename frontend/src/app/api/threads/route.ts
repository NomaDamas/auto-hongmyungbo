import { ok } from "@/server/http";
import { listThreadsByPlatform } from "@/server/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limitPerPlatform") || "20");
  const grouped = listThreadsByPlatform(Number.isFinite(limit) ? limit : 20);
  return ok(Object.entries(grouped).map(([platform, items]) => ({ platform, items })));
}
