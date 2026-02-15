"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Mic, Pencil, RotateCcw, RotateCw, X } from "lucide-react";
import type { CardState, Platform } from "@/lib/types";

type Props = {
  card: CardState;
  onAccept: () => void;
  onReject: () => void;
  onRefine: (feedback: string) => Promise<void>;
  onVoiceRefine: () => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onSelectVersion: (index: number) => void;
};

function Preview({ platform, title, body }: { platform: Platform; title: string; body: string }) {
  if (platform === "twitter") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-black p-3 text-white dark:border-zinc-700">
        <p className="mb-2 text-[11px] text-white/70">X Preview</p>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{body}</p>
      </div>
    );
  }

  if (platform === "instagram") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-fuchsia-50 to-rose-50 p-3 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800">
        <p className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-300">Instagram Preview</p>
        <div className="mb-2 h-20 rounded-lg bg-white/75 dark:bg-zinc-700/50" />
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{body}</p>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-300">LinkedIn Preview</p>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{body}</p>
      </div>
    );
  }

  if (platform === "reddit") {
    return (
      <div className="rounded-xl border border-zinc-200 bg-orange-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
        <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-300">Reddit Preview</p>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{body}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-300">Blog Preview</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{body}</p>
    </div>
  );
}

export function PlatformCard({
  card,
  onAccept,
  onReject,
  onRefine,
  onVoiceRefine,
  onUndo,
  onRedo,
  onSelectVersion,
}: Props) {
  const [feedback, setFeedback] = useState("");
  const current = useMemo(() => card.versions[card.versionIndex], [card.versionIndex, card.versions]);

  return (
    <article className="relative h-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {card.isRefining && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-zinc-900/70">
          <div className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> 반영 중
          </div>
        </div>
      )}

      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold capitalize text-zinc-900 dark:text-zinc-100">{card.platform}</p>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {card.status} · version {card.versionIndex + 1}
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={onUndo} disabled={card.versionIndex === 0} className="rounded-md border px-2 py-1 text-[11px] disabled:opacity-40 dark:text-zinc-100">
            <RotateCcw className="mr-1 inline h-3 w-3" />
          </button>
          <button
            onClick={onRedo}
            disabled={card.versionIndex >= card.versions.length - 1}
            className="rounded-md border px-2 py-1 text-[11px] disabled:opacity-40 dark:text-zinc-100"
          >
            <RotateCw className="mr-1 inline h-3 w-3" />
          </button>
          <button onClick={onAccept} className="rounded-md border border-emerald-500 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-300">
            <Check className="mr-1 inline h-3 w-3" />
          </button>
          <button onClick={onReject} className="rounded-md border border-rose-500 px-2 py-1 text-[11px] text-rose-700 dark:text-rose-300">
            <X className="mr-1 inline h-3 w-3" />
          </button>
        </div>
      </header>

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {card.versions.map((v, idx) => (
          <button
            key={`${v.createdAt}-${idx}`}
            onClick={() => onSelectVersion(idx)}
            className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${
              idx === card.versionIndex
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            }`}
          >
            v{idx + 1}
          </button>
        ))}
      </div>

      <Preview platform={card.platform} title={current.title} body={current.body} />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {current.suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setFeedback(s)}
            className="rounded-full border border-zinc-300 px-2 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="수정 프롬프트 입력"
          className="h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
        />
        <div className="flex gap-2">
          <button
            disabled={card.isRefining || !feedback.trim()}
            onClick={() => onRefine(feedback)}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Pencil className="mr-1 inline h-3 w-3" /> Edit
          </button>
          <button
            disabled={card.isRefining}
            onClick={onVoiceRefine}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
          >
            <Mic className="mr-1 inline h-3 w-3" /> Voice
          </button>
        </div>
      </div>
    </article>
  );
}
