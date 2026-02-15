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
      <div className="rounded-xl bg-black p-3 text-white">
        <p className="mb-2 text-xs text-white/70">X Post Preview</p>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 text-sm whitespace-pre-wrap">{body}</p>
      </div>
    );
  }

  if (platform === "instagram") {
    return (
      <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-rose-100 p-3">
        <p className="mb-2 text-xs text-black/60">Instagram Caption Preview</p>
        <div className="mb-2 h-20 rounded-lg bg-white/70" />
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm whitespace-pre-wrap">{body}</p>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="rounded-xl border bg-white p-3">
        <p className="mb-2 text-xs text-black/60">LinkedIn Feed Preview</p>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-2 text-sm whitespace-pre-wrap">{body}</p>
      </div>
    );
  }

  if (platform === "reddit") {
    return (
      <div className="rounded-xl border bg-orange-50 p-3">
        <p className="mb-2 text-xs text-black/60">Reddit Post Preview</p>
        <p className="text-sm font-semibold">r/community | {title}</p>
        <p className="mt-2 text-sm whitespace-pre-wrap">{body}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-3">
      <p className="mb-2 text-xs text-black/60">Blog Preview (Markdown)</p>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm whitespace-pre-wrap">{body}</p>
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
    <article className="relative rounded-3xl border border-black/10 bg-white p-4 shadow-soft">
      {card.isRefining && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/75 backdrop-blur-sm">
          <div className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> 수정 중...
          </div>
        </div>
      )}

      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="font-display text-xl capitalize">{card.platform}</p>
          <p className="text-xs uppercase tracking-wide text-black/50">{card.status} · v{card.versionIndex + 1}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onUndo} disabled={card.versionIndex === 0} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40">
            <RotateCcw className="mr-1 inline h-3 w-3" /> Undo
          </button>
          <button
            onClick={onRedo}
            disabled={card.versionIndex >= card.versions.length - 1}
            className="rounded-lg border px-2 py-1 text-xs disabled:opacity-40"
          >
            <RotateCw className="mr-1 inline h-3 w-3" /> Redo
          </button>
          <button onClick={onAccept} className="rounded-lg border border-emerald-600 px-2 py-1 text-xs text-emerald-700">
            <Check className="mr-1 inline h-3 w-3" /> Accept
          </button>
          <button onClick={onReject} className="rounded-lg border border-rose-600 px-2 py-1 text-xs text-rose-700">
            <X className="mr-1 inline h-3 w-3" /> Reject
          </button>
        </div>
      </header>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {card.versions.map((v, idx) => (
          <button
            key={`${v.createdAt}-${idx}`}
            onClick={() => onSelectVersion(idx)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${idx === card.versionIndex ? "border-black bg-black text-white" : "border-black/20 bg-white"}`}
          >
            v{idx + 1} {v.source === "refine" ? "refine" : "base"}
          </button>
        ))}
      </div>

      <Preview platform={card.platform} title={current.title} body={current.body} />

      <div className="mt-3 rounded-xl bg-black/5 p-3">
        <h3 className="mb-1 font-semibold">실제 텍스트</h3>
        <pre className="whitespace-pre-wrap text-sm">{current.title + "\n\n" + current.body}</pre>
      </div>

      <div className="mt-3 mb-3 flex flex-wrap gap-2">
        {current.suggestions.map((s) => (
          <button key={s} onClick={() => setFeedback(s)} className="rounded-full border border-black/20 bg-white px-2 py-1 text-xs">
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="다시 수정할 프롬프트 입력 (예: 첫 문장을 질문형으로)"
          className="h-20 w-full rounded-xl border border-black/20 bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            disabled={card.isRefining || !feedback.trim()}
            onClick={() => onRefine(feedback)}
            className="rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Pencil className="mr-1 inline h-3 w-3" /> Edit
          </button>
          <button
            disabled={card.isRefining}
            onClick={onVoiceRefine}
            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Mic className="mr-1 inline h-3 w-3" /> Voice Edit
          </button>
        </div>
      </div>
    </article>
  );
}
