import twitter from "twitter-text";
import type { DocId } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";

export interface CountInfo {
  used: number;
  limit: number | null;
  /** Extra detail, e.g. Reddit title length. */
  note?: string;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function graphemes(text: string): number {
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

export function countFor(doc: DocId, text: string): CountInfo {
  if (doc === "master") return { used: graphemes(text), limit: null };
  if (doc === "x") return { used: twitter.parseTweet(text).weightedLength, limit: PLATFORMS.x.limit };
  if (doc === "reddit") {
    const [first = "", ...rest] = text.split("\n");
    const title = first.replace(/^#\s*/, "");
    return { used: graphemes(rest.join("\n").trim()), limit: PLATFORMS.reddit.limit, note: `제목 ${graphemes(title)}/300` };
  }
  return { used: graphemes(text), limit: PLATFORMS[doc].limit };
}
