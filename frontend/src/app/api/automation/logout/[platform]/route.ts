import { fail, ok } from "@/server/http";
import { clearBrowserLoginSession } from "@/server/browser-automation";

export const runtime = "nodejs";

const ALLOWED = new Set(["linkedin", "twitter", "instagram", "reddit", "threads", "youtube", "tiktok"]);

export async function POST(_request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!ALLOWED.has(platform)) return fail("Unsupported platform", 400);
  try {
    await clearBrowserLoginSession(platform as any);
    return ok({ ok: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to clear browser login session", 400);
  }
}
