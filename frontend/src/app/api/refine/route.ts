import { refineCard, makeClient } from "@/server/llm";
import { updateCardContent } from "@/server/store";
import { fail, ok } from "@/server/http";

export const runtime = "nodejs";

const ALLOWED_PLATFORMS = new Set(["reddit", "linkedin", "twitter", "instagram", "threads", "youtube", "tiktok"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cardId?: number;
      platform?: string;
      originalDraft?: string;
      currentContent?: string;
      feedback?: string;
      userProfile?: unknown;
      model?: string;
      language?: string;
      provider?: "openai" | "openrouter";
      generationConfig?: any;
    };
    if (!body.platform || !ALLOWED_PLATFORMS.has(body.platform)) return fail("Invalid platform", 400);
    if (!body.feedback?.trim()) return fail("feedback is required", 400);
    const llm = makeClient({ headers: request.headers, provider: body.provider, model: body.model });
    const updated = await refineCard({
      client: llm,
      model: llm.model,
      platform: body.platform as any,
      originalDraft: body.originalDraft || "",
      currentContent: body.currentContent || "",
      feedback: body.feedback,
      language: body.language,
      userProfile: body.userProfile as any,
      generationConfig: body.generationConfig,
    });

    if (typeof body.cardId === "number") {
      const card = updateCardContent(body.cardId, {
        title: updated.title,
        body: updated.body,
        suggestions: updated.suggestions,
        status: "draft",
      });
      if (card) {
        return ok({
          id: card.id,
          platform: card.platform,
          title: card.title,
          body: card.body,
          suggestions: card.suggestions,
          status: card.status,
        });
      }
    }

    return ok({
      id: body.cardId,
      platform: body.platform,
      title: updated.title,
      body: updated.body,
      suggestions: updated.suggestions,
      status: "draft",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Refine failed";
    return fail(msg, 400);
  }
}
