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
import type { GeneratedCard, Platform, PublishJob, UserProfile } from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["reddit", "linkedin", "twitter", "instagram", "blog"];

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

export default function HomePage() {
  const [draft, setDraft] = useState("여기에 초안을 입력하세요. 제품 출시 이야기, 인사이트, 경험담 등.");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refiningPlatform, setRefiningPlatform] = useState<Platform | null>(null);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<Platform | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cardsByOrder = useMemo(() => {
    return [...cards].sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
  }, [cards]);

  const acceptedCount = useMemo(() => cards.filter((c) => c.status === "accepted").length, [cards]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const generated = await generatePosts(draft, initialProfile);
      setDraftId(generated.draftId);
      setCards(generated.cards);
      setPublishJob(null);
    } catch (err) {
      console.error(err);
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const patchCard = (platform: Platform, patch: Partial<GeneratedCard>) => {
    setCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, ...patch } : c)));
  };

  const handleStatus = async (card: GeneratedCard, status: "accepted" | "rejected") => {
    if (!card.id) {
      patchCard(card.platform, { status });
      return;
    }

    try {
      const updated = await updateCardStatus(card.id, status);
      patchCard(card.platform, updated);
    } catch (err) {
      console.error(err);
      alert("상태 저장 중 오류가 발생했습니다.");
    }
  };

  const handleRefine = async (platform: Platform, feedback: string) => {
    const current = cards.find((c) => c.platform === platform);
    if (!current) return;

    try {
      setRefiningPlatform(platform);
      const updated = await refinePost({
        cardId: current.id,
        platform,
        originalDraft: draft,
        currentContent: `${current.title}\n\n${current.body}`,
        feedback,
        userProfile: initialProfile,
      });
      patchCard(platform, updated);
    } catch (err) {
      console.error(err);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setRefiningPlatform(null);
    }
  };

  const handleVoiceRefine = async (platform: Platform) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("이 브라우저는 음성 입력을 지원하지 않습니다.");
      return;
    }

    try {
      setRefiningPlatform(platform);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const feedback = await transcribeAudio(audioBlob);
        await handleRefine(platform, feedback);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setTimeout(() => recorder.stop(), 4500);
    } catch (err) {
      console.error(err);
      alert("음성 수정 중 오류가 발생했습니다.");
      setRefiningPlatform(null);
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
      <header className="mb-6">
        <h1 className="font-display text-3xl">AI Social Cross Posting Agent</h1>
        <p className="text-sm text-black/70">하나의 초안을 5개 플랫폼 문법으로 자동 변환하고 즉시 리뷰/수정합니다.</p>
      </header>

      <section className="mb-4 rounded-2xl border border-black/10 bg-panel p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>Draft ID: {draftId ?? "-"}</span>
          <span>Accepted: {acceptedCount}</span>
          <button
            onClick={handlePublish}
            disabled={publishing || !draftId || acceptedCount === 0}
            className="rounded-lg bg-accent2 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {publishing ? "Publish Queue 처리 중..." : "Accepted 카드 발행"}
          </button>
          {publishJob && <span>Job #{publishJob.id}: {publishJob.status}</span>}
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1.9fr]">
        <aside className="rounded-2xl border border-black/10 bg-panel p-4 shadow-soft">
          <h2 className="mb-2 font-display text-xl">Raw Draft</h2>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mb-3 h-[420px] w-full rounded-xl border border-black/15 bg-white px-3 py-2"
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !draft.trim()}
            className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "생성 중..." : "5개 플랫폼 버전 생성"}
          </button>
        </aside>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {cardsByOrder.map((card) => (
            <PlatformCard
              key={card.platform}
              card={card}
              busy={refiningPlatform === card.platform}
              onAccept={() => void handleStatus(card, "accepted")}
              onReject={() => void handleStatus(card, "rejected")}
              onRefine={(feedback) => handleRefine(card.platform, feedback)}
              onVoiceRefine={() => handleVoiceRefine(card.platform)}
            />
          ))}
          {!cardsByOrder.length && (
            <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-8 text-center text-sm text-black/65 xl:col-span-2">
              초안을 입력하고 생성 버튼을 누르면 플랫폼별 카드가 여기에 표시됩니다.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
