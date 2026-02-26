import type { GenerationConfig, Platform, UserProfile } from "@/lib/types";
type SupportedProvider = "openai" | "openrouter" | "anthropic" | "grok" | "gemini";
type GenerationConfigInput =
  | {
      thinkingMode?: boolean;
      reasoningEffort?: string;
      temperature?: number;
      topP?: number;
      maxOutputTokens?: number;
    }
  | undefined;

const STYLE_ANALYSIS_INSTRUCTIONS = `When reference posts are provided, perform deep style analysis before writing:
1. SENTENCE STRUCTURE: Average sentence length, use of fragments vs. complex sentences, paragraph rhythm.
2. VOCABULARY LEVEL: Casual/formal register, jargon density, slang usage.
3. VOICE & TONE: First-person vs. third-person, direct vs. hedging, confident vs. humble.
4. PUNCTUATION HABITS: Ellipsis, em-dashes, exclamation marks, emoji frequency.
5. EMOTIONAL TONE: Inspirational, analytical, humorous, vulnerable, provocative.
6. FORMATTING: Line breaks, bullet points, whitespace, capitalization patterns.
7. RHETORICAL PATTERNS: Questions, analogies, storytelling, data-driven arguments.

Your output must be indistinguishable from the reference author's writing. A reader should not be able to tell that a different person wrote it.`;

const PLATFORM_PROMPTS: Record<Platform, string> = {
  reddit: [
    "You are a Reddit post strategist and community writer.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "Reddit conventions:",
    "- Titles are critical: concise, curiosity-driven, avoid clickbait.",
    "- Body should feel authentic and invite discussion.",
    "- Use paragraph breaks for readability. Avoid walls of text.",
    "- End with a question or open discussion point when appropriate.",
    "- Avoid corporate/marketing language. Sound like a real person.",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
  linkedin: [
    "You are a LinkedIn ghostwriter and professional thought leader.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "LinkedIn conventions:",
    "- Open with a strong hook line (the first 2 lines are visible before 'see more').",
    "- Use short paragraphs (1-3 sentences each) with line breaks between them.",
    "- Professional but human tone — avoid jargon-heavy corporate speak.",
    "- Include a clear takeaway or actionable insight.",
    "- End with a CTA or reflective question to drive engagement.",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
  twitter: [
    "You are an X (Twitter) copywriter and thread strategist.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "X conventions:",
    "- 280-character limit per tweet. Be concise and high-impact.",
    "- Front-load the hook. First 5 words determine if people read on.",
    "- Use line breaks for emphasis. Short punchy sentences.",
    "- For threads: each tweet should standalone while advancing the narrative.",
    "- Avoid hashtag spam. 0-2 relevant hashtags max.",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
  instagram: [
    "You are an Instagram caption writer and visual storyteller.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "Instagram conventions:",
    "- First line is the hook (visible before 'more').",
    "- Use line breaks and emoji strategically for scannability.",
    "- Captions can be longer but must feel conversational.",
    "- Include a CTA (save, share, comment, link in bio).",
    "- Hashtags: group at the end or in first comment (suggest in suggestions).",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
  threads: [
    "You are a Threads writer optimized for conversational engagement.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "Threads conventions:",
    "- Short, conversational, opinion-driven posts perform best.",
    "- 500-character sweet spot. Be concise but add personality.",
    "- Hot takes, relatable observations, and questions drive replies.",
    "- Minimal formatting. No hashtags unless essential.",
    "- Sound like a real person texting a friend, not a brand.",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
  youtube: [
    "You are a YouTube community post writer and audience engagement specialist.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "YouTube community post conventions:",
    "- Strong hook in the first line to stop the scroll.",
    "- Keep it conversational and direct — you're talking to subscribers.",
    "- Use polls, questions, or teasers to drive engagement.",
    "- Clear CTA (watch, comment, subscribe, check pinned).",
    "- Emojis are acceptable but don't overdo it.",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
  tiktok: [
    "You are a TikTok caption writer and trend-savvy content strategist.",
    "",
    STYLE_ANALYSIS_INSTRUCTIONS,
    "",
    "TikTok conventions:",
    "- Ultra-short captions (150 chars ideal). The video is the content.",
    "- Hook with curiosity, humor, or controversy.",
    "- Trending sounds/formats awareness in suggestions.",
    "- 3-5 relevant hashtags including niche + trending mix.",
    "- Gen-Z/millennial casual tone. Be authentic, not polished.",
    "",
    "Return strict JSON with keys: title, body, suggestions.",
  ].join("\n"),
};

function parseJson<T>(raw: string | null | undefined): T {
  const text = (raw || "").trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = match ? match[1].trim() : text;
  return JSON.parse(payload || "{}");
}

function pickProvider(model: string, preferred?: string): SupportedProvider {
  const p = (preferred || "").toLowerCase();
  if (p === "anthropic") return "anthropic";
  if (p === "grok") return "grok";
  if (p === "gemini") return "gemini";
  if (p === "openrouter") return "openrouter";
  if (p === "openai") return "openai";
  if ((model || "").includes("/")) return "openrouter";
  return process.env.OPENROUTER_API_KEY ? "openrouter" : "openai";
}

export function getModel(preferredModel: string | undefined, provider: SupportedProvider): string {
  if (preferredModel && preferredModel.trim()) return preferredModel.trim();
  if (provider === "openrouter") return "openai/gpt-4o-mini";
  if (provider === "anthropic") return "claude-3-5-sonnet-latest";
  if (provider === "grok") return "grok-3-mini-fast";
  if (provider === "gemini") return "gemini-2.0-flash";
  return "gpt-4o-mini";
}

export function availableProvidersFromHeaders(headers: Headers): SupportedProvider[] {
  const out = new Set<SupportedProvider>();
  if (process.env.OPENAI_API_KEY || headers.get("x-openai-api-key")) out.add("openai");
  if (process.env.OPENROUTER_API_KEY || headers.get("x-openrouter-api-key")) out.add("openrouter");
  if (process.env.ANTHROPIC_API_KEY || headers.get("x-anthropic-api-key")) out.add("anthropic");
  if (process.env.GROK_API_KEY || process.env.XAI_API_KEY || headers.get("x-grok-api-key")) out.add("grok");
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || headers.get("x-gemini-api-key")) out.add("gemini");
  if (!out.size) out.add("openai");
  return [...out];
}

export function makeClient(opts: { headers: Headers; provider?: string; model?: string }): {
  provider: SupportedProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
} {
  const provider = pickProvider(opts.model || "", opts.provider);
  const openaiKey = (opts.headers.get("x-openai-api-key") || process.env.OPENAI_API_KEY || "").trim();
  const openrouterKey = (opts.headers.get("x-openrouter-api-key") || process.env.OPENROUTER_API_KEY || "").trim();
  const anthropicKey = (opts.headers.get("x-anthropic-api-key") || process.env.ANTHROPIC_API_KEY || "").trim();
  const grokKey = (opts.headers.get("x-grok-api-key") || process.env.GROK_API_KEY || process.env.XAI_API_KEY || "").trim();
  const geminiKey = (opts.headers.get("x-gemini-api-key") || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

  if (provider === "openrouter") {
    if (!openrouterKey) throw new Error("OpenRouter API key is not configured");
    return {
      provider,
      model: getModel(opts.model, provider),
      apiKey: openrouterKey,
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }

  if (provider === "anthropic") {
    if (!anthropicKey) throw new Error("Anthropic API key is not configured");
    return {
      provider,
      model: getModel(opts.model, provider),
      apiKey: anthropicKey,
      baseUrl: "https://api.anthropic.com",
    };
  }
  if (provider === "grok") {
    if (!grokKey) throw new Error("Grok (xAI) API key is not configured");
    return {
      provider,
      model: getModel(opts.model, provider),
      apiKey: grokKey,
      baseUrl: "https://api.x.ai/v1",
    };
  }
  if (provider === "gemini") {
    if (!geminiKey) throw new Error("Gemini API key is not configured");
    return {
      provider,
      model: getModel(opts.model, provider),
      apiKey: geminiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    };
  }
  if (!openaiKey) throw new Error("OpenAI API key is not configured");
  return {
    provider: "openai",
    model: getModel(opts.model, "openai"),
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
  provider?: SupportedProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  generationConfig?: GenerationConfigInput;
}): Promise<unknown> {
  if (input.provider === "anthropic") {
    const res = await fetch(`${input.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: Math.max(128, Math.round(input.generationConfig?.maxOutputTokens ?? 1500)),
        temperature: Math.max(0, Math.min(2, input.generationConfig?.temperature ?? 0.7)),
        top_p: Math.max(0, Math.min(1, input.generationConfig?.topP ?? 1)),
        system: `${input.system}\n\nReturn strict JSON only.`,
        messages: [{ role: "user", content: input.user }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`LLM request failed: ${res.status} ${t}`);
    }
    const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    return parseJson(json.content?.find((b) => b.type === "text")?.text);
  }

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

  const sections: string[] = [];

  if (style.customInstructions?.trim()) {
    sections.push([
      "=== CUSTOM INSTRUCTIONS (HIGHEST PRIORITY) ===",
      "The following instructions override all other style guidance.",
      style.customInstructions.trim(),
    ].join("\n"));
  }

  if (style.referencePosts?.length) {
    const posts = style.referencePosts.slice(0, 5);
    const numbered = posts.map((p, i) => `--- Reference Post ${i + 1} ---\n${p.trim()}`).join("\n\n");
    sections.push([
      "=== REFERENCE POSTS (STYLE SOURCE) ===",
      `${posts.length} reference post(s) provided. Analyze these deeply:`,
      "- Identify the author's unique voice, sentence rhythm, and word choices.",
      "- Note their formatting habits (line breaks, emoji, punctuation).",
      "- Detect emotional tone and rhetorical strategies.",
      "- Your output must replicate this author's style so faithfully that the original author would recognize it as their own.",
      "",
      numbered,
    ].join("\n"));
  }

  if (style.mode === "auto" && style.extractedTone?.trim()) {
    sections.push([
      "=== EXTRACTED TONE PROFILE ===",
      style.extractedTone.trim(),
    ].join("\n"));
  }

  return sections.join("\n\n") || "No additional style constraints.";
}

export async function generatePlatformCard(input: {
  client: { provider?: SupportedProvider; baseUrl: string; apiKey: string };
  model: string;
  platform: Platform;
  draft: string;
  language?: string;
  userProfile?: UserProfile;
  generationConfig?: GenerationConfigInput;
}): Promise<{ title: string; body: string; suggestions: string[] }> {
  const hasRefPosts = !!input.userProfile?.styles?.[input.platform]?.referencePosts?.length;
  const priorityBlock = hasRefPosts
    ? [
        "Priority (strict order):",
        "1) STYLE MATCH: Replicate the reference author's voice, rhythm, vocabulary, and formatting. A reader must not detect a different writer.",
        "2) USER INTENT: Preserve the core meaning and message of the draft.",
        "3) PLATFORM FIT: Adapt to platform conventions without breaking style.",
        "4) ENGAGEMENT: Optimize hook and CTA within the matched style.",
      ]
    : [
        "Priority:",
        "1) Keep user intent and core meaning.",
        "2) Write in a natural, engaging voice appropriate for the platform.",
        "3) Fit platform conventions.",
        "4) Optimize hook and CTA for engagement.",
      ];

  const userPrompt = [
    `Target platform: ${input.platform}`,
    `Output language: ${input.language || "same as input"}`,
    "Draft:",
    input.draft,
    "Style constraints:",
    styleBlock(input.platform, input.userProfile),
    ...priorityBlock,
    "Return strict JSON: {\"title\":\"...\",\"body\":\"...\",\"suggestions\":[\"...\"]}",
  ].join("\n\n");

  const parsed = (await chatJson({
    provider: input.client.provider,
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
  client: { provider?: SupportedProvider; baseUrl: string; apiKey: string };
  model: string;
  platform: Platform;
  originalDraft: string;
  currentContent: string;
  feedback: string;
  language?: string;
  userProfile?: UserProfile;
  generationConfig?: GenerationConfigInput;
}): Promise<{ title: string; body: string; suggestions: string[] }> {
  const hasRefPosts = !!input.userProfile?.styles?.[input.platform]?.referencePosts?.length;
  const priorityBlock = hasRefPosts
    ? [
        "Priority (strict order):",
        "1) FEEDBACK: Apply user feedback exactly as requested.",
        "2) STYLE MATCH: Maintain the reference author's voice and writing patterns. The result must still read as if the reference author wrote it.",
        "3) PLATFORM FIT: Keep platform-native readability and conventions.",
        "4) ENGAGEMENT: Preserve hook strength and CTA clarity.",
      ]
    : [
        "Priority:",
        "1) Apply user feedback exactly.",
        "2) Preserve style signal from constraints.",
        "3) Keep platform-native readability.",
        "4) Maintain engagement quality.",
      ];

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
    ...priorityBlock,
    "Return strict JSON: {\"title\":\"...\",\"body\":\"...\",\"suggestions\":[\"...\"]}",
  ].join("\n\n");

  const parsed = (await chatJson({
    provider: input.client.provider,
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
  client: { provider?: SupportedProvider; baseUrl: string; apiKey: string };
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
    "Primary goal: organize the user's messy draft into a clear, logical structure.",
    "Do not invent facts. If key facts are missing, ask concise questions.",
    "Do NOT produce many ideas. Keep suggestions minimal and focused.",
    "Prioritize coherence and argument flow over creativity.",
    langInstruction,
    "Return strict JSON:",
    "{",
    '  "brief": { "title?": "string", "coreMessage": "string", "audienceAssumption": "string", "keyPoints": ["3-5"], "cta": "string", "hashtags?": ["string"] },',
    '  "questions": [{ "id": "string", "question": "string", "choices?": ["string"] }],',
    '  "angles": [{ "id": "string", "label": "string", "preview": "string", "draftSnippet?": "string" }],',
    '  "attentionGuide": { "strongestHook": "string", "hookOptions": ["<=3"], "ctaOptions": ["<=3"], "riskNotes": ["<=3"] },',
    '  "polishedDraft": "string"',
    "}",
    "Constraints:",
    "- questions: max 2",
    "- angles: max 2",
    "- keep each angle practical and close to the user's original intent",
    "- polishedDraft must be clearly structured, not one long block",
    "- polishedDraft format (plain text) should include section labels in this order:",
    "  [Hook]",
    "  [Core Message]",
    "  [Key Points]",
    "  - point 1",
    "  - point 2",
    "  - point 3",
    "  [Body]",
    "  [CTA]",
    "- Body should be 2-4 short paragraphs with natural flow",
    "- Keep concise and practical",
    `Platforms: ${(input.platforms || []).join(", ") || "not specified"}`,
    `Answers: ${JSON.stringify(input.answers || {})}`,
    "Raw draft:",
    input.rawDraft,
  ].join("\n");

  return chatJson({
    provider: input.client.provider,
    baseUrl: input.client.baseUrl,
    apiKey: input.client.apiKey,
    model: input.model,
    system: "You produce valid JSON only.",
    user: prompt,
    generationConfig: input.generationConfig,
  });
}
