"use client";

import { useMemo, useRef, useState } from "react";
import { PlatformCard } from "@/components/platform-card";
import {
  enqueuePublish,
  generatePosts,
  getJob,
  getOAuthConnectUrl,
  refinePost,
  transcribeAudio,
  updateCardStatus,
} from "@/lib/api";
import type { CardState, CardVersion, GeneratedCard, ModelOption, Platform, PublishJob, UserProfile } from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["reddit", "linkedin", "twitter", "instagram", "blog"];
const MODEL_OPTIONS: ModelOption[] = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"];

const initialProfile: UserProfile = {
  styles: {
    linkedin: {
      mode: "manual",
      customInstructions: "Use short paragraphs and business takeaways.",
      referencePosts: [],
    },
    twitter: {
      mode: "manual",
      customInstructions: "Use very short sentences. No emojis.",
      referencePosts: [],
    },
  },
};

function toCardState(card: GeneratedCard): CardState {
  const initialVersion: CardVersion = {
    title: card.title,
    body: card.body,
    suggestions: card.suggestions,
    source: "initial",
    createdAt: new Date().toISOString(),
  };

  return {
    ...card,
    versions: [initialVersion],
    versionIndex: 0,
    isRefining: false,
  };
}

const HMB_IMAGE_URL =
  process.env.NEXT_PUBLIC_HMB_IMAGE_URL ||
  "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=1200&q=80";

export default function HomePage() {
  const [draft, setDraft] = useState("홍명보 감독처럼 흔들리지 않고 꾸준히 성장하는 팀 문화를 만들었습니다.");
  const [selectedModel, setSelectedModel] = useState<ModelOption>("gpt-4o-mini");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<Platform | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cardsByOrder = useMemo(() => {
    return [...cards].sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
  }, [cards]);

  const acceptedCount = useMemo(() => cards.filter((c) => c.status === "accepted").length, [cards]);

  const setCardRefining = (platform: Platform, isRefining: boolean) => {
    setCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, isRefining } : c)));
  };

  const patchCard = (platform: Platform, patch: Partial<CardState>) => {
    setCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, ...patch } : c)));
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const generated = await generatePosts(draft, initialProfile, selectedModel);
      setDraftId(generated.draftId);
      setCards(generated.cards.map(toCardState));
      setPublishJob(null);
    } catch (err) {
      console.error(err);
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (card: CardState, status: "accepted" | "rejected") => {
    if (!card.id) {
      patchCard(card.platform, { status });
      return;
    }

    try {
      const updated = await updateCardStatus(card.id, status);
      patchCard(card.platform, { status: updated.status });
    } catch (err) {
      console.error(err);
      alert("상태 저장 중 오류가 발생했습니다.");
    }
  };

  const handleRefine = async (platform: Platform, feedback: string) => {
    const current = cards.find((c) => c.platform === platform);
    if (!current) return;

    const currentVersion = current.versions[current.versionIndex];

    try {
      setCardRefining(platform, true);
      const updated = await refinePost({
        cardId: current.id,
        platform,
        originalDraft: draft,
        currentContent: `${currentVersion.title}\n\n${currentVersion.body}`,
        feedback,
        userProfile: initialProfile,
        model: selectedModel,
      });

      setCards((prev) =>
        prev.map((c) => {
          if (c.platform !== platform) return c;

          const nextVersion: CardVersion = {
            title: updated.title,
            body: updated.body,
            suggestions: updated.suggestions,
            source: "refine",
            feedback,
            createdAt: new Date().toISOString(),
          };

          const kept = c.versions.slice(0, c.versionIndex + 1);
          const nextVersions = [...kept, nextVersion];

          return {
            ...c,
            title: updated.title,
            body: updated.body,
            suggestions: updated.suggestions,
            status: updated.status,
            versions: nextVersions,
            versionIndex: nextVersions.length - 1,
            isRefining: false,
          };
        }),
      );
    } catch (err) {
      console.error(err);
      alert("수정 중 오류가 발생했습니다.");
      setCardRefining(platform, false);
    }
  };

  const handleVoiceRefine = async (platform: Platform) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("이 브라우저는 음성 입력을 지원하지 않습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          const feedback = await transcribeAudio(audioBlob);
          await handleRefine(platform, feedback);
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      recorder.start();
      setTimeout(() => recorder.stop(), 4500);
    } catch (err) {
      console.error(err);
      alert("음성 수정 중 오류가 발생했습니다.");
    }
  };

  const handlePublish = async () => {
    if (!draftId) {
      alert("먼저 글을 생성하세요.");
      return;
    }

    try {
      setPublishing(true);
      const queued = await enqueuePublish({ draftId, acceptedOnly: true });

      for (let i = 0; i < 20; i += 1) {
        const job = await getJob(queued.jobId);
        setPublishJob(job);
        if (job.status === "done" || job.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } catch (err) {
      console.error(err);
      alert("발행 요청 중 오류가 발생했습니다.");
    } finally {
      setPublishing(false);
    }
  };

  const handleOAuthConnect = async (platform: Platform) => {
    try {
      setOauthBusyPlatform(platform);
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const redirectUri = `${apiBase}/api/oauth/${platform}/callback`;
      const { authUrl } = await getOAuthConnectUrl(platform, redirectUri);
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error(err);
      alert("OAuth 연결 URL 생성 중 오류가 발생했습니다.");
    } finally {
      setOauthBusyPlatform(null);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6">
      <section className="mb-6 grid grid-cols-1 overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 text-white shadow-soft lg:grid-cols-[1.4fr_1fr]">
        <div className="p-6 lg:p-8">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-white/80">Campaign Studio</p>
          <h1 className="font-display text-4xl leading-tight lg:text-5xl">홍명보 파이팅</h1>
          <p className="mt-3 max-w-xl text-sm text-white/90">
            하나의 메시지를 5개 플랫폼으로 즉시 전개하고, 버전 히스토리로 복원/재수정까지 가능한 홍보형 크로스 포스팅 에이전트.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs">Draft ID: {draftId ?? "-"}</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs">Accepted: {acceptedCount}</span>
          </div>
        </div>
        <div className="relative min-h-[220px]">
          <img src={HMB_IMAGE_URL} alt="홍명보 감독" className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-sm font-semibold">홍명보 감독의 리더십 톤으로 콘텐츠 확장</div>
        </div>
      </section>

      <section className="mb-4 rounded-2xl border border-black/10 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-xs font-semibold uppercase tracking-wide text-black/60">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
            className="rounded-lg border border-black/20 bg-white px-3 py-2 text-sm"
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          <button
            onClick={handlePublish}
            disabled={publishing || !draftId || acceptedCount === 0}
            className="rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {publishing ? "발행 큐 처리 중..." : "Accepted 카드 발행"}
          </button>
          {publishJob && <span className="text-xs">Job #{publishJob.id}: {publishJob.status}</span>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="mr-1">OAuth 연결:</span>
          {(["linkedin", "twitter", "instagram", "reddit"] as Platform[]).map((platform) => (
            <button
              key={platform}
              onClick={() => void handleOAuthConnect(platform)}
              disabled={oauthBusyPlatform === platform}
              className="rounded-lg border border-black/20 bg-white px-2 py-1 capitalize disabled:opacity-50"
            >
              {oauthBusyPlatform === platform ? `${platform}...` : platform}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_1.95fr]">
        <aside className="rounded-2xl border border-black/10 bg-white p-4 shadow-soft">
          <h2 className="mb-2 font-display text-xl">Campaign Draft</h2>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mb-3 h-[460px] w-full rounded-xl border border-black/20 bg-white px-3 py-2"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !draft.trim()}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "생성 중..." : "5개 플랫폼 버전 생성"}
          </button>

          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-800">
            OAuth 오류가 나면 보통 Redirect URI 불일치, Client ID/Secret 오입력, 플랫폼 앱 권한 누락 순으로 확인하세요.
          </div>
        </aside>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {cardsByOrder.map((card) => (
            <PlatformCard
              key={card.platform}
              card={card}
              onAccept={() => void handleStatus(card, "accepted")}
              onReject={() => void handleStatus(card, "rejected")}
              onRefine={(feedback) => handleRefine(card.platform, feedback)}
              onVoiceRefine={() => handleVoiceRefine(card.platform)}
              onUndo={() => patchCard(card.platform, { versionIndex: Math.max(0, card.versionIndex - 1) })}
              onRedo={() => patchCard(card.platform, { versionIndex: Math.min(card.versions.length - 1, card.versionIndex + 1) })}
              onSelectVersion={(index) => patchCard(card.platform, { versionIndex: index })}
            />
          ))}
          {!cardsByOrder.length && (
            <div className="rounded-2xl border border-dashed border-black/20 bg-white p-8 text-center text-sm text-black/65 xl:col-span-2">
              초안을 입력하고 생성 버튼을 누르면 플랫폼별 카드가 여기에 표시됩니다.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
