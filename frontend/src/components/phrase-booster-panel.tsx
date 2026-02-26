"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { boostPhrase } from "@/lib/api";
import type { DraftRefineLanguage, GenerationConfig, ProviderOption } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  draft: string;
  selectedText: string;
  provider: ProviderOption;
  model: string;
  generationConfig: GenerationConfig;
  language: DraftRefineLanguage;
  onInsertIntoDraft: (snippet: string) => void;
  onReplaceTextInDraft: (from: string, to: string) => void;
};

export type PhraseBoosterPanelRef = {
  openPanel: () => void;
  collapse: () => void;
};

export const PhraseBoosterPanel = forwardRef<PhraseBoosterPanelRef, Props>(function PhraseBoosterPanel(
  { draft, selectedText, provider, model, generationConfig, language, onInsertIntoDraft, onReplaceTextInDraft },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [instruction, setInstruction] = useState("");
  const [targetText, setTargetText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [rewritten, setRewritten] = useState("");

  useEffect(() => {
    if (!open) return;
    if (selectedText?.trim()) setTargetText(selectedText.trim());
  }, [open, selectedText]);

  useImperativeHandle(ref, () => ({
    openPanel: () => {
      setOpen(true);
      if (selectedText?.trim()) setTargetText(selectedText.trim());
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

  const ask = async () => {
    if (!draft.trim()) {
      setError("Write a draft first.");
      return;
    }
    if (!targetText.trim()) {
      setError("Select or enter a target phrase first.");
      return;
    }
    if (!instruction.trim()) {
      setError("Describe how you want to improve the phrase.");
      return;
    }
    const userText = instruction.trim();
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: userText }]);
    setInstruction("");
    setLoading(true);
    setError(null);
    try {
      const response = await boostPhrase({
        draft,
        targetText,
        instruction: userText,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
        language,
        provider,
        model,
        generationConfig,
      });
      setSuggestions(response.suggestions || []);
      setRewritten(response.rewritten || "");
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: response.assistant }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phrase boost failed");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <aside className="fixed left-4 top-20 z-50 h-[calc(100vh-6rem)] w-[min(560px,94vw)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700/50 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/30">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
          <Sparkles className="h-3.5 w-3.5" /> Phrase Booster
        </h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
        >
          Close
        </button>
      </div>

      <div className="flex h-[calc(100%-2.5rem)] flex-col">
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
          <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Target phrase
            <textarea
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="Select text in Draft, or paste phrase here"
            />
          </label>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {!messages.length && !loading && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
              Ask for stronger SNS phrasing, hooks, clarity, or tone upgrades. Keep intent same, only improve expression.
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
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Generating better phrasing...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          )}

          {!!suggestions.length && (
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Suggestions</p>
              {suggestions.map((s, idx) => (
                <div key={`phrase-${idx}`} className="rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
                  <p className="text-xs text-zinc-700 dark:text-zinc-200">{s}</p>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onReplaceTextInDraft(targetText, s)}
                      className="rounded-md bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
                    >
                      Replace target
                    </button>
                    <button
                      type="button"
                      onClick={() => onInsertIntoDraft(s)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                    >
                      Insert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rewritten && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-950/40">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Rewrite</p>
              <p className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-200">{rewritten}</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => onReplaceTextInDraft(targetText, rewritten)}
                  className="rounded-md bg-violet-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
                >
                  Replace target
                </button>
                <button
                  type="button"
                  onClick={() => onInsertIntoDraft(rewritten)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                >
                  Insert
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex gap-2">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. Make it punchier for X but keep the same meaning"
              className="h-20 flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400/50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-violet-500/40"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void ask()}
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-600"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
});

