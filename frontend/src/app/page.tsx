"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArchiveRestore, CheckCheck, Settings2, Sparkles } from "lucide-react";
import { PlatformCard } from "@/components/platform-card";
import { ContextPanel } from "@/components/context-panel";
import {
  enqueuePublish,
  fetchProvider,
  generatePosts,
  getJob,
  getMe,
  getOAuthConnectUrl,
  getPublishLogs,
  getSocialAuthConnectUrl,
  getThreads,
  logout,
  refinePost,
  transcribeAudio,
  updateCardStatus,
} from "@/lib/api";
import type {
  CardState,
  CardVersion,
  GeneratedCard,
  LanguageOption,
  LanguageSettingOption,
  ModelOption,
  PerPlatformLanguageMap,
  Platform,
  PublishJob,
  PublishLogItem,
  ProviderOption,
  SocialThread,
  SocialProvider,
  UserInfo,
  UserProfile,
} from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["reddit", "linkedin", "twitter", "instagram", "blog"];

const OPENAI_MODELS: ModelOption[] = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"];
const OPENROUTER_MODELS: ModelOption[] = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "openai/gpt-4.1-mini",
  "openai/gpt-5.2",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-pro-preview",
];

const EMPTY_CONTEXTS: Record<Platform, string> = {
  reddit: "",
  linkedin: "",
  twitter: "",
  instagram: "",
  blog: "",
};
const EMPTY_REFERENCE_POSTS: Record<Platform, string[]> = {
  reddit: [],
  linkedin: [],
  twitter: [],
  instagram: [],
  blog: [],
};
const DEFAULT_PER_PLATFORM_LANGUAGES: PerPlatformLanguageMap = {
  reddit: "auto",
  linkedin: "auto",
  twitter: "auto",
  instagram: "auto",
  blog: "auto",
};
const DEFAULT_ENABLED_PLATFORMS: Record<Platform, boolean> = {
  reddit: true,
  linkedin: true,
  twitter: true,
  instagram: true,
  blog: true,
};

function cardKey(card: CardState): string {
  return card.id ? `id-${card.id}` : `platform-${card.platform}`;
}

function insertByPlatformOrder(cards: CardState[]): CardState[] {
  return [...cards].sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
}

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

function buildUserProfile(contexts: Record<Platform, string>, referencePosts: Record<Platform, string[]>): UserProfile {
  const styles: UserProfile["styles"] = {};

  for (const platform of PLATFORM_ORDER) {
    const text = contexts[platform]?.trim();
    const refs = referencePosts[platform] ?? [];
    if (!text && refs.length === 0) continue;

    styles[platform] = {
      mode: refs.length > 0 ? "auto" : "manual",
      customInstructions: text || undefined,
      referencePosts: refs,
    };
  }

  return { styles };
}

export default function HomePage() {
  const [draft, setDraft] = useState("");
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(OPENAI_MODELS);
  const [availableProviders, setAvailableProviders] = useState<ProviderOption[]>(["openai"]);
  const [provider, setProvider] = useState<ProviderOption>("openai");
  const [selectedModel, setSelectedModel] = useState<ModelOption>("gpt-4o-mini");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [resultCards, setResultCards] = useState<CardState[]>([]);
  const [queueCards, setQueueCards] = useState<CardState[]>([]);
  const [collapsingKeys, setCollapsingKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<Platform | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [contexts, setContexts] = useState<Record<Platform, string>>(EMPTY_CONTEXTS);
  const [referencePosts, setReferencePosts] = useState<Record<Platform, string[]>>(EMPTY_REFERENCE_POSTS);
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<Platform, boolean>>(DEFAULT_ENABLED_PLATFORMS);
  const [autoPublish, setAutoPublish] = useState(false);
  const [language, setLanguage] = useState<LanguageSettingOption>("auto");
  const [perPlatformLanguages, setPerPlatformLanguages] = useState<PerPlatformLanguageMap>(DEFAULT_PER_PLATFORM_LANGUAGES);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [publishLogs, setPublishLogs] = useState<PublishLogItem[]>([]);
  const [threads, setThreads] = useState<SocialThread[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const carouselRef = useRef<HTMLDivElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cardsByOrder = useMemo(() => insertByPlatformOrder(resultCards), [resultCards]);
  const queueByOrder = useMemo(() => insertByPlatformOrder(queueCards), [queueCards]);
  const acceptedCount = queueByOrder.length;
  const userProfile = useMemo(() => buildUserProfile(contexts, referencePosts), [contexts, referencePosts]);
  const selectedPlatforms = useMemo(
    () => PLATFORM_ORDER.filter((platform) => enabledPlatforms[platform]),
    [enabledPlatforms],
  );

  const refreshPublishData = async () => {
    if (!user) {
      setPublishLogs([]);
      setThreads([]);
      return;
    }
    try {
      setLogsLoading(true);
      const [logs, threadData] = await Promise.all([getPublishLogs(80), getThreads(20)]);
      setPublishLogs(logs);
      setThreads(threadData);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const providerInfo = await fetchProvider();
        const initialProvider = providerInfo.provider === "openrouter" ? "openrouter" : "openai";
        setAvailableProviders(providerInfo.availableProviders?.length ? providerInfo.availableProviders : [initialProvider]);
        setProvider(initialProvider);
        setModelOptions(initialProvider === "openrouter" ? OPENROUTER_MODELS : OPENAI_MODELS);
        setSelectedModel(providerInfo.defaultModel);
      } catch (err) {
        console.error(err);
      }

      try {
        const me = await getMe();
        setUser(me);
      } catch (err) {
        console.error(err);
      } finally {
        setAuthLoading(false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshPublishData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setCardRefining = (platform: Platform, isRefining: boolean) => {
    setResultCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, isRefining } : c)));
  };

  const patchCard = (platform: Platform, patch: Partial<CardState>) => {
    setResultCards((prev) => prev.map((c) => (c.platform === platform ? { ...c, ...patch } : c)));
  };

  const handleGenerate = async () => {
    if (!draft.trim()) return;
    try {
      setLoading(true);
      if (!selectedPlatforms.length) {
        alert("최소 1개 플랫폼을 선택하세요.");
        setLoading(false);
        return;
      }

      const generated = await generatePosts(
        draft,
        userProfile,
        selectedModel,
        selectedPlatforms,
        language === "per_platform" ? "auto" : language,
        language === "per_platform" ? perPlatformLanguages : undefined,
        provider,
      );
      setDraftId(generated.draftId);
      const nextCards = generated.cards.map(toCardState);
      setResultCards(nextCards);
      setQueueCards([]);
      setPublishJob(null);
      setCollapsingKeys(new Set());

      if (autoPublish && generated.cards.length > 0) {
        const cardIds = generated.cards.map((c) => c.id).filter((id): id is number => typeof id === "number");
        const queued = await enqueuePublish({
          draftId: generated.draftId,
          cardIds,
          acceptedOnly: false,
        });

        for (let i = 0; i < 20; i += 1) {
          const job = await getJob(queued.jobId);
          setPublishJob(job);
          if (job.status === "done" || job.status === "failed") break;
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    } catch (err) {
      console.error(err);
      alert("생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const moveToQueue = (card: CardState) => {
    const key = cardKey(card);
    setCollapsingKeys((prev) => new Set([...prev, key]));

    window.setTimeout(() => {
      setResultCards((prev) => prev.filter((c) => cardKey(c) !== key));
      setQueueCards((prev) => insertByPlatformOrder([...prev, { ...card, status: "accepted" }]));
      setCollapsingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 260);
  };

  const handleAccept = async (card: CardState) => {
    try {
      if (card.id) {
        await updateCardStatus(card.id, "accepted");
      }
      moveToQueue(card);
    } catch (err) {
      console.error(err);
      alert("Accept 처리 중 오류가 발생했습니다.");
    }
  };

  const handleRestoreFromQueue = async (card: CardState) => {
    try {
      if (card.id) {
        await updateCardStatus(card.id, "draft");
      }

      const key = cardKey(card);
      setQueueCards((prev) => prev.filter((c) => cardKey(c) !== key));
      setResultCards((prev) => insertByPlatformOrder([...prev, { ...card, status: "draft" }]));
    } catch (err) {
      console.error(err);
      alert("복원 중 오류가 발생했습니다.");
    }
  };

  const handleReject = async (card: CardState) => {
    if (!card.id) {
      patchCard(card.platform, { status: "rejected" });
      return;
    }

    try {
      const updated = await updateCardStatus(card.id, "rejected");
      patchCard(card.platform, { status: updated.status });
    } catch (err) {
      console.error(err);
      alert("Reject 처리 중 오류가 발생했습니다.");
    }
  };

  const handleRefine = async (platform: Platform, feedback: string) => {
    const current = resultCards.find((c) => c.platform === platform);
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
        language: language === "per_platform" ? perPlatformLanguages[platform] : language,
        provider,
      });

      setResultCards((prev) =>
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
    if (!user) {
      alert("로그인 후 발행할 수 있습니다.");
      return;
    }
    if (!draftId) {
      alert("먼저 글을 생성하세요.");
      return;
    }

    try {
      setPublishing(true);
      const queued = await enqueuePublish({
        draftId,
        acceptedOnly: true,
        scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });

      for (let i = 0; i < 20; i += 1) {
        const job = await getJob(queued.jobId);
        setPublishJob(job);
        if (job.status === "done" || job.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      await refreshPublishData();
    } catch (err) {
      console.error(err);
      alert("발행 요청 중 오류가 발생했습니다.");
    } finally {
      setPublishing(false);
    }
  };

  const handleOAuthConnect = async (platform: Platform) => {
    if (!user) {
      alert("소셜 로그인 후 플랫폼 OAuth를 연결하세요.");
      return;
    }
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

  const handleSocialLogin = async (provider: SocialProvider, targetWindow: Window = window) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const redirectUri = `${apiBase}/api/auth/${provider}/callback`;
      const { authUrl } = await getSocialAuthConnectUrl(provider, redirectUri);
      targetWindow.location.href = authUrl;
    } catch (err) {
      console.error(err);
      alert("소셜 로그인 연결 중 오류가 발생했습니다.");
    }
  };

  const openLoginPopup = () => {
    const popup = window.open("", "social-login-popup", "width=440,height=560,resizable=yes,scrollbars=yes");
    if (!popup) {
      alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.");
      return;
    }

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Social Login</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f5f5f4; color: #18181b; }
    .wrap { max-width: 360px; margin: 28px auto; background: white; border: 1px solid #e4e4e7; border-radius: 14px; padding: 18px; }
    h1 { margin: 0 0 6px; font-size: 18px; }
    p { margin: 0 0 16px; font-size: 12px; color: #52525b; }
    button { width: 100%; margin: 6px 0; padding: 10px 12px; border-radius: 10px; border: 1px solid #d4d4d8; background: #fafafa; cursor: pointer; font-weight: 600; }
    button:hover { background: #f4f4f5; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Login</h1>
    <p>Select a social provider.</p>
    <button data-provider="google">Continue with Google</button>
    <button data-provider="kakao">Continue with Kakao</button>
    <button data-provider="naver">Continue with Naver</button>
  </div>
  <script>
    document.querySelectorAll("button[data-provider]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const provider = btn.getAttribute("data-provider");
        window.opener.postMessage({ type: "social-login", provider }, window.location.origin);
      });
    });
  </script>
</body>
</html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "social-login") return;
      const provider = event.data.provider as SocialProvider;
      if (!["google", "kakao", "naver"].includes(provider)) return;
      const popupWindow = event.source as Window | null;
      void handleSocialLogin(provider, popupWindow || window);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setPublishLogs([]);
      setThreads([]);
    } catch (err) {
      console.error(err);
    }
  };

  const scrollResults = (dir: "left" | "right") => {
    if (!carouselRef.current) return;
    const amount = Math.max(280, Math.floor(carouselRef.current.clientWidth * 0.82));
    carouselRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const handlePreviewEdit = (platform: Platform, title: string, body: string) => {
    setResultCards((prev) =>
      prev.map((c) => {
        if (c.platform !== platform) return c;
        const nextVersions = [...c.versions];
        nextVersions[c.versionIndex] = { ...nextVersions[c.versionIndex], title, body };
        return { ...c, title, body, versions: nextVersions };
      }),
    );
  };

  return (
    <>
      <ContextPanel
        open={contextOpen}
        contexts={contexts}
        referencePosts={referencePosts}
        enabledPlatforms={enabledPlatforms}
        autoPublish={autoPublish}
        language={language}
        perPlatformLanguages={perPlatformLanguages}
        provider={provider}
        availableProviders={availableProviders}
        selectedModel={selectedModel}
        modelOptionsByProvider={{ openai: OPENAI_MODELS, openrouter: OPENROUTER_MODELS }}
        onClose={() => setContextOpen(false)}
        onSave={({
          contexts: nextContexts,
          referencePosts: nextReferencePosts,
          enabledPlatforms: nextEnabled,
          autoPublish: nextAutoPublish,
          language: nextLanguage,
          perPlatformLanguages: nextPerPlatformLanguages,
          provider: nextProvider,
          selectedModel: nextModel,
        }) => {
          setContexts(nextContexts);
          setReferencePosts(nextReferencePosts);
          setEnabledPlatforms(nextEnabled);
          setAutoPublish(nextAutoPublish);
          setLanguage(nextLanguage);
          setPerPlatformLanguages(nextPerPlatformLanguages);
          setProvider(nextProvider);
          const nextModels = nextProvider === "openrouter" ? OPENROUTER_MODELS : OPENAI_MODELS;
          setModelOptions(nextModels);
          setSelectedModel(nextModels.includes(nextModel) ? nextModel : nextModels[0]);
        }}
      />

      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Auto-HongMyungbo</h1>
            <p className="text-xs font-medium lowercase tracking-wide text-zinc-500 dark:text-zinc-400">ai cross posting social content studio</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {authLoading ? (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">로그인 확인 중...</span>
            ) : user ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-300 px-2 py-1 dark:border-zinc-700">
                <span className="text-xs text-zinc-700 dark:text-zinc-200">{user.name || user.email || `user#${user.id}`}</span>
                <button
                  onClick={() => void handleLogout()}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-100"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={openLoginPopup}
                className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-100"
              >
                Login
              </button>
            )}
            <button
              onClick={() => setContextOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5" /> Options
            </button>
            <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Provider: {provider} | Model: {selectedModel}
            </span>
          </div>
        </header>

        <section className="mb-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <aside className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Draft</h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">ID: {draftId ?? "-"}</span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="초안을 입력하세요..."
              className="mb-3 h-44 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
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
                {publishing ? "발행 중..." : scheduleEnabled ? `예약 발행 (${acceptedCount})` : `Queue 발행 (${acceptedCount})`}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
                예약 발행
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={!scheduleEnabled}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                선택 플랫폼: {selectedPlatforms.join(", ") || "없음"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                자동 게시: {autoPublish ? "ON" : "OFF"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                언어: {language}
              </span>
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

            <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Queue</h3>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{acceptedCount} accepted</span>
              </div>
              <div className="space-y-2">
                {queueByOrder.map((card) => (
                  <button
                    key={cardKey(card)}
                    onClick={() => void handleRestoreFromQueue(card)}
                    className="flex w-full items-start justify-between rounded-lg border border-zinc-200 px-3 py-2 text-left hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <div>
                      <p className="text-xs font-semibold capitalize text-zinc-900 dark:text-zinc-100">{card.platform}</p>
                      <p className="line-clamp-1 text-[11px] text-zinc-600 dark:text-zinc-300">{card.versions[card.versionIndex].title}</p>
                    </div>
                    <span className="ml-2 rounded-md bg-zinc-100 px-2 py-1 text-[11px] dark:bg-zinc-800 dark:text-zinc-100">
                      <ArchiveRestore className="inline h-3 w-3" />
                    </span>
                  </button>
                ))}
                {!queueByOrder.length && <p className="text-xs text-zinc-500 dark:text-zinc-400">Accept한 카드가 여기에 보관됩니다.</p>}
              </div>
            </section>

            {publishJob && (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                Job #{publishJob.id}: {publishJob.status}
              </p>
            )}

          </aside>

          <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Platform Results</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">좌우 버튼으로 탐색</span>
                <button
                  onClick={() => scrollResults("left")}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
                >
                  ←
                </button>
                <button
                  onClick={() => scrollResults("right")}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
                >
                  →
                </button>
              </div>
            </div>

            <div className="relative w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div ref={carouselRef} className="w-full min-w-0 overflow-x-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max min-w-full gap-4">
                  {cardsByOrder.map((card) => {
                    const isCollapsing = collapsingKeys.has(cardKey(card));
                    return (
                      <div
                        key={cardKey(card)}
                        className={`overflow-hidden transition-all duration-300 ease-out ${
                          isCollapsing ? "w-0 scale-95 opacity-0" : "w-[350px] flex-shrink-0 scale-100 opacity-100"
                        }`}
                      >
                        <PlatformCard
                          card={card}
                          onAccept={() => void handleAccept(card)}
                          onReject={() => void handleReject(card)}
                          onRefine={(feedback) => handleRefine(card.platform, feedback)}
                          onVoiceRefine={() => handleVoiceRefine(card.platform)}
                          onUndo={() => patchCard(card.platform, { versionIndex: Math.max(0, card.versionIndex - 1) })}
                          onRedo={() => patchCard(card.platform, { versionIndex: Math.min(card.versions.length - 1, card.versionIndex + 1) })}
                          onSelectVersion={(index) => patchCard(card.platform, { versionIndex: index })}
                          onPreviewChange={(title, body) => handlePreviewEdit(card.platform, title, body)}
                        />
                      </div>
                    );
                  })}

                  {!cardsByOrder.length && (
                    <div className="grid h-[600px] w-[350px] flex-shrink-0 place-items-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      결과 카드가 비어 있습니다. Draft 생성 후 Accept로 Queue에 보관할 수 있습니다.
                    </div>
                  )}
                  <div className="w-2 flex-shrink-0" />
                </div>
              </div>
              <div className="px-3 pb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                박스 바깥 카드는 숨겨지고, 내부 스크롤/버튼으로만 탐색됩니다.
              </div>
            </div>
          </section>
        </section>

        <footer className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Accept: 오른쪽 Results → 왼쪽 Queue | Queue 클릭: Restore
          <CheckCheck className="ml-1 inline h-3.5 w-3.5" />
        </footer>

        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Publish Logs & Platform Threads</h3>
            <button onClick={() => void refreshPublishData()} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700 dark:text-zinc-100">
              {logsLoading ? "로딩..." : "새로고침"}
            </button>
          </div>
          {!user && <p className="text-xs text-zinc-500 dark:text-zinc-400">로그인하면 내 발행 로그/플랫폼별 스레드를 볼 수 있습니다.</p>}
          {user && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Promotion Log</p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {publishLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-zinc-200 px-2 py-2 text-xs dark:border-zinc-700">
                      <p className="font-semibold capitalize">{log.platform} · {log.status}</p>
                      <p className="line-clamp-1 text-zinc-600 dark:text-zinc-300">{log.title || "-"}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(log.createdAt).toLocaleString()}</p>
                      {log.postUrl && (
                        <a className="text-[11px] text-blue-600 underline" href={log.postUrl} target="_blank" rel="noreferrer">open</a>
                      )}
                    </div>
                  ))}
                  {!publishLogs.length && <p className="text-xs text-zinc-500 dark:text-zinc-400">로그가 없습니다.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Platform Threads</p>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {threads.map((thread) => (
                    <div key={thread.platform} className="rounded-lg border border-zinc-200 px-2 py-2 text-xs dark:border-zinc-700">
                      <p className="mb-1 font-semibold capitalize">{thread.platform}</p>
                      <div className="space-y-1">
                        {thread.items.slice(0, 5).map((item) => (
                          <p key={item.id} className="line-clamp-1 text-zinc-600 dark:text-zinc-300">{item.title || item.body || "-"}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!threads.length && <p className="text-xs text-zinc-500 dark:text-zinc-400">플랫폼 스레드가 없습니다.</p>}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
