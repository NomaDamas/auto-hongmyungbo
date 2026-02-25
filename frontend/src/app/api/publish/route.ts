import { fail, ok } from "@/server/http";
import { addPublishLog, createJob, getOAuthToken, listCardsForDraft, updateJob } from "@/server/store";
import { publishToPlatform } from "@/server/publishers";
import { publishByBrowser } from "@/server/browser-automation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draftId: number;
      cardIds?: number[];
      acceptedOnly?: boolean;
      scheduledAt?: string;
      publishMode?: "api" | "browser" | "hybrid";
    };
    if (!body?.draftId) return fail("draftId is required", 400);

    const cards = listCardsForDraft(body.draftId);
    const ids = new Set((body.cardIds || []).filter((x) => Number.isFinite(x)));
    const selected = cards.filter((c) => {
      if (ids.size && !ids.has(c.id)) return false;
      if (body.acceptedOnly && c.status !== "accepted") return false;
      return true;
    });

    const job = createJob("publish", {
      draftId: body.draftId,
      cardIds: body.cardIds || [],
      acceptedOnly: Boolean(body.acceptedOnly),
      scheduledAt: body.scheduledAt,
      publishMode: body.publishMode || "browser",
    });

    const published = [];
    const failed = [];
    const mode = body.publishMode || "browser";
    for (const card of selected) {
      let result: { ok: boolean; postId?: string; url?: string; error?: string } | null = null;
      if (mode === "browser") {
        result = await publishByBrowser({ platform: card.platform as any, title: card.title, body: card.body });
      } else if (mode === "hybrid") {
        const browserResult = await publishByBrowser({ platform: card.platform as any, title: card.title, body: card.body });
        if (browserResult.ok) {
          result = browserResult;
        }
      }

      if ((!result || !result.ok) && mode !== "browser") {
        const token = getOAuthToken(card.platform);
        if (token?.accessToken) {
          const apiResult = await publishToPlatform({ card, token });
          if (result && !result.ok && !apiResult.ok) {
            result = { ok: false, error: `${result.error}; api: ${apiResult.error}` };
          } else {
            result = apiResult;
          }
        } else {
          result = { ok: false, error: `${card.platform} is not connected (missing OAuth token).` };
        }
      }

      if (result?.ok) {
        addPublishLog({
          draftId: body.draftId,
          cardId: card.id,
          platform: card.platform,
          title: card.title,
          body: card.body,
          postId: result.postId,
          postUrl: result.url,
          status: "success",
        });
        published.push({ platform: card.platform, cardId: card.id, postId: result.postId, url: result.url });
      } else {
        const errorText = result?.error || "publish failed";
        addPublishLog({
          draftId: body.draftId,
          cardId: card.id,
          platform: card.platform,
          title: card.title,
          body: card.body,
          status: "failed",
          errorText,
        });
        failed.push({ platform: card.platform, cardId: card.id, error: errorText });
      }
    }

    updateJob(job.id, {
      status: failed.length ? "failed" : "done",
      result: { published, failed, count: published.length, total: selected.length },
      error: failed.length ? `${failed.length} platform(s) failed` : null,
    });

    return ok({ jobId: job.id, status: failed.length ? "failed" : "done" });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Publish failed", 400);
  }
}
