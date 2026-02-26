"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveRestore, CheckCheck, FileText, History, Inbox, Layers, MessageSquare, Settings2, SlidersHorizontal, Send, Sparkles, Trash2 } from "lucide-react";
import { getPlatformIcon } from "@/components/platform-icons";
import { PlatformCard } from "@/components/platform-card";
import { ContextPanel } from "@/components/context-panel";
import { OptionsPanel } from "@/components/options-panel";
import { DraftRefinerPanel, type DraftRefinerPanelRef } from "@/components/draft-refiner-panel";
import {
  configureDomLlm,
  configureRuntimeApiKeys,
  disconnectBrowserLogin,
  enqueuePublish,
  fetchProvider,
  fetchSetupStatus,
  generatePosts,
  getBrowserLoginSession,
  getJob,
  getPublishLogs,
  getThreads,
  refinePost,
  startBrowserLogin,
  transcribeAudio,
  updateCardStatus,
} from "@/lib/api";
import type {
  CardState,
  CardVersion,
  DomLlmProvider,
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
  SavedDraftSnapshot,
  SocialThread,
  SetupStatus,
  UserProfile,
} from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["reddit", "linkedin", "twitter", "threads", "instagram", "youtube", "tiktok"];

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
  threads: "",
  instagram: "",
  youtube: "",
  tiktok: "",
};
const EMPTY_REFERENCE_POSTS: Record<Platform, string[]> = {
  reddit: [],
  linkedin: [],
  twitter: [],
  threads: [],
  instagram: [],
  youtube: [],
  tiktok: [],
};
const DEFAULT_PER_PLATFORM_LANGUAGES: PerPlatformLanguageMap = {
  reddit: "auto",
  linkedin: "auto",
  twitter: "auto",
  threads: "auto",
  instagram: "auto",
  youtube: "auto",
  tiktok: "auto",
};
const DEFAULT_ENABLED_PLATFORMS: Record<Platform, boolean> = {
  reddit: true,
  linkedin: true,
  twitter: true,
  threads: true,
  instagram: true,
  youtube: true,
  tiktok: true,
};
const LAST_STYLE_KEY = "hmb_style_last_v1";
const DRAFT_AUTOSAVE_KEY = "hmb_draft_autosave_v1";
const DRAFT_HISTORY_KEY = "hmb_draft_history_v1";
const MAX_DRAFT_HISTORY = 10;
const OAUTH_PLATFORMS: Array<"linkedin" | "twitter" | "instagram" | "reddit" | "threads" | "youtube" | "tiktok"> = [
  "linkedin",
  "twitter",
  "instagram",
  "reddit",
  "threads",
  "youtube",
  "tiktok",
];

function cardKey(card: CardState): string {
  // Use a composite key to avoid collisions when backend/local ids are reused.
  if (card.id) return `id-${card.id}-${card.platform}`;
  return `platform-${card.platform}`;
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
  if (platform === "twitter") return "X";
  if (platform === "threads") return "Threads";
  if (platform === "youtube") return "YouTube";
  if (platform === "tiktok") return "TikTok";
  if (platform === "instagram") return "Instagram";
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "reddit") return "Reddit";
  return platform;
}

function toRefineLanguageFromOption(language: LanguageOption): DraftRefineLanguage {
  if (language === "korean") return "ko";
  if (language === "english") return "en";
  return "auto";
}

function toRefineLanguage(
  language: LanguageSettingOption,
  selectedPlatforms: Platform[],
  perPlatformLanguages: PerPlatformLanguageMap,
): DraftRefineLanguage {
  if (language !== "per_platform") {
    return toRefineLanguageFromOption(language);
  }
  const mapped = selectedPlatforms.map((p) => toRefineLanguageFromOption(perPlatformLanguages[p]));
  const unique = Array.from(new Set(mapped.filter((x) => x !== "auto")));
  if (unique.length === 1) return unique[0];
  return "auto";
}

const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  thinkingMode: false,
  reasoningEffort: "medium",
  temperature: 0.7,
  topP: 1,
  maxOutputTokens: 1500,
};

type PublishCardUiState = "Draft" | "Ready" | "Publishing" | "Posted" | "Failed";
type PublishActivityStatus = "running" | "success" | "failed";
type PublishActivity = {
  id: string;
  platform: Platform;
  status: PublishActivityStatus;
  message: string;
  at: string;
  screenshotDataUrl?: string;
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
  const [acceptingKeys, setAcceptingKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [publishJob, setPublishJob] = useState<PublishJob | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [publishCardStates, setPublishCardStates] = useState<Record<string, PublishCardUiState>>({});
  const [publishActivities, setPublishActivities] = useState<PublishActivity[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ total: number; done: number; current: string | null } | null>(null);
  const [oauthBusyPlatform, setOauthBusyPlatform] = useState<Platform | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupPromptOpen, setSetupPromptOpen] = useState(false);
  const [oauthConnected, setOauthConnected] = useState<Record<string, boolean>>({});
  const [oauthSyncing, setOauthSyncing] = useState(false);
  const [oauthChecked, setOauthChecked] = useState<Record<string, boolean>>({});

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const [savedDraftsOpen, setSavedDraftsOpen] = useState(false);
  const [draftHistory, setDraftHistory] = useState<SavedDraftSnapshot[]>([]);
  const [domLlmProvider, setDomLlmProvider] = useState<DomLlmProvider>("openai");
  const [domLlmApiKeys, setDomLlmApiKeys] = useState<Partial<Record<DomLlmProvider, string>>>({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const refinerRef = useRef<DraftRefinerPanelRef | null>(null);
  const prevDraftIdRef = useRef<number | null>(null);
  const publishRunRef = useRef(0);
  const loginStatusCacheRef = useRef<Partial<Record<Platform, { connected: boolean; checkedAt: number }>>>({});

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

  const setCardUiState = (card: CardState, state: PublishCardUiState) => {
    const key = cardKey(card);
    setPublishCardStates((prev) => ({ ...prev, [key]: state }));
  };

  const appendPublishActivity = (entry: Omit<PublishActivity, "id" | "at">) => {
    setPublishActivities((prev) => [
      {
        id: `${entry.platform}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toISOString(),
        ...entry,
      },
      ...prev,
    ].slice(0, 40));
  };

  const syncBrowserLoginStatus = async (
    platforms: Platform[] = OAUTH_PLATFORMS as Platform[],
    options?: { force?: boolean },
  ): Promise<Partial<Record<Platform, boolean>>> => {
    const force = options?.force ?? false;
    setOauthSyncing(true);
    try {
      const checks = await Promise.all(
        platforms.map(async (platform) => {
          const cached = loginStatusCacheRef.current[platform];
          if (!force && cached && Date.now() - cached.checkedAt < 30_000) {
            return { platform, connected: cached.connected };
          }
          try {
            const { connected } = await getBrowserLoginSession(platform);
            loginStatusCacheRef.current[platform] = { connected, checkedAt: Date.now() };
            return { platform, connected };
          } catch {
            loginStatusCacheRef.current[platform] = { connected: false, checkedAt: Date.now() };
            return { platform, connected: false };
          }
        }),
      );
      const next: Record<string, boolean> = {};
      for (const item of checks) {
        next[item.platform] = item.connected;
        if (item.connected) {
          window.localStorage.setItem(`hmb_oauth_connected_${item.platform}`, "1");
        } else {
          window.localStorage.removeItem(`hmb_oauth_connected_${item.platform}`);
        }
      }
      setOauthConnected((prev) => ({ ...prev, ...next }));
      setOauthChecked((prev) => ({
        ...prev,
        ...Object.fromEntries(checks.map((item) => [item.platform, true])),
      }));
      return Object.fromEntries(checks.map((item) => [item.platform, item.connected])) as Partial<Record<Platform, boolean>>;
    } finally {
      setOauthSyncing(false);
    }
  };

  const ensureConnectedBeforePublish = async (platforms: Platform[]): Promise<boolean> => {
    if (!platforms.length) return true;
    const checkMap = await syncBrowserLoginStatus(platforms, { force: true });
    const disconnected = platforms.filter((p) => !checkMap[p]);
    if (!disconnected.length) return true;
    const labels = disconnected.map((p) => getPlatformLabel(p)).join(", ");
    alert(`Login required before publish: ${labels}`);
    return false;
  };

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
    try {
      const domCfg = window.localStorage.getItem("hmb_dom_llm_config");
      if (domCfg) {
        const parsed = JSON.parse(domCfg) as { provider?: DomLlmProvider; apiKeys?: Partial<Record<DomLlmProvider, string>> };
        if (parsed.provider) setDomLlmProvider(parsed.provider);
        if (parsed.apiKeys) setDomLlmApiKeys(parsed.apiKeys);
        configureDomLlm(parsed.provider || "openai", parsed.apiKeys || {});
      }
    } catch { /* ignore */ }
    configureRuntimeApiKeys({ openaiApiKey: savedOpenaiApiKey, openrouterApiKey: savedOpenrouterApiKey });
    try {
      const raw = window.localStorage.getItem(LAST_STYLE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          contexts?: Record<Platform, string>;
          referencePosts?: Record<Platform, string[]>;
          enabledPlatforms?: Record<Platform, boolean>;
          autoPublish?: boolean;
          language?: LanguageSettingOption;
          perPlatformLanguages?: PerPlatformLanguageMap;
        };
        if (saved.contexts) setContexts({ ...EMPTY_CONTEXTS, ...saved.contexts });
        if (saved.referencePosts) setReferencePosts({ ...EMPTY_REFERENCE_POSTS, ...saved.referencePosts });
        if (saved.enabledPlatforms) setEnabledPlatforms({ ...DEFAULT_ENABLED_PLATFORMS, ...saved.enabledPlatforms });
        if (typeof saved.autoPublish === "boolean") setAutoPublish(saved.autoPublish);
        if (saved.language) setLanguage(saved.language);
        if (saved.perPlatformLanguages) setPerPlatformLanguages({ ...DEFAULT_PER_PLATFORM_LANGUAGES, ...saved.perPlatformLanguages });
      }
    } catch {
      // Ignore malformed local style cache.
    }

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
        const status = await fetchSetupStatus();
        setSetupStatus(status);
        const hasLocalKey = Boolean(savedOpenaiApiKey.trim() || savedOpenrouterApiKey.trim());
        const hasEnvKey = status.llm.envOpenAI || status.llm.envOpenRouter;
        if (!hasLocalKey && !hasEnvKey) setSetupPromptOpen(true);
      } catch (err) {
        console.error(err);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOauthConnected({});
    setOauthChecked({});
    void syncBrowserLoginStatus(OAUTH_PLATFORMS as Platform[]);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = (event.data || {}) as { type?: string; platform?: string; ok?: boolean; error?: string };
      if (data.type !== "hmb_oauth_callback" || !data.platform) return;
      if (data.ok) {
        void syncBrowserLoginStatus([data.platform as Platform]);
      } else {
        alert(data.error || `${data.platform} login failed.`);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    void refreshPublishData();
  }, []);

  // --- Draft auto-restore on mount ---
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_AUTOSAVE_KEY);
      if (raw) {
        const snapshot = JSON.parse(raw) as SavedDraftSnapshot;
        if (snapshot.draft || snapshot.cards?.length) {
          setDraft(snapshot.draft || "");
          setResultCards(snapshot.cards || []);
        }
      }
      const historyRaw = window.localStorage.getItem(DRAFT_HISTORY_KEY);
      if (historyRaw) {
        setDraftHistory(JSON.parse(historyRaw) as SavedDraftSnapshot[]);
      }
    } catch {
      // Ignore corrupted localStorage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Draft auto-save (debounced) ---
  useEffect(() => {
    if (!draft && !resultCards.length) return;
    const timer = setTimeout(() => {
      try {
        const snapshot: SavedDraftSnapshot = {
          id: draftId ? String(draftId) : "local",
          draft,
          cards: resultCards,
          createdAt: new Date().toISOString(),
        };
        window.localStorage.setItem(DRAFT_AUTOSAVE_KEY, JSON.stringify(snapshot));
      } catch {
        // Ignore storage quota issues
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [draft, resultCards, draftId]);

  // --- Push to history when a new generation session starts ---
  useEffect(() => {
    if (!draftId || draftId === prevDraftIdRef.current) {
      prevDraftIdRef.current = draftId;
      return;
    }
    // New draftId — push previous autosave to history
    try {
      const prevRaw = window.localStorage.getItem(DRAFT_AUTOSAVE_KEY);
      if (prevRaw) {
        const prevSnapshot = JSON.parse(prevRaw) as SavedDraftSnapshot;
        if (prevSnapshot.cards?.length && prevSnapshot.id !== String(draftId)) {
          setDraftHistory((prev) => {
            const next = [prevSnapshot, ...prev].slice(0, MAX_DRAFT_HISTORY);
            window.localStorage.setItem(DRAFT_HISTORY_KEY, JSON.stringify(next));
            return next;
          });
        }
      }
    } catch {
      // Ignore
    }
    prevDraftIdRef.current = draftId;
  }, [draftId]);

  const handleRestoreDraft = (snapshot: SavedDraftSnapshot) => {
    setDraft(snapshot.draft || "");
    setResultCards(snapshot.cards || []);
    setSavedDraftsOpen(false);
  };

  const handleDeleteDraft = (id: string) => {
    setDraftHistory((prev) => {
      const next = prev.filter((s) => s.id !== id);
      window.localStorage.setItem(DRAFT_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const saveDraftSnapshotNow = (reason: "publish" | "manual" = "manual") => {
    try {
      const snapshot: SavedDraftSnapshot = {
        id: draftId ? `${draftId}-${reason}-${Date.now()}` : `local-${reason}-${Date.now()}`,
        draft,
        cards: resultCards,
        createdAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DRAFT_AUTOSAVE_KEY, JSON.stringify(snapshot));
      setDraftHistory((prev) => {
        const next = [snapshot, ...prev].slice(0, MAX_DRAFT_HISTORY);
        window.localStorage.setItem(DRAFT_HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    } catch {
      // Ignore storage quota issues.
    }
  };

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
      const loginRefreshPromise = syncBrowserLoginStatus(selectedPlatforms);
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
      await loginRefreshPromise;
      setDraftId(generated.draftId);
      const nextCards = generated.cards.map(toCardState);
      setResultCards(nextCards);
      const nextCardStates: Record<string, PublishCardUiState> = {};
      for (const card of nextCards) {
        nextCardStates[cardKey(card)] = "Draft";
      }
      setPublishCardStates(nextCardStates);
      setPublishActivities([]);
      setBatchProgress(null);
      setBatchPublishing(false);
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
      setQueueCards((prev) => {
        if (prev.some((c) => cardKey(c) === key)) return prev;
        return insertByPlatformOrder([...prev, { ...card, status: "accepted" }]);
      });
      setPublishCardStates((prev) => ({ ...prev, [key]: "Ready" }));
      setCollapsingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 260);
  };

  const handleAccept = async (card: CardState) => {
    const key = cardKey(card);
    if (acceptingKeys.has(key)) return;
    setAcceptingKeys((prev) => new Set(prev).add(key));
    try {
      if (card.id) {
        await updateCardStatus(card.id, "accepted");
      }
      moveToQueue(card);
    } catch (err) {
      console.error(err);
      alert("Accept failed.");
    } finally {
      setAcceptingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
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
      setPublishCardStates((prev) => ({ ...prev, [key]: "Draft" }));
    } catch (err) {
      console.error(err);
      alert("Restore failed.");
    }
  };

  const removeCardFromResults = (card: CardState) => {
    const key = cardKey(card);
    setPublishCardStates((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setResultCards((prev) => {
      const next = prev.filter((c) => cardKey(c) !== key);
      if (!next.length) return next;
      if (activePlatform === card.platform) {
        setActivePlatform(next[0].platform);
      }
      return next;
    });
  };

  const handleReject = async (card: CardState) => {
    if (!card.id) {
      removeCardFromResults(card);
      return;
    }

    try {
      await updateCardStatus(card.id, "rejected");
      removeCardFromResults(card);
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

  const publishOneFromQueue = async (
    card: CardState,
    runId: number,
    options?: { confirmManual?: boolean; showFailureAlert?: boolean },
  ): Promise<{ ok: boolean; keptInQueue: boolean; error?: string }> => {
    // Keep one-card publish isolated so queue list can trigger direct publish.
    publishRunRef.current = runId;
    setPublishing(true);

    const manualPlatforms: Platform[] = ["reddit", "instagram", "threads", "youtube", "tiktok"];
    const key = cardKey(card);
    const current = card.versions[card.versionIndex];
    const clipboardText = [current.title, "", current.body].filter(Boolean).join("\n").trim();
    const label = getPlatformLabel(card.platform);
    const isManual = manualPlatforms.includes(card.platform);
    setCardUiState(card, "Publishing");
    appendPublishActivity({
      platform: card.platform,
      status: "running",
      message: `${label} publishing started`,
    });

    const confirmManual = options?.confirmManual ?? true;
    const showFailureAlert = options?.showFailureAlert ?? true;

    try {
      // Copy this platform's content to clipboard before its browser window opens
      if (clipboardText) {
        try {
          await navigator.clipboard.writeText(clipboardText);
        } catch {
          // Clipboard write can fail in non-secure contexts
        }
      }

      type JobResult = {
        published?: Array<{ cardId?: number; postId?: string; screenshotDataUrl?: string }>;
        failed?: Array<{ cardId?: number; error?: string; screenshotDataUrl?: string }>;
      };
      let jobDone = false;
      let jobSuccess = false;
      let jobResult: JobResult | null = null;
      try {
        const cardIds = typeof card.id === "number" ? [card.id] : [];
        const queued = await enqueuePublish({
          draftId: draftId as number,
          cardIds,
          acceptedOnly: false,
          scheduledAt: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          publishMode: "browser",
        });

        // Poll until this single-platform job finishes
        for (let i = 0; i < 600; i += 1) {
          if (publishRunRef.current !== runId) return { ok: false, keptInQueue: true, error: "publish run replaced" };
          const job = await getJob(queued.jobId);
          if (publishRunRef.current !== runId) return { ok: false, keptInQueue: true, error: "publish run replaced" };
          setPublishJob(job);
          if (job.status === "done" || job.status === "failed") {
            jobDone = true;
            jobSuccess = job.status === "done";
            jobResult = (job.result as JobResult) ?? null;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      } catch (err) {
        console.error(`Publish failed for ${card.platform}:`, err);
      }

      if (isManual) {
        if (publishRunRef.current !== runId) return { ok: false, keptInQueue: true, error: "publish run replaced" };
        // Check if the server detected success signals on the page
        const publishedItem = jobResult?.published?.find((p) => p.cardId === card.id);
        const serverConfirmed = publishedItem?.postId?.includes("manual-confirmed");
        const failedItem = jobResult?.failed?.find((f) => f.cardId === card.id);
        const failureReason = failedItem?.error ? `\n\nReason: ${failedItem.error}` : "";

        if (serverConfirmed) {
          setQueueCards((prev) => prev.filter((c) => cardKey(c) !== key));
          setCardUiState(card, "Posted");
          appendPublishActivity({
            platform: card.platform,
            status: "success",
            message: `${label} posted`,
            screenshotDataUrl: publishedItem?.screenshotDataUrl,
          });
          return { ok: true, keptInQueue: false };
        } else {
          if (confirmManual) {
            const userConfirmed = window.confirm(
              `[${label}] Did you complete posting?${failureReason}\n\nOK = posted, remove from queue\nCancel = keep in queue for retry`,
            );
            if (userConfirmed) {
              setQueueCards((prev) => prev.filter((c) => cardKey(c) !== key));
              setCardUiState(card, "Posted");
              appendPublishActivity({
                platform: card.platform,
                status: "success",
                message: `${label} posted (manual confirm)`,
                screenshotDataUrl: publishedItem?.screenshotDataUrl || failedItem?.screenshotDataUrl,
              });
              return { ok: true, keptInQueue: false };
            }
          }
          setCardUiState(card, "Failed");
          appendPublishActivity({
            platform: card.platform,
            status: "failed",
            message: `${label} pending manual completion`,
            screenshotDataUrl: failedItem?.screenshotDataUrl,
          });
          return { ok: false, keptInQueue: true, error: failedItem?.error || "manual confirmation required" };
        }
      } else {
        if (publishRunRef.current !== runId) return { ok: false, keptInQueue: true, error: "publish run replaced" };
        // Automated platforms: flush on success, keep on failure for retry.
        if (jobDone && jobSuccess) {
          setQueueCards((prev) => prev.filter((c) => cardKey(c) !== key));
          const publishedItem = jobResult?.published?.find((p) => p.cardId === card.id);
          setCardUiState(card, "Posted");
          appendPublishActivity({
            platform: card.platform,
            status: "success",
            message: `${label} posted`,
            screenshotDataUrl: publishedItem?.screenshotDataUrl,
          });
          return { ok: true, keptInQueue: false };
        } else if (jobDone) {
          const failedItem = jobResult?.failed?.find((f) => f.cardId === card.id);
          const failureReason = failedItem?.error ? `\nReason: ${failedItem.error}` : "";
          setCardUiState(card, "Failed");
          appendPublishActivity({
            platform: card.platform,
            status: "failed",
            message: `${label} publish failed${failedItem?.error ? `: ${failedItem.error}` : ""}`,
            screenshotDataUrl: failedItem?.screenshotDataUrl,
          });
          if (showFailureAlert) {
            alert(`${label} publish failed. Keeping in queue for retry.${failureReason}`);
          }
          return { ok: false, keptInQueue: true, error: failedItem?.error || "publish failed" };
        }
      }
      setCardUiState(card, "Failed");
      appendPublishActivity({
        platform: card.platform,
        status: "failed",
        message: `${label} publish did not complete`,
      });
      return { ok: false, keptInQueue: true, error: "publish did not complete" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish request failed.";
      setCardUiState(card, "Failed");
      appendPublishActivity({
        platform: card.platform,
        status: "failed",
        message: `${label} failed: ${message}`,
      });
      return { ok: false, keptInQueue: true, error: message };
    } finally {
      if (publishRunRef.current === runId) {
        setPublishing(false);
      }
      await refreshPublishData();
    }
  };

  const handlePublishNow = async (card: CardState) => {
    if (!draftId) {
      alert("Generate posts first.");
      return;
    }
    const ready = await ensureConnectedBeforePublish([card.platform]);
    if (!ready) return;
    // Force-save immediately at publish click to prevent data loss on crash/close.
    saveDraftSnapshotNow("publish");
    const runId = Date.now();
    await publishOneFromQueue(card, runId, { confirmManual: true, showFailureAlert: true });
  };

  const handlePublish = async () => {
    const runId = Date.now();
    if (!draftId) {
      alert("Generate posts first.");
      return;
    }
    if (queueCards.length === 0) {
      alert("No cards in queue.");
      return;
    }
    const card = queueCards[0];
    const ready = await ensureConnectedBeforePublish([card.platform]);
    if (!ready) return;
    // Force-save immediately at publish click to prevent data loss on crash/close.
    saveDraftSnapshotNow("publish");
    // Process only the FIRST card in queue. After it finishes, user can publish next card.
    await publishOneFromQueue(card, runId, { confirmManual: true, showFailureAlert: true });
  };

  const handlePublishAll = async () => {
    if (!draftId) {
      alert("Generate posts first.");
      return;
    }
    if (queueByOrder.length === 0) {
      alert("No cards in queue.");
      return;
    }
    const allPlatforms = Array.from(new Set(queueByOrder.map((c) => c.platform)));
    const ready = await ensureConnectedBeforePublish(allPlatforms);
    if (!ready) return;
    saveDraftSnapshotNow("publish");
    setBatchPublishing(true);
    const planned = [...queueByOrder];
    setBatchProgress({ total: planned.length, done: 0, current: planned[0] ? getPlatformLabel(planned[0].platform) : null });

    try {
      for (let i = 0; i < planned.length; i += 1) {
        const card = planned[i];
        const runId = Date.now() + i;
        setBatchProgress({ total: planned.length, done: i, current: getPlatformLabel(card.platform) });
        const outcome = await publishOneFromQueue(card, runId, { confirmManual: false, showFailureAlert: false });
        if (!outcome.ok && outcome.keptInQueue) {
          const retryFromHere = window.confirm(
            `[${getPlatformLabel(card.platform)}] failed.\n\nOK = Retry from this platform\nCancel = Continue manually and move to next`,
          );
          if (retryFromHere) {
            i -= 1;
            continue;
          }
          setQueueCards((prev) => prev.filter((c) => cardKey(c) !== cardKey(card)));
          setCardUiState(card, "Failed");
          appendPublishActivity({
            platform: card.platform,
            status: "failed",
            message: `${getPlatformLabel(card.platform)} skipped and marked for manual follow-up`,
          });
        }
      }
    } finally {
      setBatchProgress((prev) => (prev ? { ...prev, done: prev.total, current: null } : prev));
      setBatchPublishing(false);
    }
  };

  const handleOAuthConnect = async (platform: Platform) => {
    try {
      setOauthBusyPlatform(platform);
      if (oauthConnected[platform]) {
        const relogin = window.confirm(
          `${getPlatformLabel(platform)} is currently connected.\n\nOK = switch account (re-login)\nCancel = just re-check connection`,
        );
        if (!relogin) {
          await syncBrowserLoginStatus([platform]);
          alert(`${getPlatformLabel(platform)} is connected.`);
        } else {
          await disconnectBrowserLogin(platform);
          loginStatusCacheRef.current[platform] = { connected: false, checkedAt: Date.now() };
          window.localStorage.removeItem(`hmb_oauth_connected_${platform}`);
          setOauthConnected((prev) => ({ ...prev, [platform]: false }));
          const result = await startBrowserLogin(platform, 120000);
          await syncBrowserLoginStatus([platform], { force: true });
          if (result.ok) {
            alert(`${getPlatformLabel(platform)} re-login completed.`);
          } else {
            alert(result.message);
          }
        }
      } else {
        const result = await startBrowserLogin(platform, 120000);
        await syncBrowserLoginStatus([platform], { force: true });
        if (result.ok) {
          alert(`${result.message} Browser session is saved for ${getPlatformLabel(platform)}.`);
        } else {
          alert(result.message);
        }
      }
    } catch (err) {
      console.error(err);
      window.localStorage.removeItem(`hmb_oauth_connected_${platform}`);
      setOauthConnected((prev) => ({ ...prev, [platform]: false }));
      const message = err instanceof Error ? err.message : "Failed to start browser login.";
      alert(message);
    } finally {
      loginStatusCacheRef.current[platform] = undefined;
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
      {setupPromptOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <aside className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <header className="mb-3">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Initial Setup Required</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                If keys are already in <code>frontend/.env</code>, restart the app and refresh.
              </p>
            </header>
            <div className="space-y-3 text-xs">
              {setupStatus && !(setupStatus.llm.envOpenAI || setupStatus.llm.envOpenRouter || openaiApiKey || openrouterApiKey) && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 dark:border-amber-600/60 dark:bg-amber-500/10 dark:text-amber-200">
                  Add at least one LLM key: <code>OPENAI_API_KEY</code> or <code>OPENROUTER_API_KEY</code>
                </div>
              )}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">Easy mode (recommended)</p>
                <p className="text-zinc-600 dark:text-zinc-300">
                  You do not need OAuth API keys for basic usage.
                </p>
                <p className="text-zinc-600 dark:text-zinc-300">
                  Click each platform <strong>Browser Login</strong> once, then use one-click publish.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSetupPromptOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:text-zinc-200"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSetupPromptOpen(false);
                  setOptionsOpen(true);
                }}
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
              >
                Open Options (API Key)
              </button>
            </div>
          </aside>
        </div>
      )}
      {/* Saved Drafts Modal */}
      {savedDraftsOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <aside className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Saved Drafts</h2>
              <button
                onClick={() => setSavedDraftsOpen(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700 dark:text-zinc-200"
              >
                Close
              </button>
            </header>
            {draftHistory.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">No saved drafts yet. Drafts are saved automatically when you generate new content.</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {draftHistory.map((snapshot) => (
                  <li
                    key={snapshot.id + snapshot.createdAt}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {snapshot.draft?.slice(0, 50) || "(empty draft)"}
                      {(snapshot.draft?.length ?? 0) > 50 ? "..." : ""}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(snapshot.createdAt).toLocaleString()} &middot; {snapshot.cards?.length ?? 0} platform(s)
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleRestoreDraft(snapshot)}
                        className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700"
                      >
                        <ArchiveRestore className="mr-1 inline h-3 w-3" /> Restore
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(snapshot.id)}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="mr-1 inline h-3 w-3" /> Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

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
          try {
            window.localStorage.setItem(
              LAST_STYLE_KEY,
              JSON.stringify({
                contexts: nextContexts,
                referencePosts: nextReferencePosts,
                enabledPlatforms: nextEnabled,
                autoPublish: nextAutoPublish,
                language: nextLanguage,
                perPlatformLanguages: nextPerPlatformLanguages,
              }),
            );
          } catch {
            // Ignore storage quota issues.
          }
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
        domLlmProvider={domLlmProvider}
        domLlmApiKeys={domLlmApiKeys}
        onClose={() => setOptionsOpen(false)}
        onSave={({
          provider: nextProvider,
          model: nextModel,
          generationConfig: nextConfig,
          openaiApiKey: nextOpenaiApiKey,
          openrouterApiKey: nextOpenrouterApiKey,
          rememberApiKeys: nextRememberApiKeys,
          domLlmProvider: nextDomProvider,
          domLlmApiKeys: nextDomApiKeys,
        }) => {
          setProvider(nextProvider);
          const nextModels = nextProvider === "openrouter" ? OPENROUTER_MODELS : OPENAI_MODELS;
          setSelectedModel(nextModel.trim() || nextModels[0]);
          setGenerationConfig(nextConfig);
          setOpenaiApiKey(nextOpenaiApiKey);
          setOpenrouterApiKey(nextOpenrouterApiKey);
          setRememberApiKeys(nextRememberApiKeys);
          setDomLlmProvider(nextDomProvider);
          setDomLlmApiKeys(nextDomApiKeys);
          configureDomLlm(nextDomProvider, nextDomApiKeys);
          window.localStorage.setItem("hmb_generation_config", JSON.stringify(nextConfig));
          window.localStorage.setItem("hmb_dom_llm_config", JSON.stringify({ provider: nextDomProvider, apiKeys: nextDomApiKeys }));
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
        <header className="relative mb-4 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 opacity-60" />
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Auto-HongMyungbo</h1>
            <p className="text-xs font-medium lowercase tracking-wide text-zinc-500 dark:text-zinc-400">ai cross posting social content studio</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSavedDraftsOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium transition-colors hover:border-amber-400 hover:text-amber-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-amber-500 dark:hover:text-amber-300"
            >
              <History className="mr-1 inline h-3.5 w-3.5" /> Saved Drafts{draftHistory.length > 0 ? ` (${draftHistory.length})` : ""}
            </button>
            <button
              onClick={() => setContextOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium transition-colors hover:border-violet-400 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-500 dark:hover:text-violet-300"
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5" /> Platform Writing Style
            </button>
            <button
              onClick={() => setOptionsOpen(true)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium transition-colors hover:border-violet-400 hover:text-violet-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-violet-500 dark:hover:text-violet-300"
            >
              <SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" /> Options
            </button>
          </div>
        </header>

        <section className="mb-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.05fr_1.95fr]">
          <aside className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Draft</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">ID: {draftId ?? "-"}</span>
              </div>
              <button
                type="button"
                onClick={() => refinerRef.current?.openAndRefine()}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                ✨ Draft Idea Booster
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleTextareaKeydown}
              placeholder="Write your draft..."
              className="mb-3 h-44 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400/50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-violet-500/40"
            />
            <DraftRefinerPanel
              ref={refinerRef}
              draft={draft}
              provider={provider}
              model={selectedModel}
              generationConfig={generationConfig}
              language={toRefineLanguage(language, selectedPlatforms, perPlatformLanguages)}
              platforms={selectedPlatforms}
              onReplaceDraft={setDraft}
              onInsertIntoDraft={handleInsertIntoDraft}
            />
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !draft.trim() || selectedPlatforms.length === 0}
                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-glow-sm disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-600"
              >
                <Sparkles className="mr-1 inline h-3.5 w-3.5" /> {loading ? "Generating..." : `Generate ${selectedPlatforms.length} Platform${selectedPlatforms.length === 1 ? "" : "s"}`}
              </button>
              <button
                onClick={handlePublish}
                disabled={!draftId || acceptedCount === 0}
                className="rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10"
              >
                <Send className="mr-1 inline h-3.5 w-3.5" /> {publishing ? "Publishing..." : `Post Next Platform (${acceptedCount})`}
              </button>
              <button
                onClick={handlePublishAll}
                disabled={!draftId || acceptedCount === 0 || publishing || batchPublishing}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {batchPublishing ? "Publishing All..." : `Post All (Beta) (${acceptedCount})`}
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
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                {selectedPlatforms.length ? selectedPlatforms.map((p) => getPlatformLabel(p)).join(", ") : "no platforms"}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${autoPublish ? "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400"}`}>
                auto: {autoPublish ? "ON" : "OFF"}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                lang: {language}
              </span>
              {(OAUTH_PLATFORMS as Platform[]).map((platform) => {
                const Icon = getPlatformIcon(platform);
                const oauthPlatform = platform as "linkedin" | "twitter" | "instagram" | "reddit" | "threads" | "youtube" | "tiktok";
                const connected = Boolean(oauthConnected[oauthPlatform]);
                const checked = Boolean(oauthChecked[oauthPlatform]);
                const label = !checked ? "Checking..." : connected ? "Connected" : "Browser Login";
                return (
                  <button
                    key={platform}
                    onClick={() => void handleOAuthConnect(platform)}
                    disabled={oauthBusyPlatform === platform || (!checked && oauthSyncing)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors disabled:opacity-50 ${
                      !checked
                        ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400"
                        : connected
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-700/60"
                    }`}
                    title={!checked ? "Checking current login status..." : connected ? "Connected. Click to re-check status." : "Login once in popup browser."}
                  >
                    <Icon className="h-3 w-3" />
                    {oauthBusyPlatform === platform ? "..." : label}
                  </button>
                );
              })}
            </div>

            <section className="mt-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Queue</h3>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{acceptedCount} accepted</span>
              </div>
              <div className="space-y-2">
                {queueByOrder.map((card) => (
                  <div
                    key={cardKey(card)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-left dark:border-zinc-700"
                  >
                    {(() => {
                      const state = publishCardStates[cardKey(card)] || "Ready";
                      const stateClass =
                        state === "Posted"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                          : state === "Failed"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                          : state === "Publishing"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
                      return (
                        <div className="mb-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stateClass}`}>{state}</span>
                        </div>
                      );
                    })()}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{getPlatformLabel(card.platform)}</p>
                        <p className="line-clamp-1 text-[11px] text-zinc-600 dark:text-zinc-300">{card.versions[card.versionIndex].title}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handlePublishNow(card)}
                          className="rounded-md bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
                          disabled={publishing || batchPublishing}
                          title="Publish this queue item only"
                        >
                          Publish now
                        </button>
                        <button
                          onClick={() => void handleRestoreFromQueue(card)}
                          className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] dark:bg-zinc-800 dark:text-zinc-100"
                          title="Restore this card to Platform Results"
                        >
                          <ArchiveRestore className="inline h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!queueByOrder.length && (
                  <div className="flex flex-col items-center gap-1 py-4 text-center">
                    <Inbox className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Accepted cards appear here</p>
                  </div>
                )}
              </div>
            </section>

            {batchProgress && (
              <section className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Batch Publish Progress</p>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {batchProgress.done}/{batchProgress.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-violet-600 transition-all dark:bg-violet-500"
                    style={{ width: `${batchProgress.total ? Math.min(100, (batchProgress.done / batchProgress.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {batchProgress.current ? `Current: ${batchProgress.current}` : "Completed"}
                </p>
              </section>
            )}

            {publishActivities.length > 0 && (
              <section className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Publish Run Log</p>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{publishActivities.length} events</span>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {publishActivities.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-zinc-200 px-2 py-1.5 dark:border-zinc-700">
                      <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {getPlatformLabel(entry.platform)} ·{" "}
                        <span className={entry.status === "success" ? "text-emerald-600 dark:text-emerald-400" : entry.status === "failed" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}>
                          {entry.status}
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300">{entry.message}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{new Date(entry.at).toLocaleTimeString()}</p>
                      {entry.screenshotDataUrl && (
                        <a
                          href={entry.screenshotDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-violet-600 underline dark:text-violet-400"
                        >
                          screenshot
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {publishJob && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                <span className={`h-1.5 w-1.5 rounded-full ${publishJob.status === "done" ? "bg-emerald-500" : publishJob.status === "failed" ? "bg-rose-500" : "bg-amber-500 animate-pulse"}`} />
                Job #{publishJob.id}: {publishJob.status}
              </div>
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
                {cardsByOrder.map((card) => {
                  const Icon = getPlatformIcon(card.platform);
                  return (
                    <button
                      key={cardKey(card)}
                      onClick={() => setActivePlatform(card.platform)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                        activePlatform === card.platform
                          ? "bg-violet-600 text-white dark:bg-violet-500"
                          : "border border-zinc-300 text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-violet-500/50"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {getPlatformLabel(card.platform)}
                    </button>
                  );
                })}
              </div>
            )}

            {compareMode ? (
              <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                {cardsByOrder.map((card) => (
                  <PlatformCard
                    key={cardKey(card)}
                    card={card}
                    publishStateLabel={publishCardStates[cardKey(card)] || "Draft"}
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
                publishStateLabel={publishCardStates[cardKey(activeCard)] || "Draft"}
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
              <div className="grid h-[360px] place-items-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                <div className="flex flex-col items-center gap-2 text-center">
                  <Layers className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No results yet</p>
                  <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">Write a draft and hit Generate. Accept cards to move them into the publish queue.</p>
                </div>
              </div>
            )}
          </section>
        </section>

        <footer className="py-1 text-center text-xs text-zinc-400 dark:text-zinc-500">
          <CheckCheck className="mr-1 inline h-3.5 w-3.5" />
          Compose -&gt; Review (platform cards) -&gt; Publish
        </footer>

        <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Advanced</h3>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs transition-colors hover:border-violet-400 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-violet-500"
            >
              {showAdvanced ? "Hide" : "Show"}
            </button>
          </div>
          {showAdvanced && (
            <div className="mt-3">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Publish Logs & Platform Threads</h4>
                <button onClick={() => void refreshPublishData()} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs transition-colors hover:border-violet-400 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-violet-500">
                  {logsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <FileText className="mr-1 inline h-3 w-3" /> Promotion Log
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {publishLogs.map((log) => (
                      <div key={log.id} className="rounded-lg border-l-2 border-violet-400 bg-white px-3 py-2 text-xs shadow-sm dark:border-violet-500/60 dark:bg-zinc-800/50">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{getPlatformLabel(log.platform as Platform)} · <span className={log.status === "published" ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}>{log.status}</span></p>
                        <p className="line-clamp-1 text-zinc-600 dark:text-zinc-300">{log.title || "-"}</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{new Date(log.createdAt).toLocaleString()}</p>
                        {log.postUrl && (
                          <a className="text-[11px] text-violet-600 underline dark:text-violet-400" href={log.postUrl} target="_blank" rel="noreferrer">open</a>
                        )}
                      </div>
                    ))}
                    {!publishLogs.length && (
                      <div className="flex flex-col items-center gap-1 py-6 text-center">
                        <FileText className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">No publish logs yet</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    <MessageSquare className="mr-1 inline h-3 w-3" /> Platform Threads
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {threads.map((thread) => (
                      <div key={thread.platform} className="rounded-lg border-l-2 border-violet-400 bg-white px-3 py-2 text-xs shadow-sm dark:border-violet-500/60 dark:bg-zinc-800/50">
                        <p className="mb-1 font-semibold text-zinc-900 dark:text-zinc-100">{getPlatformLabel(thread.platform as Platform)}</p>
                        <div className="space-y-1">
                          {thread.items.slice(0, 5).map((item) => (
                            <p key={item.id} className="line-clamp-1 text-zinc-600 dark:text-zinc-300">{item.title || item.body || "-"}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!threads.length && (
                      <div className="flex flex-col items-center gap-1 py-6 text-center">
                        <MessageSquare className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">No platform threads yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
