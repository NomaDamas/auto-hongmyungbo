export type Platform = "reddit" | "linkedin" | "twitter" | "instagram" | "blog";
export type SocialProvider = "google" | "kakao" | "naver";

export type ModelOption = string;
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

export type UserInfo = {
  id: number;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
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
