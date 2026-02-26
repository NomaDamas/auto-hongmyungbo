"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { refineDraft } from "@/lib/api";
import type { DraftRefineLanguage, GenerationConfig, Platform, ProviderOption } from "@/lib/types";

type Props = {
  draft: string;
  provider: ProviderOption;
  model: string;
  generationConfig: GenerationConfig;
  language: DraftRefineLanguage;
  platforms: Platform[];
  onInsertIntoDraft: (snippet: string) => void;
};

export type AggroPingpongPanelRef = {
  openAndGenerate: () => void;
  collapse: () => void;
};

export const AggroPingpongPanel = forwardRef<AggroPingpongPanelRef, Props>(function AggroPingpongPanel(
  { draft, provider, model, generationConfig, language, platforms, onInsertIntoDraft },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hooks, setHooks] = useState<string[]>([]);
  const [riskNotes, setRiskNotes] = useState<string[]>([]);
  const [strongestHook, setStrongestHook] = useState("");

  const closeAndReset = () => {
    setOpen(false);
    setLoading(false);
    setError(null);
    setHooks([]);
    setRiskNotes([]);
    setStrongestHook("");
  };

  const generate = async () => {
    if (!draft.trim()) {
      setError("Write a draft first!");
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
        mode: "aggro",
        provider,
        model,
        generationConfig,
      });
      const guide = data.attentionGuide;
      setHooks(guide?.hookOptions ?? []);
      setRiskNotes(guide?.riskNotes ?? []);
      setStrongestHook(guide?.strongestHook ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggro generation failed");
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openAndGenerate: () => void generate(),
    collapse: () => closeAndReset(),
  }));

  useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  if (!open) return null;

  return (
    <aside className="fixed left-4 top-20 z-50 h-[calc(100vh-6rem)] w-[min(480px,94vw)] overflow-hidden rounded-2xl border border-orange-300 bg-gradient-to-b from-orange-50 to-red-50 shadow-2xl dark:border-orange-700/50 dark:from-zinc-900 dark:to-zinc-900">
      <div className="flex items-center justify-between border-b border-orange-200 bg-gradient-to-r from-orange-100 to-red-100 px-3 py-2 dark:border-orange-800/40 dark:from-orange-900/30 dark:to-red-900/30">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
          <Zap className="h-3.5 w-3.5" /> Aggro Pingpong
        </h3>
        <button
          type="button"
          onClick={closeAndReset}
          className="rounded-md border border-orange-300 px-2 py-1 text-[11px] text-orange-700 dark:border-orange-700 dark:text-orange-300"
        >
          Close
        </button>
      </div>

      <div className="flex h-[calc(100%-2.5rem)] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          {loading && (
            <div className="rounded-lg border border-orange-200 bg-white p-4 text-center text-xs text-orange-700 dark:border-orange-800 dark:bg-zinc-900 dark:text-orange-300">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Generating provocative hooks...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void generate()}
                className="mt-2 rounded-md border border-red-400 px-2 py-1 text-[11px] dark:border-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && hooks.length === 0 && (
            <div className="rounded-lg border border-orange-200 bg-white/80 p-3 text-xs text-orange-600 dark:border-orange-800 dark:bg-zinc-900/80 dark:text-orange-400">
              Click the button below to generate provocative, scroll-stopping hooks for your draft.
            </div>
          )}

          {strongestHook && (
            <div className="rounded-lg border border-orange-300 bg-gradient-to-r from-orange-100 to-red-100 p-3 dark:border-orange-700/50 dark:from-orange-900/20 dark:to-red-900/20">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-400">
                Strongest Hook
              </p>
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200">{strongestHook}</p>
              <button
                type="button"
                onClick={() => onInsertIntoDraft(strongestHook)}
                className="mt-2 rounded-md bg-orange-500 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500"
              >
                Insert into Draft
              </button>
            </div>
          )}

          {hooks.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-400">
                Provocative Hooks (click to insert)
              </p>
              {hooks.map((hook, idx) => (
                <button
                  key={`hook-${idx}`}
                  type="button"
                  onClick={() => onInsertIntoDraft(hook)}
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-left text-xs text-zinc-800 transition-all hover:border-orange-400 hover:bg-orange-50 hover:shadow-sm dark:border-orange-800/40 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-orange-600 dark:hover:bg-zinc-700"
                >
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                  {hook}
                </button>
              ))}
            </div>
          )}

          {riskNotes.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/80 p-2.5 dark:border-red-800/40 dark:bg-red-950/20">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-red-500 dark:text-red-400">
                Risk Notes
              </p>
              <ul className="space-y-0.5 text-[11px] text-red-700 dark:text-red-300">
                {riskNotes.map((note, idx) => (
                  <li key={`risk-${idx}`}>• {note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="border-t border-orange-200 p-3 dark:border-orange-800/40">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-orange-600 hover:to-red-600 disabled:opacity-50 dark:from-orange-600 dark:to-red-600 dark:hover:from-orange-500 dark:hover:to-red-500"
          >
            <Zap className="mr-1 inline h-4 w-4" />
            {loading ? "Generating..." : hooks.length > 0 ? "Re-generate Hooks" : "Generate Aggro Hooks"}
          </button>
        </div>
      </div>
    </aside>
  );
});
