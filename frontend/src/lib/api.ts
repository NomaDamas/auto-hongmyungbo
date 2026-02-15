import type { GenerateResponse, GeneratedCard, LanguageOption, ModelOption, Platform, PublishJob, UserProfile } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function generatePosts(
  draft: string,
  userProfile?: UserProfile,
  model?: ModelOption,
  platforms?: Platform[],
  language?: LanguageOption,
): Promise<GenerateResponse> {
  const res = await fetch(`${API_URL}/api/generate`, {
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
  const res = await fetch(`${API_URL}/api/refine`, {
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
  const res = await fetch(`${API_URL}/api/cards/${cardId}/status`, {
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
}): Promise<{ jobId: number; status: string }> {
  const res = await fetch(`${API_URL}/api/publish`, {
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
  const res = await fetch(`${API_URL}/api/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error("작업 조회 실패");
  }
  return (await res.json()) as PublishJob;
}

export async function getOAuthConnectUrl(platform: Platform, redirectUri: string): Promise<{ authUrl: string; state: string }> {
  const qp = new URLSearchParams({ redirectUri });
  const res = await fetch(`${API_URL}/api/oauth/${platform}/connect?${qp.toString()}`);
  if (!res.ok) {
    throw new Error("OAuth 연결 URL 생성 실패");
  }
  return (await res.json()) as { authUrl: string; state: string };
}

export async function transcribeAudio(file: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", file, "voice-feedback.webm");

  const res = await fetch(`${API_URL}/api/stt`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error("음성 변환 실패");
  }

  const data = await res.json();
  return data.text as string;
}
