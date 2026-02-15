export type Platform = "reddit" | "linkedin" | "twitter" | "instagram" | "blog";

export type GeneratedCard = {
  id?: number;
  platform: Platform;
  title: string;
  body: string;
  suggestions: string[];
  status: "draft" | "accepted" | "rejected";
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
