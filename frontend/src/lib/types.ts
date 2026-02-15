export type Platform = "reddit" | "linkedin" | "twitter" | "instagram" | "blog";

export type ModelOption = "gpt-4o-mini" | "gpt-4o" | "gpt-4.1-mini";
export type LanguageOption = "auto" | "korean" | "english" | "japanese";

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
