import type { Platform } from "@/lib/types";

export type PlatformLimitState = "ok" | "near" | "over";

export type PlatformPreviewTransform = {
  normalizedText: string;
  charCount: number;
  lineCount: number;
  limit?: number;
  limitState: PlatformLimitState;
};

const PLATFORM_LIMITS: Partial<Record<Platform, number>> = {
  twitter: 280,
  instagram: 2200,
  linkedin: 3000,
  reddit: 40000,
};

export function transformPreviewText(platform: Platform, rawText: string): PlatformPreviewTransform {
  const normalizedText = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/ {3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const charCount = [...normalizedText].length;
  const lineCount = normalizedText ? normalizedText.split("\n").length : 0;
  const limit = PLATFORM_LIMITS[platform];

  let limitState: PlatformLimitState = "ok";
  if (limit) {
    const ratio = limit > 0 ? charCount / limit : 0;
    if (ratio > 1) limitState = "over";
    else if (ratio >= 0.9) limitState = "near";
  }

  return {
    normalizedText,
    charCount,
    lineCount,
    limit,
    limitState,
  };
}

