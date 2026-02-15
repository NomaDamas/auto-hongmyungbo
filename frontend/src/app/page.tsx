"use client";

import { type MouseEvent, useMemo, useRef, useState } from "react";
import { Settings2, Sparkles } from "lucide-react";
import { PlatformCard } from "@/components/platform-card";
import { ContextPanel } from "@/components/context-panel";
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

const EMPTY_CONTEXTS: Record<Platform, string> = {
  reddit: "",
  linkedin: "",
  twitter: "",
  instagram: "",
  blog: "",
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

function buildUserProfile(contexts: Record<Platform, string>): UserProfile {
  const styles: UserProfile["styles"] = {};

  for (const platform of PLATFORM_ORDER) {
    const text = contexts[platform]?.trim();
    if (!text) continue;

    styles[platform] = {
      mode: "manual",
      customInstructions: text,
      referencePosts: [],
    };
  }

  return { styles };
}

export default function HomePage() {
  const [draft, setDraft] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelOption>("gpt-4o-mini");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [cards, setCards] = useState<CardState[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<Platform | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [contexts, setContexts] = useState<Record<Platform, string>>(EMPTY_CONTEXTS);

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cardsByOrder = useMemo(() => {
    return [...cards].sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
  }, [cards]);

  const acceptedCount = useMemo(() => cards.filter((c) => c.status === "accepted").length, [cards]);
  const userProfile = useMemo(() => buildUserProfile(contexts), [contexts]);

  const setCardRefining = (platform: Platform, isRefining: boolean) => {
    setCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, isRefining } : c)));
  };

  const patchCard = (platform: Platform, patch: Partial<CardState>) => {
    setCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, ...patch } : c)));
  };

  const handleGenerate = async () => {
    if (!draft.trim()) return;
    try {
      setLoading(true);
      const generated = await generatePosts(draft, userProfile, selectedModel);
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
        userProfile,
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

  const scrollCarousel = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    const amount = carouselRef.current.clientWidth * 0.9;
    carouselRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const onMouseDownCarousel = (e: MouseEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return;
    dragRef.current.isDown = true;
    dragRef.current.startX = e.pageX - carouselRef.current.offsetLeft;
    dragRef.current.scrollLeft = carouselRef.current.scrollLeft;
  };

  const onMouseLeaveCarousel = () => {
    dragRef.current.isDown = false;
  };

  const onMouseUpCarousel = () => {
    dragRef.current.isDown = false;
  };

  const onMouseMoveCarousel = (e: MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDown || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - dragRef.current.startX) * 1.15;
    carouselRef.current.scrollLeft = dragRef.current.scrollLeft - walk;
  };

  return (
    <>
      <ContextPanel open={contextOpen} contexts={contexts} onClose={() => setContextOpen(false)} onSave={setContexts} />

      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AI Cross Posting</p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Social Content Studio</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setContextOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5" /> 플랫폼별 스타일 설정
            </button>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Draft</h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">ID: {draftId ?? "-"}</span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="초안을 입력하세요..."
              className="mb-3 h-64 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
            />
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !draft.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Sparkles className="mr-1 inline h-3.5 w-3.5" /> {loading ? "생성 중..." : "5개 플랫폼 생성"}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !draftId || acceptedCount === 0}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100"
              >
                {publishing ? "발행 중..." : `Accepted 발행 (${acceptedCount})`}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["linkedin", "twitter", "instagram", "reddit"] as Platform[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => void handleOAuthConnect(platform)}
                  disabled={oauthBusyPlatform === platform}
                  className="rounded-full border border-zinc-300 px-2 py-1 text-[11px] capitalize text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  {oauthBusyPlatform === platform ? `${platform}...` : `${platform} OAuth`}
                </button>
              ))}
            </div>
            {publishJob && (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                Job #{publishJob.id}: {publishJob.status}
              </p>
            )}
          </aside>

          <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Platform Results</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollCarousel("left")}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
                >
                  ←
                </button>
                <button
                  onClick={() => scrollCarousel("right")}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
                >
                  →
                </button>
              </div>
            </div>

            <div
              ref={carouselRef}
              onMouseDown={onMouseDownCarousel}
              onMouseLeave={onMouseLeaveCarousel}
              onMouseUp={onMouseUpCarousel}
              onMouseMove={onMouseMoveCarousel}
              className="flex min-h-[580px] gap-3 overflow-x-auto rounded-xl p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {cardsByOrder.map((card) => (
                <div key={card.platform} className="w-[min(88vw,420px)] shrink-0 snap-start">
                  <PlatformCard
                    card={card}
                    onAccept={() => void handleStatus(card, "accepted")}
                    onReject={() => void handleStatus(card, "rejected")}
                    onRefine={(feedback) => handleRefine(card.platform, feedback)}
                    onVoiceRefine={() => handleVoiceRefine(card.platform)}
                    onUndo={() => patchCard(card.platform, { versionIndex: Math.max(0, card.versionIndex - 1) })}
                    onRedo={() => patchCard(card.platform, { versionIndex: Math.min(card.versions.length - 1, card.versionIndex + 1) })}
                    onSelectVersion={(index) => patchCard(card.platform, { versionIndex: index })}
                  />
                </div>
              ))}

              {!cardsByOrder.length && (
                <div className="grid h-[560px] w-full place-items-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  생성된 결과가 여기에 카드로 표시됩니다.
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
