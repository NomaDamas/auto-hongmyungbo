import { boostPhraseChat, makeClient } from "@/server/llm";
import { fail, ok } from "@/server/http";

export const runtime = "nodejs";

const ALLOWED_LANG = new Set(["auto", "ko", "en"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      draft?: string;
      targetText?: string;
      instruction?: string;
      history?: Array<{ role?: "user" | "assistant"; text?: string }>;
      language?: "auto" | "ko" | "en";
      model?: string;
      provider?: "openai" | "openrouter" | "anthropic" | "grok" | "gemini";
      generationConfig?: {
        thinkingMode?: boolean;
        reasoningEffort?: string;
        temperature?: number;
        topP?: number;
        maxOutputTokens?: number;
      };
    };

    if (!body.draft?.trim()) return fail("draft is required", 400);
    if (!body.targetText?.trim()) return fail("targetText is required", 400);
    if (!body.instruction?.trim()) return fail("instruction is required", 400);
    const language = ALLOWED_LANG.has(body.language || "auto") ? body.language : "auto";
    const history: Array<{ role: "user" | "assistant"; text: string }> = (body.history || [])
      .map((h): { role: "user" | "assistant"; text: string } => ({
        role: h.role === "assistant" ? "assistant" : "user",
        text: String(h.text || ""),
      }))
      .filter((h) => h.text.trim());

    const llm = makeClient({ headers: request.headers, provider: body.provider, model: body.model });
    const result = await boostPhraseChat({
      client: llm,
      model: llm.model,
      draft: body.draft,
      targetText: body.targetText,
      instruction: body.instruction,
      history,
      language,
      generationConfig: body.generationConfig,
    });
    return ok(result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Phrase boost failed", 400);
  }
}
