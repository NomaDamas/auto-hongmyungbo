"use client";

import type { ReactNode } from "react";
import type { Platform } from "@/lib/types";

type Props = {
  platform: Platform;
  title: string;
  text: string;
  expanded: boolean;
  canExpand: boolean;
};

const PREVIEW_LINE_CLAMP: Record<Platform, number> = {
  twitter: 5,
  instagram: 6,
  linkedin: 7,
  reddit: 9,
  blog: 10,
};

function tokenizeLine(line: string): ReactNode[] {
  const parts = line.split(/(https?:\/\/[^\s]+|#[A-Za-z0-9_]+|@[A-Za-z0-9_.]+)/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={`${part}-${idx}`} href={part} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
          {part}
        </a>
      );
    }
    if (/^#/.test(part)) return <span key={`${part}-${idx}`} className="font-medium text-blue-700 dark:text-blue-300">{part}</span>;
    if (/^@/.test(part)) return <span key={`${part}-${idx}`} className="font-medium text-sky-700 dark:text-sky-300">{part}</span>;
    return <span key={`${part}-${idx}`}>{part}</span>;
  });
}

function renderRichText(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, idx) => (
    <span key={`line-${idx}`}>
      {tokenizeLine(line)}
      {idx < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function skinClasses(platform: Platform) {
  if (platform === "linkedin") {
    return {
      shell: "rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900",
      footer: "text-zinc-500 dark:text-zinc-400",
      avatar: "bg-blue-200 dark:bg-blue-800",
      label: "LinkedIn",
    };
  }
  if (platform === "reddit") {
    return {
      shell: "rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-zinc-800",
      footer: "text-zinc-500 dark:text-zinc-400",
      avatar: "bg-orange-200 dark:bg-orange-800",
      label: "Reddit",
    };
  }
  if (platform === "twitter") {
    return {
      shell: "rounded-xl border border-zinc-200 bg-black p-3 text-white dark:border-zinc-700",
      footer: "text-zinc-300",
      avatar: "bg-zinc-600 dark:bg-zinc-500",
      label: "X",
    };
  }
  if (platform === "instagram") {
    return {
      shell: "rounded-xl border border-zinc-200 bg-gradient-to-b from-fuchsia-50 to-rose-50 p-3 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800",
      footer: "text-zinc-500 dark:text-zinc-400",
      avatar: "bg-gradient-to-br from-fuchsia-300 to-rose-300 dark:from-fuchsia-700 dark:to-rose-700",
      label: "Instagram",
    };
  }
  return {
    shell: "rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800",
    footer: "text-zinc-500 dark:text-zinc-400",
    avatar: "bg-emerald-200 dark:bg-emerald-800",
    label: "Blog",
  };
}

export function PlatformPreview({ platform, title, text, expanded, canExpand }: Props) {
  const skin = skinClasses(platform);
  const clamp = PREVIEW_LINE_CLAMP[platform];

  return (
    <div className={skin.shell}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-7 w-7 rounded-full ${skin.avatar}`} />
          <div>
            <p className="text-xs font-semibold">{skin.label} User</p>
            <p className={`text-[10px] ${skin.footer}`}>just now</p>
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-wide ${skin.footer}`}>{skin.label}</span>
      </div>

      <p className="mb-2 break-words whitespace-normal text-sm font-semibold">{title}</p>
      <div className={`relative ${expanded ? "max-h-[70vh] overflow-y-auto pr-1" : "overflow-hidden"}`}>
        <p
          className={`break-words whitespace-pre-wrap text-sm leading-6 ${
            expanded ? "" : `[display:-webkit-box] [-webkit-line-clamp:${clamp}] [-webkit-box-orient:vertical] overflow-hidden`
          }`}
        >
          {renderRichText(text)}
        </p>
        {!expanded && canExpand && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-zinc-900" />
        )}
      </div>

      <div className={`mt-3 flex items-center gap-4 border-t border-zinc-200 pt-2 text-[11px] ${skin.footer} dark:border-zinc-700`}>
        <span className="cursor-default transition-colors hover:text-violet-500">Like</span>
        <span className="cursor-default transition-colors hover:text-violet-500">Comment</span>
        <span className="cursor-default transition-colors hover:text-violet-500">Share</span>
      </div>
    </div>
  );
}

