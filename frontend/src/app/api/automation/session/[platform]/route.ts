import { fail, ok } from "@/server/http";
import { checkBrowserLoginSession } from "@/server/browser-automation";

export const runtime = "nodejs";

const ALLOWED = new Set(["linkedin", "twitter", "instagram", "reddit", "threads", "youtube", "tiktok"]);

export async function GET(_request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!ALLOWED.has(platform)) return fail("Unsupported platform", 400);
  try {
    const result = await checkBrowserLoginSession(platform as any);
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Failed to check browser login session", 400);
  }
}
