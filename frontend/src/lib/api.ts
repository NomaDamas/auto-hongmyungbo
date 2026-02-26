import type {
  DomLlmProvider,
  DraftRefineLanguage,
  DraftRefineResponse,
  GenerateResponse,
  GeneratedCard,
  GenerationConfig,
  LanguageOption,
  ModelOption,
  PerPlatformLanguageMap,
  PhraseBoostResponse,
  Platform,
  ProviderOption,
  PublishJob,
  PublishLogItem,
  SocialThread,
  SetupStatus,
  UserProfile,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
let runtimeOpenAIKey = "";
let runtimeOpenRouterKey = "";
let runtimeDomLlmProvider: DomLlmProvider = "openai";
let runtimeDomLlmApiKeys: Partial<Record<DomLlmProvider, string>> = {};

export function configureRuntimeApiKeys(keys: { openaiApiKey?: string; openrouterApiKey?: string }) {
  runtimeOpenAIKey = (keys.openaiApiKey || "").trim();
  runtimeOpenRouterKey = (keys.openrouterApiKey || "").trim();
}

export function configureDomLlm(provider: DomLlmProvider, apiKeys: Partial<Record<DomLlmProvider, string>>) {
  runtimeDomLlmProvider = provider;
  runtimeDomLlmApiKeys = apiKeys;
}

function mergeHeaders(initHeaders?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!initHeaders) return headers;
  if (Array.isArray(initHeaders)) {
    for (const [k, v] of initHeaders) headers[k] = v;
    return headers;
  }
  if (initHeaders instanceof Headers) {
    initHeaders.forEach((v, k) => {
      headers[k] = v;
    });
    return headers;
  }
  return { ...initHeaders };
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const mergedHeaders = mergeHeaders(init?.headers);
  if (runtimeOpenAIKey) mergedHeaders["x-openai-api-key"] = runtimeOpenAIKey;
  if (runtimeOpenRouterKey) mergedHeaders["x-openrouter-api-key"] = runtimeOpenRouterKey;
  if (runtimeDomLlmApiKeys.anthropic) mergedHeaders["x-anthropic-api-key"] = runtimeDomLlmApiKeys.anthropic;
  if (runtimeDomLlmApiKeys.grok) mergedHeaders["x-grok-api-key"] = runtimeDomLlmApiKeys.grok;
  if (runtimeDomLlmApiKeys.gemini) mergedHeaders["x-gemini-api-key"] = runtimeDomLlmApiKeys.gemini;
  if (runtimeDomLlmProvider) mergedHeaders["x-dom-llm-provider"] = runtimeDomLlmProvider;
  const domKey = runtimeDomLlmApiKeys[runtimeDomLlmProvider];
  if (domKey) mergedHeaders["x-dom-llm-api-key"] = domKey;

  return fetch(input, {
    credentials: "include",
    ...init,
    headers: mergedHeaders,
  });
}

export async function generatePosts(
  draft: string,
  userProfile?: UserProfile,
  model?: ModelOption,
  platforms?: Platform[],
  language?: LanguageOption,
  languageByPlatform?: PerPlatformLanguageMap,
  provider?: ProviderOption,
  generationConfig?: GenerationConfig,
  signal?: AbortSignal,
): Promise<GenerateResponse> {
  const res = await apiFetch(`${API_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, userProfile, model, platforms, language, languageByPlatform, provider, generationConfig }),
    signal,
  });

  if (!res.ok) {
    throw new Error("생성 요청 실패");
  }

  return (await res.json()) as GenerateResponse;
}

export async function refinePost(payload: {
  cardId?: number;
  platform: Platform;
  originalDraft: string;
  currentContent: string;
  feedback: string;
  userProfile?: UserProfile;
  model?: ModelOption;
  language?: LanguageOption;
  provider?: ProviderOption;
  generationConfig?: GenerationConfig;
}): Promise<GeneratedCard> {
  const res = await apiFetch(`${API_URL}/api/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("수정 요청 실패");
  }

  return (await res.json()) as GeneratedCard;
}

export async function updateCardStatus(cardId: number, status: "draft" | "accepted" | "rejected"): Promise<GeneratedCard> {
  const res = await apiFetch(`${API_URL}/api/cards/${cardId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    throw new Error("상태 저장 실패");
  }

  return (await res.json()) as GeneratedCard;
}

export async function enqueuePublish(payload: {
  draftId: number;
  cardIds?: number[];
  acceptedOnly?: boolean;
  scheduledAt?: string;
  publishMode?: "api" | "browser" | "hybrid";
}): Promise<{ jobId: number; status: string }> {
  const res = await apiFetch(`${API_URL}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("발행 요청 실패");
  }

  return (await res.json()) as { jobId: number; status: string };
}

export async function startBrowserLogin(platform: Platform, waitMs = 120000): Promise<{ ok: boolean; message: string }> {
  let res: Response;
  try {
    res = await apiFetch(`${API_URL}/api/automation/login/${platform}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitMs }),
    });
  } catch (e) {
    throw new Error("Could not reach local server. Check that ./scripts/start_local.sh is running.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail || "Failed to start browser login session");
  }
  return (await res.json()) as { ok: boolean; message: string };
}

export async function getBrowserLoginSession(platform: Platform): Promise<{ connected: boolean }> {
  const res = await apiFetch(`${API_URL}/api/automation/session/${platform}`);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail || "Failed to check browser login session");
  }
  return (await res.json()) as { connected: boolean };
}

export async function disconnectBrowserLogin(platform: Platform): Promise<{ ok: boolean }> {
  const res = await apiFetch(`${API_URL}/api/automation/logout/${platform}`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail || "Failed to disconnect browser login session");
  }
  return (await res.json()) as { ok: boolean };
}

export async function getJob(jobId: number): Promise<PublishJob> {
  const res = await apiFetch(`${API_URL}/api/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error("작업 조회 실패");
  }
  return (await res.json()) as PublishJob;
}

export async function getOAuthConnectUrl(platform: Platform, redirectUri: string): Promise<{ authUrl: string; state: string }> {
  const qp = new URLSearchParams({ redirectUri });
  const res = await apiFetch(`${API_URL}/api/oauth/${platform}/connect?${qp.toString()}`);
  if (!res.ok) {
    let detail = "";
    try {
      const data = (await res.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = "";
    }
    throw new Error(detail || "OAuth connect URL is not available. Check platform OAuth env settings.");
  }
  return (await res.json()) as { authUrl: string; state: string };
}

export async function transcribeAudio(file: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", file, "voice-feedback.webm");

  const res = await apiFetch(`${API_URL}/api/stt`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error("음성 변환 실패");
  }

  const data = await res.json();
  return data.text as string;
}

export async function getPublishLogs(limit = 100): Promise<PublishLogItem[]> {
  const res = await apiFetch(`${API_URL}/api/publish/logs?limit=${limit}`);
  if (!res.ok) {
    // Local OSS mode can run without auth/session setup.
    if (res.status === 401 || res.status === 403) return [];
    throw new Error("Failed to fetch publish logs");
  }
  return (await res.json()) as PublishLogItem[];
}

export async function getThreads(limitPerPlatform = 20): Promise<SocialThread[]> {
  const res = await apiFetch(`${API_URL}/api/threads?limitPerPlatform=${limitPerPlatform}`);
  if (!res.ok) {
    // Local OSS mode can run without auth/session setup.
    if (res.status === 401 || res.status === 403) return [];
    throw new Error("Failed to fetch platform threads");
  }
  return (await res.json()) as SocialThread[];
}

export async function fetchProvider(): Promise<{ provider: ProviderOption; defaultModel: string; availableProviders: ProviderOption[] }> {
  const res = await apiFetch(`${API_URL}/api/provider`);
  if (!res.ok) return { provider: "openrouter", defaultModel: "openai/gpt-4o-mini", availableProviders: ["openrouter", "openai", "anthropic", "grok", "gemini"] };
  return res.json();
}

export async function refineDraft(payload: {
  rawDraft: string;
  language?: DraftRefineLanguage;
  platforms?: Platform[];
  context?: {
    answers?: Record<string, string>;
  };
  mode?: "aggro";
  model?: ModelOption;
  provider?: ProviderOption;
  generationConfig?: GenerationConfig;
}): Promise<DraftRefineResponse> {
  const res = await apiFetch(`${API_URL}/api/draft/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail || "Draft refinement failed");
  }
  return (await res.json()) as DraftRefineResponse;
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const res = await apiFetch(`${API_URL}/api/setup/status`);
  if (!res.ok) {
    return {
      llm: { envOpenAI: false, envOpenRouter: false },
      oauth: {
        linkedin: { configured: false, missing: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] },
        twitter: { configured: false, missing: ["TWITTER_CLIENT_ID", "TWITTER_CLIENT_SECRET"] },
        instagram: { configured: false, missing: ["INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"] },
        reddit: { configured: false, missing: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"] },
        threads: { configured: false, missing: ["THREADS_CLIENT_ID", "THREADS_CLIENT_SECRET"] },
        youtube: { configured: false, missing: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"] },
        tiktok: { configured: false, missing: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] },
      },
    };
  }
  return (await res.json()) as SetupStatus;
}

export async function boostPhrase(payload: {
  draft: string;
  targetText: string;
  instruction: string;
  history?: Array<{ role: "user" | "assistant"; text: string }>;
  language?: DraftRefineLanguage;
  provider?: ProviderOption;
  model?: ModelOption;
  generationConfig?: GenerationConfig;
}): Promise<PhraseBoostResponse> {
  const res = await apiFetch(`${API_URL}/api/phrase/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail || "Phrase boost failed");
  }
  return (await res.json()) as PhraseBoostResponse;
}
