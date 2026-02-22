"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Expand, Loader2, Mic, Pencil, RotateCcw, RotateCw, X } from "lucide-react";
import { PlatformPreview } from "@/components/platform-preview";
import { transformPreviewText } from "@/lib/preview-transform";
import type { CardState, Platform } from "@/lib/types";

type Props = {
  card: CardState;
  isCollapsing?: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRefine: (feedback: string) => Promise<void>;
  onVoiceRefine: () => Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onSelectVersion: (index: number) => void;
  onPreviewChange: (title: string, body: string) => void;
};

export function PlatformCard({
  card,
  isCollapsing = false,
  onAccept,
  onReject,
  onRefine,
  onVoiceRefine,
  onUndo,
  onRedo,
  onSelectVersion,
  onPreviewChange,
}: Props) {
  const [feedback, setFeedback] = useState("");
  // Keeps Preview (read-only) and Edit (editable) clearly separated.
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [fullViewWidth, setFullViewWidth] = useState<"desktop" | "mobile">("desktop");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const current = useMemo(() => card.versions[card.versionIndex], [card.versionIndex, card.versions]);
  const transformed = useMemo(() => transformPreviewText(card.platform, current.body), [card.platform, current.body]);
  const charCount = transformed.charCount;
  const canExpand = transformed.charCount > 320 || transformed.lineCount > 8;

  const [draftTitle, setDraftTitle] = useState(current.title);
  const [draftBody, setDraftBody] = useState(current.body);
  const editBodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraftTitle(current.title);
    setDraftBody(current.body);
    setViewMode("preview");
    setExpandedPreview(false);
  }, [current.title, current.body]);

  useEffect(() => {
    if (viewMode !== "edit" || !editBodyRef.current) return;
    editBodyRef.current.style.height = "auto";
    editBodyRef.current.style.height = `${editBodyRef.current.scrollHeight}px`;
  }, [draftBody, viewMode]);

  useEffect(() => {
    if (!fullViewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullViewOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullViewOpen]);

  const copyFullContent = async () => {
    try {
      await navigator.clipboard.writeText(`${current.title}\n\n${current.body}`);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1200);
    } catch {
      setCopyLabel("Failed");
      window.setTimeout(() => setCopyLabel("Copy"), 1200);
    }
  };

  return (
    <article
      className={`relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-900 ${
        isCollapsing ? "scale-95 opacity-0" : ""
      }`}
    >
      {card.isRefining && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-zinc-900/70">
          <div className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
            <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Refining
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
        <div className="flex flex-wrap items-center gap-1 justify-end">
          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {charCount} chars
          </span>
          {transformed.limitState === "near" && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Near platform limit
            </span>
          )}
          {transformed.limitState === "over" && (
            <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
              Platform limit exceeded
            </span>
          )}
          {!expandedPreview && canExpand && (
            <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Preview truncated
            </span>
          )}
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

      <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800/60">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("preview")}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                viewMode === "preview"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setViewMode("edit")}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                viewMode === "edit"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              Edit
            </button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => void copyFullContent()}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            >
              <Copy className="mr-1 inline h-3 w-3" />
              {copyLabel}
            </button>
            <button
              onClick={() => setFullViewOpen(true)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            >
              <Expand className="mr-1 inline h-3 w-3" />
              Full view
            </button>
          </div>
        </div>

        {viewMode === "preview" && (
          <>
            <PlatformPreview
              platform={card.platform}
              title={current.title}
              text={transformed.normalizedText}
              expanded={expandedPreview}
              canExpand={canExpand}
            />
            {canExpand && (
              <button
                onClick={() => setExpandedPreview((v) => !v)}
                className="mt-1 rounded-md px-1 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {expandedPreview ? "Collapse" : "Read more"}
              </button>
            )}
          </>
        )}

        {viewMode === "edit" && (
          <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <textarea
              ref={editBodyRef}
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              className="min-h-[40vh] w-full resize-y overflow-hidden rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraftTitle(current.title);
                  setDraftBody(current.body);
                  setViewMode("preview");
                }}
                className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onPreviewChange(draftTitle, draftBody);
                  setViewMode("preview");
                }}
                className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

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
          placeholder="Enter refinement prompt"
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

      {fullViewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className={`w-full rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 ${fullViewWidth === "mobile" ? "max-w-md" : "max-w-3xl"}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">{card.platform} full preview</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{charCount} chars</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setFullViewWidth((v) => (v === "desktop" ? "mobile" : "desktop"))}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                >
                  {fullViewWidth === "desktop" ? "Mobile width" : "Desktop width"}
                </button>
                <button
                  onClick={() => void copyFullContent()}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                >
                  <Copy className="mr-1 inline h-3 w-3" />
                  {copyLabel}
                </button>
                <button
                  onClick={() => setFullViewOpen(false)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] dark:border-zinc-700 dark:text-zinc-200"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[68vh] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="mb-2 break-words whitespace-pre-wrap text-sm font-semibold text-zinc-900 dark:text-zinc-100">{current.title}</p>
              <p className="break-words whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">{transformed.normalizedText}</p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
