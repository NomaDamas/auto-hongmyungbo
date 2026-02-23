import { fail, ok } from "@/server/http";
import { addPublishLog, createJob, getCard, listCardsForDraft, updateJob } from "@/server/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draftId: number;
      cardIds?: number[];
      acceptedOnly?: boolean;
      scheduledAt?: string;
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
    });

    const published = selected.map((card) => {
      const result = {
        ok: true,
        postId: `${card.platform}_${Date.now()}_${card.id}`,
        url: `https://local.${card.platform}.mock/post/${card.id}`,
      };
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
      return result;
    });

    updateJob(job.id, { status: "done", result: { published, count: published.length }, error: null });

    return ok({ jobId: job.id, status: "done" });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Publish failed", 400);
  }
}
