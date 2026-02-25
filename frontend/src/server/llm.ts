import type { GenerationConfig, Platform, UserProfile } from "@/lib/types";
type GenerationConfigInput =
  | {
      thinkingMode?: boolean;
      reasoningEffort?: string;
      temperature?: number;
      topP?: number;
      maxOutputTokens?: number;
    }
  | undefined;

const PLATFORM_PROMPTS: Record<Platform, string> = {
  reddit:
    "You are a Reddit post strategist. Return JSON with keys: title, body, suggestions. Tone: discussion-driven, community-friendly.",
  linkedin:
    "You are a LinkedIn ghostwriter. Return JSON with keys: title, body, suggestions. Tone: professional and practical with concise paragraphs.",
  twitter:
    "You are an X copywriter. Return JSON with keys: title, body, suggestions. Make a concise, high-impact post or short thread.",
  instagram:
    "You are an Instagram caption writer. Return JSON with keys: title, body, suggestions. Keep it visual and engaging.",
  threads:
    "You are a Threads writer. Return JSON with keys: title, body, suggestions. Keep it conversational and concise.",
  youtube:
    "You are a YouTube community post writer. Return JSON with keys: title, body, suggestions. Use strong hook and clear CTA.",
  tiktok:
    "You are a TikTok caption writer. Return JSON with keys: title, body, suggestions. Keep it short, punchy, trend-aware.",
};

function parseJson<T>(raw: string | null | undefined): T {
  const text = (raw || "").trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = match ? match[1].trim() : text;
  return JSON.parse(payload || "{}");
}

function pickProvider(model: string, preferred?: string): "openai" | "openrouter" {
  const p = (preferred || "").toLowerCase();
  if (p === "openrouter") return "openrouter";
  if (p === "openai") return "openai";
  if ((model || "").includes("/")) return "openrouter";
  return process.env.OPENROUTER_API_KEY ? "openrouter" : "openai";
}

export function getModel(preferredModel: string | undefined, provider: "openai" | "openrouter"): string {
  if (preferredModel && preferredModel.trim()) return preferredModel.trim();
  return provider === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini";
}

export function availableProvidersFromHeaders(headers: Headers): Array<"openai" | "openrouter"> {
  const out = new Set<"openai" | "openrouter">();
  if (process.env.OPENAI_API_KEY || headers.get("x-openai-api-key")) out.add("openai");
  if (process.env.OPENROUTER_API_KEY || headers.get("x-openrouter-api-key")) out.add("openrouter");
  if (!out.size) out.add("openai");
  return [...out];
}

export function makeClient(opts: { headers: Headers; provider?: string; model?: string }): {
  provider: "openai" | "openrouter";
  model: string;
  apiKey: string;
  baseUrl: string;
} {
  const provider = pickProvider(opts.model || "", opts.provider);
  const openaiKey = (opts.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY || "").trim();
  const openrouterKey = (opts.headers.get("x-openrouter-api-key") || process.env.OPENROUTER_API_KEY || "").trim();

  if (provider === "openrouter") {
    if (!openrouterKey) throw new Error("OpenRouter API key is not configured");
    return {
      provider,
      model: getModel(opts.model, provider),
      apiKey: openrouterKey,
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }

  if (!openaiKey) throw new Error("OpenAI API key is not configured");
  return {
    provider,
    model: getModel(opts.model, provider),
    apiKey: openaiKey,
    baseUrl: "https://api.openai.com/v1",
  };
}

function generationOpts(config: GenerationConfigInput): { temperature: number; top_p: number; max_tokens: number } {
  return {
    temperature: Math.max(0, Math.min(2, config?.temperature ?? 0.7)),
    top_p: Math.max(0, Math.min(1, config?.topP ?? 1)),
    max_tokens: Math.max(128, Math.round(config?.maxOutputTokens ?? 1500)),
  };
}

async function chatJson(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  generationConfig?: GenerationConfigInput;
}): Promise<unknown> {
  const res = await fetch(`${input.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      response_format: { type: "json_object" },
      ...generationOpts(input.generationConfig),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM request failed: ${res.status} ${t}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseJson(json.choices?.[0]?.message?.content);
}

function styleBlock(platform: Platform, profile?: UserProfile): string {
  const style = profile?.styles?.[platform];
  if (!style) return "No additional style constraints.";
  const chunks: string[] = [];
  if (style.mode === "auto" && style.extractedTone?.trim()) {
    chunks.push(`Extracted tone to preserve: ${style.extractedTone.trim()}`);
  }
  if (style.customInstructions?.trim()) chunks.push(style.customInstructions.trim());
  if (style.referencePosts?.length) chunks.push("Reference posts:\n" + style.referencePosts.slice(0, 3).join("\n---\n"));
  return chunks.join("\n\n") || "No additional style constraints.";
}

export async function generatePlatformCard(input: {
  client: { baseUrl: string; apiKey: string };
  model: string;
  platform: Platform;
  draft: string;
  language?: string;
  userProfile?: UserProfile;
  generationConfig?: GenerationConfigInput;
}): Promise<{ title: string; body: string; suggestions: string[] }> {
  const userPrompt = [
    `Target platform: ${input.platform}`,
    `Output language: ${input.language || "same as input"}`,
    "Draft:",
    input.draft,
    "Style constraints:",
    styleBlock(input.platform, input.userProfile),
    "Priority:",
    "1) Keep user intent and core meaning.",
    "2) Transfer the writing style faithfully (voice, rhythm, phrasing).",
    "3) Fit platform conventions.",
    "Return strict JSON: {\"title\":\"...\",\"body\":\"...\",\"suggestions\":[\"...\"]}",
  ].join("\n\n");

  const parsed = (await chatJson({
    baseUrl: input.client.baseUrl,
    apiKey: input.client.apiKey,
    model: input.model,
    system: PLATFORM_PROMPTS[input.platform],
    user: userPrompt,
    generationConfig: input.generationConfig,
  })) as { title?: string; body?: string; suggestions?: string[] };

  return {
    title: parsed.title || `${input.platform} draft`,
    body: parsed.body || "",
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["Strengthen hook", "Clarify CTA"],
  };
}

export async function refineCard(input: {
  client: { baseUrl: string; apiKey: string };
  model: string;
  platform: Platform;
  originalDraft: string;
  currentContent: string;
  feedback: string;
  language?: string;
  userProfile?: UserProfile;
  generationConfig?: GenerationConfigInput;
}): Promise<{ title: string; body: string; suggestions: string[] }> {
  const prompt = [
    `Platform: ${input.platform}`,
    `Output language: ${input.language || "same as input"}`,
    "Original draft:",
    input.originalDraft,
    "Current generated content:",
    input.currentContent,
    "User feedback:",
    input.feedback,
    "Style constraints:",
    styleBlock(input.platform, input.userProfile),
    "Priority:",
    "1) Apply user feedback exactly.",
    "2) Preserve style signal from constraints/reference posts.",
    "3) Keep platform-native readability.",
    "Return strict JSON: {\"title\":\"...\",\"body\":\"...\",\"suggestions\":[\"...\"]}",
  ].join("\n\n");

  const parsed = (await chatJson({
    baseUrl: input.client.baseUrl,
    apiKey: input.client.apiKey,
    model: input.model,
    system: PLATFORM_PROMPTS[input.platform],
    user: prompt,
    generationConfig: input.generationConfig,
  })) as { title?: string; body?: string; suggestions?: string[] };

  return {
    title: parsed.title || `${input.platform} draft`,
    body: parsed.body || "",
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : ["Tighten structure", "Sharpen CTA"],
  };
}

export async function refineIdeaDraft(input: {
  client: { baseUrl: string; apiKey: string };
  model: string;
  rawDraft: string;
  language?: "auto" | "ko" | "en";
  platforms?: string[];
  answers?: Record<string, string>;
  generationConfig?: GenerationConfigInput;
}): Promise<unknown> {
  const langInstruction =
    input.language === "ko"
      ? "Return all fields in Korean."
      : input.language === "en"
        ? "Return all fields in English."
        : "Use the dominant language from draft.";
  const prompt = [
    "You are a senior writing coach.",
    "Do not invent facts. If missing, ask concise questions.",
    langInstruction,
    "Return strict JSON:",
    "{",
    '  "brief": { "title?": "string", "coreMessage": "string", "audienceAssumption": "string", "keyPoints": ["3-5"], "cta": "string", "hashtags?": ["string"] },',
    '  "questions": [{ "id": "string", "question": "string", "choices?": ["string"] }],',
    '  "angles": [{ "id": "string", "label": "string", "preview": "string", "draftSnippet?": "string" }],',
    '  "attentionGuide": { "strongestHook": "string", "hookOptions": ["<=3"], "ctaOptions": ["<=3"], "riskNotes": ["<=3"] },',
    '  "polishedDraft": "string"',
    "}",
    `Platforms: ${(input.platforms || []).join(", ") || "not specified"}`,
    `Answers: ${JSON.stringify(input.answers || {})}`,
    "Raw draft:",
    input.rawDraft,
  ].join("\n");

  return chatJson({
    baseUrl: input.client.baseUrl,
    apiKey: input.client.apiKey,
    model: input.model,
    system: "You produce valid JSON only.",
    user: prompt,
    generationConfig: input.generationConfig,
  });
}
