"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { refineDraft } from "@/lib/api";
import type { DraftRefineBrief, DraftRefineLanguage, DraftRefineResponse, GenerationConfig, Platform, ProviderOption } from "@/lib/types";

type Props = {
  draft: string;
  provider: ProviderOption;
  model: string;
  generationConfig: GenerationConfig;
  language: DraftRefineLanguage;
  platforms: Platform[];
  onReplaceDraft: (next: string) => void;
  onInsertIntoDraft: (snippet: string) => void;
};

export type DraftRefinerPanelRef = {
  openAndRefine: () => void;
  collapse: () => void;
};

function buildBriefSections(brief: DraftRefineBrief): string {
  const lines = [
    brief.title ? `Title: ${brief.title}` : "",
    `Core message: ${brief.coreMessage}`,
    `Audience: ${brief.audienceAssumption}`,
    `Key points:\n${brief.keyPoints.map((p) => `- ${p}`).join("\n")}`,
    `CTA: ${brief.cta}`,
    brief.hashtags?.length ? `Keywords/hashtags: ${brief.hashtags.join(", ")}` : "",
  ].filter(Boolean);
  return lines.join("\n\n");
}

export const DraftRefinerPanel = forwardRef<DraftRefinerPanelRef, Props>(function DraftRefinerPanel(
  { draft, provider, model, generationConfig, language, platforms, onReplaceDraft, onInsertIntoDraft },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftRefineResponse | null>(null);
  const [briefEdit, setBriefEdit] = useState<DraftRefineBrief | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState<Record<string, string>>({});

  const mergedAnswers = useMemo(() => {
    const next: Record<string, string> = { ...answers };
    for (const [k, v] of Object.entries(freeText)) {
      if (v.trim()) next[k] = v.trim();
    }
    return next;
  }, [answers, freeText]);

  const runRefine = async (withAnswers = false) => {
    if (!draft.trim()) {
      setError("Write a draft first.");
      setOpen(true);
      return;
    }
    try {
      setOpen(true);
      setLoading(true);
      setError(null);
      const data = await refineDraft({
        rawDraft: draft,
        language,
        platforms,
        context: withAnswers ? { answers: mergedAnswers } : undefined,
        provider,
        model,
        generationConfig,
      });
      setResult(data);
      setBriefEdit(data.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openAndRefine: () => {
      void runRefine(false);
    },
    collapse: () => setOpen(false),
  }));

  useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <section className="mt-3">
      <button
        type="button"
        onClick={() => void runRefine(false)}
        disabled={loading}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <Sparkles className="mr-1 inline h-3.5 w-3.5" />
        {loading ? "Refining..." : "✨ Refine Draft"}
      </button>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/40 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Draft Refinement</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
            >
              Collapse
            </button>
          </div>

          {loading && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Refining draft...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void runRefine(Boolean(Object.keys(mergedAnswers).length))}
                className="mt-2 rounded-md border border-rose-400 px-2 py-1 text-[11px] dark:border-rose-700"
              >
                Retry
              </button>
            </div>
          )}

          {result && briefEdit && !loading && (
            <>
              <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">A) Structured Brief</p>
                <div className="space-y-2">
                  <input
                    value={briefEdit.title ?? ""}
                    onChange={(e) => setBriefEdit({ ...briefEdit, title: e.target.value || undefined })}
                    placeholder="Title (optional)"
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <textarea
                    value={briefEdit.coreMessage}
                    onChange={(e) => setBriefEdit({ ...briefEdit, coreMessage: e.target.value })}
                    placeholder="One-liner / Core message"
                    className="h-16 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    value={briefEdit.audienceAssumption}
                    onChange={(e) => setBriefEdit({ ...briefEdit, audienceAssumption: e.target.value })}
                    placeholder="Audience assumption"
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <div className="space-y-1">
                    {briefEdit.keyPoints.map((point, idx) => (
                      <input
                        key={`kp-${idx + 1}`}
                        value={point}
                        onChange={(e) => {
                          const next = [...briefEdit.keyPoints];
                          next[idx] = e.target.value;
                          setBriefEdit({ ...briefEdit, keyPoints: next });
                        }}
                        placeholder={`Key point ${idx + 1}`}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    ))}
                  </div>
                  <input
                    value={briefEdit.cta}
                    onChange={(e) => setBriefEdit({ ...briefEdit, cta: e.target.value })}
                    placeholder="CTA"
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <input
                    value={(briefEdit.hashtags ?? []).join(", ")}
                    onChange={(e) =>
                      setBriefEdit({
                        ...briefEdit,
                        hashtags: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Keywords/hashtags (optional)"
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">B) Missing Info</p>
                <div className="space-y-3">
                  {result.questions.map((q) => (
                    <div key={q.id} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                      <p className="mb-1 text-xs font-medium text-zinc-800 dark:text-zinc-100">{q.question}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(q.choices ?? []).map((choice) => (
                          <button
                            key={`${q.id}-${choice}`}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: choice }))}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              answers[q.id] === choice
                                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                            }`}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                      <input
                        value={freeText[q.id] ?? ""}
                        onChange={(e) => setFreeText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Or type your own answer"
                        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void runRefine(true)}
                  disabled={loading}
                  className="mt-2 rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                >
                  Apply answers
                </button>
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">C) Angles / Variants</p>
                <div className="space-y-2">
                  {result.angles.map((angle) => (
                    <article key={angle.id} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{angle.label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">{angle.preview}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onInsertIntoDraft(angle.draftSnippet || angle.preview)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                        >
                          Insert into Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => onReplaceDraft(angle.draftSnippet || angle.preview)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                        >
                          Replace Draft
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">D) Polished Draft</p>
                <textarea
                  readOnly
                  value={result.polishedDraft}
                  className="h-28 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onReplaceDraft(result.polishedDraft)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Replace Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => onInsertIntoDraft(buildBriefSections(briefEdit))}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Insert sections
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </section>
  );
});
