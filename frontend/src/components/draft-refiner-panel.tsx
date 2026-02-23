"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { refineDraft } from "@/lib/api";
import type { DraftRefineLanguage, DraftRefineResponse, GenerationConfig, Platform, ProviderOption } from "@/lib/types";

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

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

function summarizeRefinement(result: DraftRefineResponse): string {
  const lines = [
    result.brief.title ? `Title: ${result.brief.title}` : "",
    `Core: ${result.brief.coreMessage}`,
    `Audience: ${result.brief.audienceAssumption}`,
    `Key points: ${result.brief.keyPoints.join(" / ")}`,
    `CTA: ${result.brief.cta}`,
  ].filter(Boolean);
  return lines.join("\n");
}

export const DraftRefinerPanel = forwardRef<DraftRefinerPanelRef, Props>(function DraftRefinerPanel(
  { draft, provider, model, generationConfig, language, platforms, onReplaceDraft, onInsertIntoDraft },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DraftRefineResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [chatInput, setChatInput] = useState("");
  const [selectedAngleId, setSelectedAngleId] = useState("");

  const mergedAnswers = useMemo(() => ({ ...answers, ...(chatInput.trim() ? { user_note: chatInput.trim() } : {}) }), [answers, chatInput]);
  const selectedAngle = useMemo(() => result?.angles.find((a) => a.id === selectedAngleId) ?? result?.angles[0] ?? null, [result, selectedAngleId]);

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
      setSelectedAngleId(data.angles[0]?.id ?? "");
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: summarizeRefinement(data),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openAndRefine: () => {
      if (!open) setMessages([]);
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
        {loading ? "Refining..." : "✨ Draft Idea Booster"}
      </button>

      {open && (
        <aside className="fixed left-4 top-20 z-50 h-[calc(100vh-6rem)] w-[min(460px,92vw)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Draft Idea Lab</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
            >
              Collapse
            </button>
          </div>
          <div className="flex h-[calc(100%-2.5rem)] flex-col">
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {!messages.length && !loading && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                  Paste rough ideas, then refine. I will organize your thinking and produce a clearer draft.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${
                    m.role === "assistant"
                      ? "border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200"
                      : "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  }`}
                >
                  {m.text}
                </div>
              ))}

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

              {result && (
                <>
                  {!!result.questions.length && (
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Missing info</p>
                      <div className="space-y-2">
                        {result.questions.map((q) => (
                          <div key={q.id}>
                            <p className="text-xs text-zinc-700 dark:text-zinc-200">{q.question}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
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
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Polished draft</p>
                    <textarea
                      readOnly
                      value={result.polishedDraft}
                      className="h-40 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
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
                        onClick={() => onInsertIntoDraft(result.polishedDraft)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                      >
                        Insert into Draft
                      </button>
                    </div>
                  </div>

                  {!!result.angles.length && selectedAngle && (
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Try angle</p>
                      <select
                        value={selectedAngle.id}
                        onChange={(e) => setSelectedAngleId(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      >
                        {result.angles.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">{selectedAngle.preview}</p>
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onInsertIntoDraft(selectedAngle.draftSnippet || selectedAngle.preview)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                        >
                          Insert angle
                        </button>
                        <button
                          type="button"
                          onClick={() => onReplaceDraft(selectedAngle.draftSnippet || selectedAngle.preview)}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                        >
                          Replace with angle
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Add more context or answer missing info..."
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const userText = chatInput.trim();
                    if (userText) {
                      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text: userText }]);
                    }
                    void runRefine(true);
                    setChatInput("");
                  }}
                  disabled={loading}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </section>
  );
});
