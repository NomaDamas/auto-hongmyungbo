import { fail, ok } from "@/server/http";
import { openBrowserLoginSession } from "@/server/browser-automation";

export const runtime = "nodejs";

const ALLOWED = new Set(["linkedin", "twitter", "instagram", "reddit", "threads", "youtube", "tiktok"]);

export async function POST(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!ALLOWED.has(platform)) return fail("Unsupported platform", 400);
  try {
    const body = (await request.json().catch(() => ({}))) as { waitMs?: number };
    const result = await openBrowserLoginSession({
      platform: platform as any,
      waitMs: body.waitMs,
    });
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to open login automation", 400);
  }
}
