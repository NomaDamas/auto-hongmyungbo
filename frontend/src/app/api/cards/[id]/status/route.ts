import { fail, ok } from "@/server/http";
import { getCard, updateCardStatus } from "@/server/store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cardId = Number(id);
  if (!Number.isFinite(cardId)) return fail("Invalid card id", 400);

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  if (body.status !== "draft" && body.status !== "accepted" && body.status !== "rejected") {
    return fail("status must be draft|accepted|rejected", 400);
  }

  const card = updateCardStatus(cardId, body.status);
  if (!card) return fail("Card not found", 404);

  return ok({
    id: card.id,
    platform: card.platform,
    title: card.title,
    body: card.body,
    suggestions: card.suggestions,
    status: card.status,
  });
}
