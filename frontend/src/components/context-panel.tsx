"use client";

import { useEffect, useMemo, useState } from "react";
import type { LanguageOption, LanguageSettingOption, PerPlatformLanguageMap, Platform, StyleHistoryEntry, StyleHistoryMap } from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["instagram", "threads", "twitter", "youtube", "tiktok", "linkedin", "reddit"];
const STYLE_HISTORY_KEY = "hmb_style_history_v1";
const MAX_STYLE_HISTORY_PER_PLATFORM = 10;

function platformLabel(platform: Platform): string {
  if (platform === "twitter") return "X";
  if (platform === "threads") return "Threads";
  if (platform === "youtube") return "YouTube";
  if (platform === "tiktok") return "TikTok";
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "instagram") return "Instagram";
  if (platform === "reddit") return "Reddit";
  return platform;
}

type Props = {
  open: boolean;
  contexts: Record<Platform, string>;
  referencePosts: Record<Platform, string[]>;
  enabledPlatforms: Record<Platform, boolean>;
  autoPublish: boolean;
  language: LanguageSettingOption;
  perPlatformLanguages: PerPlatformLanguageMap;
  onClose: () => void;
  onSave: (payload: {
    contexts: Record<Platform, string>;
    referencePosts: Record<Platform, string[]>;
    enabledPlatforms: Record<Platform, boolean>;
    autoPublish: boolean;
    language: LanguageSettingOption;
    perPlatformLanguages: PerPlatformLanguageMap;
  }) => void;
};

export function ContextPanel({
  open,
  contexts,
  referencePosts,
  enabledPlatforms,
  autoPublish,
  language,
  perPlatformLanguages,
  onClose,
  onSave,
}: Props) {
  const [tab, setTab] = useState<Platform>("threads");
  const [draftContexts, setDraftContexts] = useState<Record<Platform, string>>(contexts);
  const [draftReferencePosts, setDraftReferencePosts] = useState<Record<Platform, string[]>>(referencePosts);
  const [draftEnabled, setDraftEnabled] = useState<Record<Platform, boolean>>(enabledPlatforms);
  const [draftAutoPublish, setDraftAutoPublish] = useState(autoPublish);
  const [draftLanguage, setDraftLanguage] = useState<LanguageSettingOption>(language);
  const [draftPerPlatformLanguages, setDraftPerPlatformLanguages] = useState<PerPlatformLanguageMap>(perPlatformLanguages);
  const [styleHistory, setStyleHistory] = useState<StyleHistoryMap>({});
  const [styleHistoryLabel, setStyleHistoryLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraftContexts(contexts);
    setDraftReferencePosts(referencePosts);
    setDraftEnabled(enabledPlatforms);
    setDraftAutoPublish(autoPublish);
    setDraftLanguage(language);
    setDraftPerPlatformLanguages(perPlatformLanguages);
    try {
      const raw = window.localStorage.getItem(STYLE_HISTORY_KEY);
      const loaded = raw ? (JSON.parse(raw) as StyleHistoryMap) : {};
      setStyleHistory(loaded && typeof loaded === "object" ? loaded : {});
    } catch {
      setStyleHistory({});
    }
  }, [autoPublish, contexts, enabledPlatforms, language, open, perPlatformLanguages, referencePosts]);

  const currentValue = useMemo(() => draftContexts[tab] ?? "", [draftContexts, tab]);
  const currentReferencePosts = useMemo(() => (draftReferencePosts[tab] ?? []).join("\n---\n"), [draftReferencePosts, tab]);
  const currentTabHistory = useMemo(() => styleHistory[tab] ?? [], [styleHistory, tab]);
  const languageMode = draftLanguage === "per_platform" ? "per_platform" : "unified";

  if (!open) return null;

  const persistStyleHistory = (next: StyleHistoryMap) => {
    setStyleHistory(next);
    window.localStorage.setItem(STYLE_HISTORY_KEY, JSON.stringify(next));
  };

  const saveStyleHistory = () => {
    const label = styleHistoryLabel.trim();
    const text = currentReferencePosts.trim();
    if (!label || !text) return;
    const entry: StyleHistoryEntry = {
      id: crypto.randomUUID(),
      label,
      text,
      createdAt: new Date().toISOString(),
    };
    const existing = styleHistory[tab] ?? [];
    const next = [entry, ...existing].slice(0, MAX_STYLE_HISTORY_PER_PLATFORM);
    persistStyleHistory({ ...styleHistory, [tab]: next });
    setStyleHistoryLabel("");
  };

  const applyStyleHistory = (entry: StyleHistoryEntry) => {
    setDraftReferencePosts((prev) => ({
      ...prev,
      [tab]: entry.text
        .split(/\n\s*---+\s*\n/g)
        .map((part) => part.trim())
        .filter(Boolean),
    }));
  };

  const deleteStyleHistory = (entryId: string) => {
    const existing = styleHistory[tab] ?? [];
    const next = existing.filter((e) => e.id !== entryId);
    persistStyleHistory({ ...styleHistory, [tab]: next });
  };

  const handleSave = () => {
    onSave({
      contexts: draftContexts,
      referencePosts: draftReferencePosts,
      enabledPlatforms: draftEnabled,
      autoPublish: draftAutoPublish,
      language: draftLanguage,
      perPlatformLanguages: draftPerPlatformLanguages,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <aside className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 shadow-xl dark:border-zinc-700/50 dark:bg-zinc-900">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Platform Writing Style</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Per-platform style and language settings.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            Close
          </button>
        </header>

        <div className="mb-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Target Platforms</p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_ORDER.map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs capitalize dark:border-zinc-700">
                <input
                  type="checkbox"
                  checked={draftEnabled[p]}
                  onChange={(e) => setDraftEnabled((prev) => ({ ...prev, [p]: e.target.checked }))}
                />
                <span className="text-zinc-700 dark:text-zinc-200">{platformLabel(p)}</span>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={draftAutoPublish} onChange={(e) => setDraftAutoPublish(e.target.checked)} />
            Auto-publish after generation
          </label>
          <div className="mt-3">
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Output Language</label>
            <div className="mb-2 inline-flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700">
              <button
                onClick={() => setDraftLanguage("auto")}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  languageMode === "unified"
                    ? "bg-violet-600 text-white dark:bg-violet-500"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Unified
              </button>
              <button
                onClick={() => setDraftLanguage("per_platform")}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  languageMode === "per_platform"
                    ? "bg-violet-600 text-white dark:bg-violet-500"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                Per Platform
              </button>
            </div>
          </div>
          {languageMode === "unified" ? (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Unified Language</label>
              <select
                value={draftLanguage === "per_platform" ? "auto" : draftLanguage}
                onChange={(e) => setDraftLanguage(e.target.value as LanguageOption)}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="auto">Auto (same as input)</option>
                <option value="korean">Korean</option>
                <option value="english">English</option>
                <option value="japanese">Japanese</option>
              </select>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PLATFORM_ORDER.map((platform) => (
                <label key={platform} className="rounded-md border border-zinc-200 p-2 text-xs dark:border-zinc-700">
                  <span className="mb-1 block text-zinc-700 dark:text-zinc-200">{platformLabel(platform)}</span>
                  <select
                    value={draftPerPlatformLanguages[platform]}
                    onChange={(e) =>
                      setDraftPerPlatformLanguages((prev) => ({ ...prev, [platform]: e.target.value as LanguageOption }))
                    }
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value="auto">Auto</option>
                    <option value="korean">Korean</option>
                    <option value="english">English</option>
                    <option value="japanese">Japanese</option>
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {PLATFORM_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                p === tab
                  ? "bg-violet-600 text-white dark:bg-violet-500"
                  : "border border-zinc-300 text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-violet-500/50"
              }`}
            >
              {platformLabel(p)}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{tab} Context</label>
        <textarea
          value={currentValue}
          onChange={(e) => setDraftContexts((prev) => ({ ...prev, [tab]: e.target.value }))}
          placeholder="Optional: additional style constraints for this platform"
          className="mb-3 h-28 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-400/50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-violet-500/40"
        />

        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {tab} Reference Posts (auto style transfer)
        </label>
        <textarea
          value={currentReferencePosts}
          onChange={(e) =>
            setDraftReferencePosts((prev) => ({
              ...prev,
              [tab]: e.target.value
                .split(/\n\s*---+\s*\n/g)
                .map((part) => part.trim())
                .filter(Boolean),
            }))
          }
          placeholder={"Paste multiple posts and separate each with:\n---"}
          className="h-[28vh] w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-400/50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-violet-500/40"
        />

        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
            Style History — {tab}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={styleHistoryLabel}
              onChange={(e) => setStyleHistoryLabel(e.target.value)}
              placeholder="Style name"
              className="min-w-[160px] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={saveStyleHistory}
              disabled={!styleHistoryLabel.trim() || !currentReferencePosts.trim()}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
            >
              Save Current
            </button>
          </div>
          {currentTabHistory.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {currentTabHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-2 rounded-lg border border-zinc-100 p-2 dark:border-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{entry.label}</p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {entry.text.slice(0, 60)}{entry.text.length > 60 ? "..." : ""}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyStyleHistory(entry)}
                    className="shrink-0 rounded-md border border-violet-300 px-2 py-0.5 text-[11px] text-violet-600 dark:border-violet-700 dark:text-violet-300"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteStyleHistory(entry.id)}
                    className="shrink-0 rounded-md border border-rose-300 px-2 py-0.5 text-[11px] text-rose-600 dark:border-rose-700 dark:text-rose-300"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setDraftContexts(contexts);
              setDraftReferencePosts(referencePosts);
              setDraftEnabled(enabledPlatforms);
              setDraftAutoPublish(autoPublish);
              setDraftLanguage(language);
              setDraftPerPlatformLanguages(perPlatformLanguages);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
          >
            Save
          </button>
        </div>
      </aside>
    </div>
  );
}
