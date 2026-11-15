import twitter from "twitter-text";
import type { DocId, PlatformId } from "@shared/types";
import { TITLE_PLATFORMS, docLimit, parseDoc } from "@shared/platforms";

export interface CountInfo {
  used: number;
  limit: number | null;
  /** Separate title count for platforms whose composer has a title field. */
  note?: string;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const TITLE_OVERRIDES: Partial<Record<PlatformId, number>> = {
  reddit: 300,
  hackernews: 80,
  producthunt: 60,
};

function graphemes(text: string): number {
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

export function countFor(doc: DocId, text: string): CountInfo {
  const { platform, variant } = parseDoc(doc);
  if (!platform) return { used: graphemes(text), limit: null };
  const limit = docLimit(doc);
  if (platform === "x") return { used: twitter.parseTweet(text).weightedLength, limit };
  if (variant === "post" && TITLE_PLATFORMS.includes(platform)) {
    const [first = "", ...rest] = text.split("\n");
    const title = first.replace(/^#\s*/, "");
    return {
      used: graphemes(rest.join("\n").trim()),
      limit,
      note: `제목 ${graphemes(title)}/${TITLE_OVERRIDES[platform] ?? 100}`,
    };
  }
  return { used: graphemes(text), limit };
}
