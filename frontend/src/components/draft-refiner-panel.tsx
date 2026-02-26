"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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

type DraftSection = {
  label: string;
  content: string;
};

function parseOrganizedDraftSections(text: string): DraftSection[] {
  const src = (text || "").trim();
  if (!src) return [];
  const lines = src.split("\n");
  const sections: DraftSection[] = [];
  let currentLabel = "Draft";
  let currentContent: string[] = [];

  const pushCurrent = () => {
    const content = currentContent.join("\n").trim();
    if (content) sections.push({ label: currentLabel, content });
  };

  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(/^\[(.+)\]$/);
    if (match) {
      pushCurrent();
      currentLabel = match[1];
      currentContent = [];
      continue;
    }
    currentContent.push(raw);
  }
  pushCurrent();
  return sections;
}

function summarizeRefinement(result: DraftRefineResponse): string {
  const lines = [
    result.brief.title ? `Title: ${result.brief.title}` : "",
    `Core message: ${result.brief.coreMessage}`,
    `Audience: ${result.brief.audienceAssumption}`,
    `Logic points: ${result.brief.keyPoints.join(" / ")}`,
    `Action line: ${result.brief.cta}`,
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
  const [animatedPolishedDraft, setAnimatedPolishedDraft] = useState("");
  const [loadingTypingText, setLoadingTypingText] = useState("");

  const mergedAnswers = useMemo(() => ({ ...answers, ...(chatInput.trim() ? { user_note: chatInput.trim() } : {}) }), [answers, chatInput]);
  const selectedAngle = useMemo(() => result?.angles.find((a) => a.id === selectedAngleId) ?? result?.angles[0] ?? null, [result, selectedAngleId]);
  const organizedSections = useMemo(() => parseOrganizedDraftSections(animatedPolishedDraft || result?.polishedDraft || ""), [animatedPolishedDraft, result?.polishedDraft]);

  useEffect(() => {
    const full = result?.polishedDraft || "";
    if (!full) {
      setAnimatedPolishedDraft("");
      return;
    }
    let i = 0;
    const step = Math.max(1, Math.floor(full.length / 120));
    setAnimatedPolishedDraft("");
    const timer = window.setInterval(() => {
      i = Math.min(full.length, i + step);
      setAnimatedPolishedDraft(full.slice(0, i));
      if (i >= full.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [result?.polishedDraft]);

  useEffect(() => {
    if (!loading) {
      setLoadingTypingText("");
      return;
    }
    const script = "Organizing your draft...\nBuilding core message...\nStructuring key points...\nPolishing final version...";
    let i = 0;
    const timer = window.setInterval(() => {
      i = i >= script.length ? 0 : i + 1;
      setLoadingTypingText(script.slice(0, i));
    }, 24);
    return () => window.clearInterval(timer);
  }, [loading]);

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
    <>
      {open && (
        <aside className="fixed left-4 top-20 z-50 h-[calc(100vh-6rem)] w-[min(560px,94vw)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700/50 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Draft Organizer</h3>
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
                  Paste rough draft notes. I will organize them into a clean logical draft and give only a few focused discussion suggestions.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${
                    m.role === "assistant"
                      ? "border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200"
                      : "ml-auto bg-violet-600 text-white dark:bg-violet-500"
                  }`}
                >
                  {m.text}
                </div>
              ))}

              {loading && (
                <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Refining draft...
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                    {loadingTypingText}
                  </p>
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
                  {result.attentionGuide && (
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-[9px] font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">A</span>
                        Structure focus
                      </p>
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                        Strong opening line: {result.attentionGuide.strongestHook}
                      </p>
                      {!!result.attentionGuide.riskNotes.length && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-zinc-600 dark:text-zinc-300">
                          {result.attentionGuide.riskNotes.map((note, idx) => (
                            <li key={`risk-${idx + 1}`}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {!!result.questions.length && (
                    <div className="rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-[9px] font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">B</span>
                        Missing info (quick answers)
                      </p>
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
                                  className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                    answers[q.id] === choice
                                      ? "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500"
                                      : "border-zinc-300 text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-violet-500/50"
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
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-[9px] font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">C</span>
                      Organized draft
                    </p>
                    <div className="max-h-[42vh] space-y-2 overflow-y-auto rounded-md border border-zinc-300 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-950">
                      {organizedSections.length ? (
                        organizedSections.map((section, idx) => (
                          <section key={`${section.label}-${idx + 1}`} className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
                            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">{section.label}</h4>
                            <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{section.content}</p>
                          </section>
                        ))
                      ) : (
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{animatedPolishedDraft || result.polishedDraft}</p>
                      )}
                    </div>
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
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        <span className="mr-1 inline-flex h-4 w-4 items-center justify-center rounded bg-violet-100 text-[9px] font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">D</span>
                        Discussion ideas (few + focused)
                      </p>
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
                            Insert idea
                          </button>
                          <button
                            type="button"
                            onClick={() => onReplaceDraft(selectedAngle.draftSnippet || selectedAngle.preview)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                          >
                            Replace with idea
                          </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Discuss and refine
              </p>
              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Tell me what to improve (logic flow, tone, missing context, stronger conclusion...)"
                  className="h-20 w-full rounded-md border-2 border-violet-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 dark:border-violet-500/50 dark:bg-zinc-950 dark:text-zinc-100"
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
                  className="min-w-20 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
});
