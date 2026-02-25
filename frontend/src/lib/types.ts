export type Platform = "reddit" | "linkedin" | "twitter" | "instagram" | "threads" | "youtube" | "tiktok";

export type ModelOption = string;
export type ProviderOption = "openai" | "openrouter";
export type ReasoningEffortOption = "minimal" | "low" | "medium" | "high";
export type LanguageOption = "auto" | "korean" | "english" | "japanese";
export type LanguageSettingOption = LanguageOption | "per_platform";
export type PerPlatformLanguageMap = Record<Platform, LanguageOption>;

export type GeneratedCard = {
  id?: number;
  platform: Platform;
  title: string;
  body: string;
  suggestions: string[];
  status: "draft" | "accepted" | "rejected";
};

export type CardVersion = {
  title: string;
  body: string;
  suggestions: string[];
  source: "initial" | "refine";
  feedback?: string;
  createdAt: string;
};

export type CardState = GeneratedCard & {
  versions: CardVersion[];
  versionIndex: number;
  isRefining: boolean;
};

export type GenerateResponse = {
  draftId: number;
  cards: GeneratedCard[];
};

export type PublishJob = {
  id: number;
  type: string;
  status: "queued" | "running" | "done" | "failed";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
};

export type PublishLogItem = {
  id: number;
  draftId?: number | null;
  cardId?: number | null;
  platform: string;
  title?: string | null;
  body?: string | null;
  postId?: string | null;
  postUrl?: string | null;
  status: string;
  errorText?: string | null;
  createdAt: string;
};

export type SocialThread = {
  platform: string;
  items: PublishLogItem[];
};

export type UserProfile = {
  styles: Partial<
    Record<
      Platform,
      {
        mode: "auto" | "manual";
        customInstructions?: string;
        extractedTone?: string;
        referencePosts: string[];
      }
    >
  >;
};

export type GenerationConfig = {
  thinkingMode: boolean;
  reasoningEffort: ReasoningEffortOption;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
};

export type DraftRefineLanguage = "auto" | "ko" | "en";

export type DraftRefineBrief = {
  title?: string;
  coreMessage: string;
  audienceAssumption: string;
  keyPoints: string[];
  cta: string;
  hashtags?: string[];
};

export type DraftRefineQuestion = {
  id: string;
  question: string;
  choices?: string[];
};

export type DraftRefineAngle = {
  id: string;
  label: string;
  preview: string;
  draftSnippet?: string;
};

export type DraftRefineAttentionGuide = {
  strongestHook: string;
  hookOptions: string[];
  ctaOptions: string[];
  riskNotes: string[];
};

export type DraftRefineResponse = {
  brief: DraftRefineBrief;
  questions: DraftRefineQuestion[];
  angles: DraftRefineAngle[];
  attentionGuide?: DraftRefineAttentionGuide;
  polishedDraft: string;
};

export type SetupStatus = {
  llm: {
    envOpenAI: boolean;
    envOpenRouter: boolean;
  };
  oauth: Record<
    "linkedin" | "twitter" | "instagram" | "reddit" | "threads" | "youtube" | "tiktok",
    {
      configured: boolean;
      missing: string[];
    }
  >;
};
