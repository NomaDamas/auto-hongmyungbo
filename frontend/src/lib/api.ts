import type {
  AnalyticsEventPayload,
  AnalyticsSummary,
  GenerateResponse,
  GeneratedCard,
  LanguageOption,
  ModelOption,
  Platform,
  PublishJob,
  PublishLogItem,
  SocialProvider,
  SocialThread,
  UserInfo,
  UserProfile,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    credentials: "include",
    ...init,
  });
}

export async function generatePosts(
  draft: string,
  userProfile?: UserProfile,
  model?: ModelOption,
  platforms?: Platform[],
  language?: LanguageOption,
): Promise<GenerateResponse> {
  const res = await apiFetch(`${API_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft, userProfile, model, platforms, language }),
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
    throw new Error("OAuth 연결 URL 생성 실패");
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

export async function trackAnalyticsEvent(payload: AnalyticsEventPayload): Promise<void> {
  await apiFetch(`${API_URL}/api/analytics/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAnalyticsSummary(params?: {
  days?: number;
  cpm?: number;
  ctr?: number;
  cpc?: number;
  fillRate?: number;
  slotsPerPage?: number;
}): Promise<AnalyticsSummary> {
  const qp = new URLSearchParams();
  if (params?.days !== undefined) qp.set("days", String(params.days));
  if (params?.cpm !== undefined) qp.set("cpm", String(params.cpm));
  if (params?.ctr !== undefined) qp.set("ctr", String(params.ctr));
  if (params?.cpc !== undefined) qp.set("cpc", String(params.cpc));
  if (params?.fillRate !== undefined) qp.set("fillRate", String(params.fillRate));
  if (params?.slotsPerPage !== undefined) qp.set("slotsPerPage", String(params.slotsPerPage));

  const res = await apiFetch(`${API_URL}/api/analytics/summary?${qp.toString()}`);
  if (!res.ok) {
    throw new Error("트래픽 요약 조회 실패");
  }
  return (await res.json()) as AnalyticsSummary;
}

export async function getMe(): Promise<UserInfo | null> {
  const res = await apiFetch(`${API_URL}/api/auth/me`);
  if (!res.ok) return null;
  return (await res.json()) as UserInfo | null;
}

export async function logout(): Promise<void> {
  await apiFetch(`${API_URL}/api/auth/logout`, { method: "POST" });
}

export async function getSocialAuthConnectUrl(provider: SocialProvider, redirectUri: string): Promise<{ authUrl: string; state: string }> {
  const qp = new URLSearchParams({ redirectUri });
  const res = await apiFetch(`${API_URL}/api/auth/${provider}/connect?${qp.toString()}`);
  if (!res.ok) {
    throw new Error("소셜 로그인 URL 생성 실패");
  }
  return (await res.json()) as { authUrl: string; state: string };
}

export async function getPublishLogs(limit = 100): Promise<PublishLogItem[]> {
  const res = await apiFetch(`${API_URL}/api/publish/logs?limit=${limit}`);
  if (!res.ok) {
    throw new Error("발행 로그 조회 실패");
  }
  return (await res.json()) as PublishLogItem[];
}

export async function getThreads(limitPerPlatform = 20): Promise<SocialThread[]> {
  const res = await apiFetch(`${API_URL}/api/threads?limitPerPlatform=${limitPerPlatform}`);
  if (!res.ok) {
    throw new Error("스레드 조회 실패");
  }
  return (await res.json()) as SocialThread[];
}

export async function fetchProvider(): Promise<{ provider: string; defaultModel: string }> {
  const res = await apiFetch(`${API_URL}/api/provider`);
  if (!res.ok) return { provider: "openai", defaultModel: "gpt-4o-mini" };
  return res.json();
}
