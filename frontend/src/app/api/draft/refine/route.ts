import { makeClient, refineIdeaDraft } from "@/server/llm";
import { fail, ok } from "@/server/http";

export const runtime = "nodejs";

const ALLOWED_PLATFORMS = new Set(["reddit", "linkedin", "twitter", "instagram", "threads", "youtube", "tiktok"]);
const ALLOWED_LANG = new Set(["auto", "ko", "en"]);

function ensureStructuredPolishedDraft(input: any): string {
  const draft = String(input?.polishedDraft || "").trim();
  const hasSections = ["[Hook]", "[Core Message]", "[Key Points]", "[Body]", "[CTA]"].every((section) =>
    draft.includes(section),
  );
  if (hasSections) return draft;

  const brief = input?.brief || {};
  const keyPoints = Array.isArray(brief.keyPoints) ? brief.keyPoints.slice(0, 5) : [];
  const body = draft || brief.coreMessage || "";

  return [
    "[Hook]",
    brief.title ? String(brief.title) : String(brief.coreMessage || ""),
    "",
    "[Core Message]",
    String(brief.coreMessage || ""),
    "",
    "[Key Points]",
    ...(keyPoints.length ? keyPoints.map((point: string) => `- ${point}`) : ["- Clarify your strongest point", "- Add one concrete example", "- End with a clear action"]),
    "",
    "[Body]",
    body,
    "",
    "[CTA]",
    String(brief.cta || "Invite one specific response from readers."),
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      rawDraft?: string;
      language?: "auto" | "ko" | "en";
      platforms?: string[];
      context?: { answers?: Record<string, string> };
      model?: string;
      provider?: "openai" | "openrouter";
      generationConfig?: any;
    };
    if (!body.rawDraft?.trim()) return fail("rawDraft is required", 400);
    const language = ALLOWED_LANG.has(body.language || "auto") ? body.language : "auto";
    const platforms = (body.platforms || []).filter((p): p is any => ALLOWED_PLATFORMS.has(p));

    const llm = makeClient({ headers: request.headers, provider: body.provider, model: body.model });
    const raw = await refineIdeaDraft({
      client: llm,
      model: llm.model,
      rawDraft: body.rawDraft,
      language,
      platforms,
      answers: body.context?.answers,
      generationConfig: body.generationConfig,
    });

    const parsed = raw as any;
    if (!parsed || typeof parsed !== "object") return fail("Invalid refinement JSON", 502);
    if (!parsed.brief || !parsed.polishedDraft || !Array.isArray(parsed.angles) || !Array.isArray(parsed.questions)) {
      return fail("Invalid refinement JSON shape", 502);
    }
    const normalized: any = {
      ...parsed,
      brief: {
        ...parsed.brief,
        keyPoints: Array.isArray(parsed.brief.keyPoints) ? parsed.brief.keyPoints.slice(0, 5) : [],
      },
      questions: parsed.questions.slice(0, 2),
      angles: parsed.angles.slice(0, 2),
    };

    if (normalized.brief.keyPoints.length < 3) {
      normalized.brief.keyPoints = [...normalized.brief.keyPoints, "Clarify your strongest point", "Add one concrete example"].slice(0, 3);
    }
    if (!normalized.attentionGuide) {
      normalized.attentionGuide = {
        strongestHook: "Start with one concrete pain point your audience already feels.",
        hookOptions: [
          "Ask a sharp question tied to a real pain point.",
          "Share one surprising but believable insight first.",
          "Open with a short before/after contrast.",
        ],
        ctaOptions: [
          "Ask for one specific opinion in comments.",
          "Invite readers to share their current approach.",
          "Offer a simple next step they can try today.",
        ],
        riskNotes: [
          "Avoid over-claiming results without evidence.",
          "Keep the first two lines concrete and specific.",
          "Do not overload with too many topics in one post.",
        ],
      };
    }
    normalized.polishedDraft = ensureStructuredPolishedDraft(normalized);

    return ok(normalized);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Draft refine failed", 400);
  }
}
