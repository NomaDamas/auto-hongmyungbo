import type {
  DraftRefineLanguage,
  DraftRefineResponse,
  GenerateResponse,
  GeneratedCard,
  GenerationConfig,
  LanguageOption,
  ModelOption,
  PerPlatformLanguageMap,
  Platform,
  ProviderOption,
  PublishJob,
  PublishLogItem,
  SocialThread,
  UserProfile,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
let runtimeOpenAIKey = "";
let runtimeOpenRouterKey = "";

export function configureRuntimeApiKeys(keys: { openaiApiKey?: string; openrouterApiKey?: string }) {
  runtimeOpenAIKey = (keys.openaiApiKey || "").trim();
  runtimeOpenRouterKey = (keys.openrouterApiKey || "").trim();
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
): Promise<GenerateResponse> {
  const res = await apiFetch(`${API_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, userProfile, model, platforms, language, languageByPlatform, provider, generationConfig }),
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
  if (!res.ok) return { provider: "openrouter", defaultModel: "openai/gpt-4o-mini", availableProviders: ["openrouter"] };
  return res.json();
}

export async function refineDraft(payload: {
  rawDraft: string;
  language?: DraftRefineLanguage;
  platforms?: Platform[];
  context?: {
    answers?: Record<string, string>;
  };
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
