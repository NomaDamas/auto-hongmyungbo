import { generatePlatformCard, makeClient } from "@/server/llm";
import { createCard, createDraft } from "@/server/store";
import { fail, ok } from "@/server/http";

export const runtime = "nodejs";

const ALLOWED_PLATFORMS = new Set(["reddit", "linkedin", "twitter", "instagram", "threads", "youtube", "tiktok"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft?: string;
      userProfile?: unknown;
      model?: string;
      platforms?: string[];
      language?: string;
      languageByPlatform?: Record<string, string>;
      provider?: "openai" | "openrouter";
      generationConfig?: {
        thinkingMode?: boolean;
        reasoningEffort?: string;
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
      };
    };
    if (!body.draft || !body.draft.trim()) return fail("draft is required", 400);
    const platforms = (body.platforms || []).filter((p): p is any => ALLOWED_PLATFORMS.has(p));
    const selectedPlatforms = platforms.length ? platforms : ["reddit", "linkedin", "twitter", "instagram", "threads", "youtube", "tiktok"];
    const llm = makeClient({ headers: request.headers, provider: body.provider, model: body.model });

    const cards = await Promise.all(
      selectedPlatforms.map(async (platform) => {
        const generated = await generatePlatformCard({
          client: llm,
          model: llm.model,
          platform,
          draft: body.draft!,
          language: body.languageByPlatform?.[platform] || body.language,
          userProfile: body.userProfile as any,
          generationConfig: body.generationConfig,
        });
        return { platform, ...generated };
      }),
    );

    const draftId = createDraft(body.draft);
    const persisted = cards.map((c) => {
      const id = createCard({
        draftId,
        platform: c.platform,
        title: c.title,
        body: c.body,
        suggestions: c.suggestions,
        status: "draft",
      });
      return { id, platform: c.platform, title: c.title, body: c.body, suggestions: c.suggestions, status: "draft" };
    });

    return ok({ draftId, cards: persisted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generate failed";
    return fail(msg, 400);
  }
}
