"use client";

import { useState } from "react";
import { Check, Mic, Pencil, X } from "lucide-react";
import type { GeneratedCard } from "@/lib/types";

type Props = {
  card: GeneratedCard;
  onAccept: () => void;
  onReject: () => void;
  onRefine: (feedback: string) => Promise<void>;
  onVoiceRefine: () => Promise<void>;
  busy: boolean;
};

export function PlatformCard({ card, onAccept, onReject, onRefine, onVoiceRefine, busy }: Props) {
  const [feedback, setFeedback] = useState("");

  return (
    <article className="rounded-2xl border border-black/10 bg-panel p-4 shadow-soft">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-display text-lg capitalize">{card.platform}</p>
          <p className="text-xs uppercase tracking-wide text-black/60">{card.status}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onAccept} className="rounded-lg border border-emerald-600 px-2 py-1 text-xs text-emerald-700">
            <Check className="mr-1 inline h-3 w-3" /> Accept
          </button>
          <button onClick={onReject} className="rounded-lg border border-rose-600 px-2 py-1 text-xs text-rose-700">
            <X className="mr-1 inline h-3 w-3" /> Reject
          </button>
        </div>
      </header>

      <h3 className="mb-2 font-semibold">{card.title}</h3>
      <pre className="mb-3 whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-sm">{card.body}</pre>

      <div className="mb-3 flex flex-wrap gap-2">
        {card.suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setFeedback(s)}
            className="rounded-full border border-accent/40 bg-accent/10 px-2 py-1 text-xs"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="수정 요청 입력 (예: 더 유머러스하게)"
          className="h-20 w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            disabled={busy || !feedback.trim()}
            onClick={() => onRefine(feedback)}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Pencil className="mr-1 inline h-3 w-3" /> Edit
          </button>
          <button
            disabled={busy}
            onClick={onVoiceRefine}
            className="rounded-lg bg-accent2 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Mic className="mr-1 inline h-3 w-3" /> Voice Edit
          </button>
        </div>
      </div>
    </article>
  );
}
