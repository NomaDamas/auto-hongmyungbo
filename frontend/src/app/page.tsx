"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveRestore, CheckCheck, Settings2, Sparkles } from "lucide-react";
import { PlatformCard } from "@/components/platform-card";
import { ContextPanel } from "@/components/context-panel";
import { OptionsPanel } from "@/components/options-panel";
import { DraftRefinerPanel, type DraftRefinerPanelRef } from "@/components/draft-refiner-panel";
import {
  configureRuntimeApiKeys,
  enqueuePublish,
  fetchProvider,
  generatePosts,
  getJob,
  getOAuthConnectUrl,
  getPublishLogs,
  getThreads,
  refinePost,
  transcribeAudio,
  updateCardStatus,
} from "@/lib/api";
import type {
  CardState,
  CardVersion,
  DraftRefineLanguage,
  GenerationConfig,
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
  UserProfile,
} from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["reddit", "linkedin", "twitter", "instagram", "blog"];

const OPENAI_MODELS: ModelOption[] = [
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
];
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

function getPlatformLabel(platform: Platform): string {
  if (platform === "twitter") return "x";
  return platform;
}

function toRefineLanguage(language: LanguageSettingOption): DraftRefineLanguage {
  if (language === "korean") return "ko";
  if (language === "english") return "en";
  return "auto";
}

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  thinkingMode: false,
  reasoningEffort: "medium",
  temperature: 0.7,
  topP: 1,
  maxOutputTokens: 1500,
};

export default function HomePage() {
  const [draft, setDraft] = useState("");
  const [availableProviders, setAvailableProviders] = useState<ProviderOption[]>(["openrouter"]);
  const [provider, setProvider] = useState<ProviderOption>("openrouter");
  const [selectedModel, setSelectedModel] = useState<ModelOption>("openai/gpt-4o-mini");
  const [generationConfig, setGenerationConfig] = useState<GenerationConfig>(DEFAULT_GENERATION_CONFIG);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [rememberApiKeys, setRememberApiKeys] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [resultCards, setResultCards] = useState<CardState[]>([]);
  // Default OFF: single focused platform. ON: side-by-side comparison grid.
  const [compareMode, setCompareMode] = useState(false);
  const [activePlatform, setActivePlatform] = useState<Platform>("reddit");
  const [queueCards, setQueueCards] = useState<CardState[]>([]);
  const [collapsingKeys, setCollapsingKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<Platform | null>(null);

  const [contextOpen, setContextOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [contexts, setContexts] = useState<Record<Platform, string>>(EMPTY_CONTEXTS);
  const [referencePosts, setReferencePosts] = useState<Record<Platform, string[]>>(EMPTY_REFERENCE_POSTS);
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<Platform, boolean>>(DEFAULT_ENABLED_PLATFORMS);
  const [autoPublish, setAutoPublish] = useState(false);
  const [language, setLanguage] = useState<LanguageSettingOption>("auto");
  const [perPlatformLanguages, setPerPlatformLanguages] = useState<PerPlatformLanguageMap>(DEFAULT_PER_PLATFORM_LANGUAGES);
  const [logsLoading, setLogsLoading] = useState(false);
  const [publishLogs, setPublishLogs] = useState<PublishLogItem[]>([]);
  const [threads, setThreads] = useState<SocialThread[]>([]);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const refinerRef = useRef<DraftRefinerPanelRef | null>(null);

  const cardsByOrder = useMemo(() => insertByPlatformOrder(resultCards), [resultCards]);
  const queueByOrder = useMemo(() => insertByPlatformOrder(queueCards), [queueCards]);
  const acceptedCount = queueByOrder.length;
  const userProfile = useMemo(() => buildUserProfile(contexts, referencePosts), [contexts, referencePosts]);
  const selectedPlatforms = useMemo(
    () => PLATFORM_ORDER.filter((platform) => enabledPlatforms[platform]),
    [enabledPlatforms],
  );
  const activeCard = useMemo(
    () => cardsByOrder.find((card) => card.platform === activePlatform) ?? cardsByOrder[0] ?? null,
    [activePlatform, cardsByOrder],
  );

  useEffect(() => {
    if (!cardsByOrder.length) return;
    if (!cardsByOrder.some((card) => card.platform === activePlatform)) {
      setActivePlatform(cardsByOrder[0].platform);
    }
  }, [activePlatform, cardsByOrder]);

  const refreshPublishData = async () => {
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
    const shouldRememberApiKeys = window.localStorage.getItem("hmb_remember_api_keys") === "1";
    const savedOpenaiApiKey = shouldRememberApiKeys ? window.localStorage.getItem("hmb_openai_api_key") ?? "" : "";
    const savedOpenrouterApiKey = shouldRememberApiKeys ? window.localStorage.getItem("hmb_openrouter_api_key") ?? "" : "";
    const savedConfigRaw = window.localStorage.getItem("hmb_generation_config");
    let savedConfig = DEFAULT_GENERATION_CONFIG;
    if (savedConfigRaw) {
      try {
        savedConfig = { ...DEFAULT_GENERATION_CONFIG, ...(JSON.parse(savedConfigRaw) as Partial<GenerationConfig>) };
      } catch {
        savedConfig = DEFAULT_GENERATION_CONFIG;
      }
    }
    setOpenaiApiKey(savedOpenaiApiKey);
    setOpenrouterApiKey(savedOpenrouterApiKey);
    setRememberApiKeys(shouldRememberApiKeys);
    setGenerationConfig(savedConfig);
    configureRuntimeApiKeys({ openaiApiKey: savedOpenaiApiKey, openrouterApiKey: savedOpenrouterApiKey });

    const init = async () => {
      try {
        const providerInfo = await fetchProvider();
        const initialProvider = providerInfo.provider === "openrouter" ? "openrouter" : "openai";
        const candidateProviders = providerInfo.availableProviders?.length ? providerInfo.availableProviders : [initialProvider];
        const normalizedProviders = candidateProviders.filter(
          (p): p is ProviderOption => p === "openai" || p === "openrouter",
        );
        const providers: ProviderOption[] = Array.from(new Set<ProviderOption>([...normalizedProviders, "openai", "openrouter"]));
        setAvailableProviders(providers);
        setProvider(initialProvider);
        setSelectedModel(providerInfo.defaultModel);
      } catch (err) {
        console.error(err);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshPublishData();
  }, []);

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
        alert("Select at least one platform.");
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
        generationConfig,
      );
      setDraftId(generated.draftId);
      const nextCards = generated.cards.map(toCardState);
      setResultCards(nextCards);
      if (nextCards.length) setActivePlatform(nextCards[0].platform);
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
      alert("Generation failed.");
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
      alert("Accept failed.");
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
      alert("Restore failed.");
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
      alert("Reject failed.");
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
        generationConfig,
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
      alert("Refine failed.");
      setCardRefining(platform, false);
    }
  };

  const handleVoiceRefine = async (platform: Platform) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("This browser does not support voice input.");
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
      alert("Voice refine failed.");
    }
  };

  const handlePublish = async () => {
    if (!draftId) {
      alert("Generate posts first.");
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
      alert("Publish request failed.");
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
      const message = err instanceof Error ? err.message : "Failed to create OAuth connect URL.";
      alert(message);
    } finally {
      setOauthBusyPlatform(null);
    }
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

  const handleInsertIntoDraft = (snippet: string) => {
    const text = snippet.trim();
    if (!text) return;
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => `${prev.trim()}\n\n---\n${text}`.trim());
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const prefix = draft.slice(0, start);
    const suffix = draft.slice(end);
    const inserted = `${prefix}${prefix.endsWith("\n") || !prefix ? "" : "\n"}${text}${suffix.startsWith("\n") || !suffix ? "" : "\n"}${suffix}`;
    setDraft(inserted);
  };

  const handleTextareaKeydown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const metaOrCtrl = event.metaKey || event.ctrlKey;
    if (!metaOrCtrl || event.altKey) return;
    if (event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      refinerRef.current?.openAndRefine();
      return;
    }
    if (!event.shiftKey && event.key === "Enter") {
      event.preventDefault();
      void handleGenerate();
    }
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
        onClose={() => setContextOpen(false)}
        onSave={({
          contexts: nextContexts,
          referencePosts: nextReferencePosts,
          enabledPlatforms: nextEnabled,
          autoPublish: nextAutoPublish,
          language: nextLanguage,
          perPlatformLanguages: nextPerPlatformLanguages,
        }) => {
          setContexts(nextContexts);
          setReferencePosts(nextReferencePosts);
          setEnabledPlatforms(nextEnabled);
          setAutoPublish(nextAutoPublish);
          setLanguage(nextLanguage);
          setPerPlatformLanguages(nextPerPlatformLanguages);
        }}
      />
      <OptionsPanel
        open={optionsOpen}
        provider={provider}
        selectedModel={selectedModel}
        generationConfig={generationConfig}
        openaiApiKey={openaiApiKey}
        openrouterApiKey={openrouterApiKey}
        availableProviders={availableProviders}
        modelOptionsByProvider={{ openai: OPENAI_MODELS, openrouter: OPENROUTER_MODELS }}
        onClose={() => setOptionsOpen(false)}
        onSave={({
          provider: nextProvider,
          model: nextModel,
          generationConfig: nextConfig,
          openaiApiKey: nextOpenaiApiKey,
          openrouterApiKey: nextOpenrouterApiKey,
          rememberApiKeys: nextRememberApiKeys,
        }) => {
          setProvider(nextProvider);
          const nextModels = nextProvider === "openrouter" ? OPENROUTER_MODELS : OPENAI_MODELS;
          setSelectedModel(nextModel.trim() || nextModels[0]);
          setGenerationConfig(nextConfig);
          setOpenaiApiKey(nextOpenaiApiKey);
          setOpenrouterApiKey(nextOpenrouterApiKey);
          setRememberApiKeys(nextRememberApiKeys);
          window.localStorage.setItem("hmb_generation_config", JSON.stringify(nextConfig));
          if (nextRememberApiKeys) {
            window.localStorage.setItem("hmb_remember_api_keys", "1");
            window.localStorage.setItem("hmb_openai_api_key", nextOpenaiApiKey);
            window.localStorage.setItem("hmb_openrouter_api_key", nextOpenrouterApiKey);
          } else {
            window.localStorage.removeItem("hmb_remember_api_keys");
            window.localStorage.removeItem("hmb_openai_api_key");
            window.localStorage.removeItem("hmb_openrouter_api_key");
          }
          configureRuntimeApiKeys({ openaiApiKey: nextOpenaiApiKey, openrouterApiKey: nextOpenrouterApiKey });
        }}
      />

      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 md:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Auto-HongMyungbo</h1>
            <p className="text-xs font-medium lowercase tracking-wide text-zinc-500 dark:text-zinc-400">ai cross posting social content studio</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setContextOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5" /> Platform Writing Style
            </button>
            <button
              onClick={() => setOptionsOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              Options
            </button>
          </div>
        </header>

        <section className="mb-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <aside className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Draft</h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">ID: {draftId ?? "-"}</span>
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleTextareaKeydown}
              placeholder="Write your draft..."
              className="mb-3 h-44 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
            />
            <DraftRefinerPanel
              ref={refinerRef}
              draft={draft}
              provider={provider}
              model={selectedModel}
              generationConfig={generationConfig}
              language={toRefineLanguage(language)}
              platforms={selectedPlatforms}
              onReplaceDraft={setDraft}
              onInsertIntoDraft={handleInsertIntoDraft}
            />
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !draft.trim() || selectedPlatforms.length === 0}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Sparkles className="mr-1 inline h-3.5 w-3.5" /> {loading ? "Generating..." : `Generate ${selectedPlatforms.length} Platform${selectedPlatforms.length === 1 ? "" : "s"}`}
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !draftId || acceptedCount === 0}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-100"
              >
                {publishing ? "Publishing..." : scheduleEnabled ? `Scheduled Publish (${acceptedCount})` : `Queue Publish (${acceptedCount})`}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
                Schedule publish
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
                Platforms: {selectedPlatforms.join(", ") || "none"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Auto publish: {autoPublish ? "ON" : "OFF"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Language: {language}
              </span>
              {(["linkedin", "twitter", "instagram", "reddit"] as Platform[]).map((platform) => (
                <button
                  key={platform}
                  onClick={() => void handleOAuthConnect(platform)}
                  disabled={oauthBusyPlatform === platform}
                  className="rounded-full border border-zinc-300 px-2 py-1 text-[11px] capitalize text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  {oauthBusyPlatform === platform ? `${getPlatformLabel(platform)}...` : `${getPlatformLabel(platform)} OAuth`}
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
                {!queueByOrder.length && <p className="text-xs text-zinc-500 dark:text-zinc-400">Accepted cards are stored here.</p>}
              </div>
            </section>

            {publishJob && (
              <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">
                Job #{publishJob.id}: {publishJob.status}
              </p>
            )}

          </aside>

          <section className="min-w-0 overflow-visible rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Platform Results</h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  model: {selectedModel} | provider: {provider}
                  {generationConfig.thinkingMode ? ` | thinking: ${generationConfig.reasoningEffort}` : ""}
                  {rememberApiKeys ? " | api key: remembered" : " | api key: session only"}
                </span>
                <label className="flex items-center gap-2 rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                  <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} />
                  Compare mode
                </label>
              </div>
            </div>

            {!compareMode && cardsByOrder.length > 0 && (
              <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
                {cardsByOrder.map((card) => (
                  <button
                    key={cardKey(card)}
                    onClick={() => setActivePlatform(card.platform)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${
                      activePlatform === card.platform
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {card.platform}
                  </button>
                ))}
              </div>
            )}

            {compareMode ? (
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                {cardsByOrder.map((card) => (
                  <PlatformCard
                    key={cardKey(card)}
                    card={card}
                    isCollapsing={collapsingKeys.has(cardKey(card))}
                    onAccept={() => void handleAccept(card)}
                    onReject={() => void handleReject(card)}
                    onRefine={(feedback) => handleRefine(card.platform, feedback)}
                    onVoiceRefine={() => handleVoiceRefine(card.platform)}
                    onUndo={() => patchCard(card.platform, { versionIndex: Math.max(0, card.versionIndex - 1) })}
                    onRedo={() => patchCard(card.platform, { versionIndex: Math.min(card.versions.length - 1, card.versionIndex + 1) })}
                    onSelectVersion={(index) => patchCard(card.platform, { versionIndex: index })}
                    onPreviewChange={(title, body) => handlePreviewEdit(card.platform, title, body)}
                  />
                ))}
              </div>
            ) : activeCard ? (
              <PlatformCard
                card={activeCard}
                onAccept={() => void handleAccept(activeCard)}
                onReject={() => void handleReject(activeCard)}
                onRefine={(feedback) => handleRefine(activeCard.platform, feedback)}
                onVoiceRefine={() => handleVoiceRefine(activeCard.platform)}
                onUndo={() => patchCard(activeCard.platform, { versionIndex: Math.max(0, activeCard.versionIndex - 1) })}
                onRedo={() =>
                  patchCard(activeCard.platform, {
                    versionIndex: Math.min(activeCard.versions.length - 1, activeCard.versionIndex + 1),
                  })
                }
                onSelectVersion={(index) => patchCard(activeCard.platform, { versionIndex: index })}
                onPreviewChange={(title, body) => handlePreviewEdit(activeCard.platform, title, body)}
              />
            ) : (
              <div className="grid h-[360px] place-items-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No result cards yet. Generate from Draft, then Accept to move cards into Queue.
              </div>
            )}
          </section>
        </section>

        <footer className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Accept: Results -&gt; Queue | Click a Queue item to restore
          <CheckCheck className="ml-1 inline h-3.5 w-3.5" />
        </footer>

        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Publish Logs & Platform Threads</h3>
            <button onClick={() => void refreshPublishData()} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700 dark:text-zinc-100">
              {logsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
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
                {!publishLogs.length && <p className="text-xs text-zinc-500 dark:text-zinc-400">No logs yet.</p>}
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
                {!threads.length && <p className="text-xs text-zinc-500 dark:text-zinc-400">No platform threads yet.</p>}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
