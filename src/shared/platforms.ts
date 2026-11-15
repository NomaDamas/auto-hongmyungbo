import type { DocId, PlatformId } from "./types";

export interface PlatformDef {
  id: PlatformId;
  label: string;
  /** Hard character limit enforced by the platform. X uses weighted counting. */
  limit: number;
  /** Writing guidance injected into prompts for web AIs and harnesses. */
  guide: string;
}

export const PLATFORMS: Record<PlatformId, PlatformDef> = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    limit: 3000,
    guide:
      "Professional but personal. Strong first two lines (shown before 'see more'). Short paragraphs, concrete lesson or result, no hashtag spam (max 3 at the end).",
  },
  x: {
    id: "x",
    label: "X",
    limit: 280,
    guide:
      "Single post, max 280 weighted characters (Korean/CJK counts double). Punchy hook, one idea, no hashtags unless essential.",
  },
  threads: {
    id: "threads",
    label: "Threads",
    limit: 500,
    guide: "Casual, conversational, max 500 characters. Feels like talking to friends; end with an opener for replies.",
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    limit: 40000,
    guide:
      "First line is the title as '# Title' (max 300 chars). Body is plain, humble, value-first, no marketing tone, disclose self-promotion honestly.",
  },
};

export const ALL_PLATFORMS: PlatformId[] = ["linkedin", "x", "threads", "reddit"];
export const ALL_DOCS: DocId[] = ["master", ...ALL_PLATFORMS];

export function docLabel(doc: DocId): string {
  return doc === "master" ? "원문" : PLATFORMS[doc].label;
}

export function docFile(doc: DocId): string {
  return `${doc}.md`;
}
