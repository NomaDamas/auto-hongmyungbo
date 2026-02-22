"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LanguageOption,
  LanguageSettingOption,
  ModelOption,
  PerPlatformLanguageMap,
  Platform,
  ProviderOption,
} from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["instagram", "twitter", "linkedin", "reddit", "blog"];

type Props = {
  open: boolean;
  contexts: Record<Platform, string>;
  referencePosts: Record<Platform, string[]>;
  enabledPlatforms: Record<Platform, boolean>;
  autoPublish: boolean;
  language: LanguageSettingOption;
  perPlatformLanguages: PerPlatformLanguageMap;
  provider: ProviderOption;
  availableProviders: ProviderOption[];
  selectedModel: ModelOption;
  modelOptionsByProvider: Record<ProviderOption, ModelOption[]>;
  onClose: () => void;
  onSave: (payload: {
    contexts: Record<Platform, string>;
    referencePosts: Record<Platform, string[]>;
    enabledPlatforms: Record<Platform, boolean>;
    autoPublish: boolean;
    language: LanguageSettingOption;
    perPlatformLanguages: PerPlatformLanguageMap;
    provider: ProviderOption;
    selectedModel: ModelOption;
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
  provider,
  availableProviders,
  selectedModel,
  modelOptionsByProvider,
  onClose,
  onSave,
}: Props) {
  const [tab, setTab] = useState<Platform>("instagram");
  const [draftContexts, setDraftContexts] = useState<Record<Platform, string>>(contexts);
  const [draftReferencePosts, setDraftReferencePosts] = useState<Record<Platform, string[]>>(referencePosts);
  const [draftEnabled, setDraftEnabled] = useState<Record<Platform, boolean>>(enabledPlatforms);
  const [draftAutoPublish, setDraftAutoPublish] = useState(autoPublish);
  const [draftLanguage, setDraftLanguage] = useState<LanguageSettingOption>(language);
  const [draftPerPlatformLanguages, setDraftPerPlatformLanguages] = useState<PerPlatformLanguageMap>(perPlatformLanguages);
  const [draftProvider, setDraftProvider] = useState<ProviderOption>(provider);
  const [draftModel, setDraftModel] = useState<ModelOption>(selectedModel);

  useEffect(() => {
    if (!open) return;
    setDraftContexts(contexts);
    setDraftReferencePosts(referencePosts);
    setDraftEnabled(enabledPlatforms);
    setDraftAutoPublish(autoPublish);
    setDraftLanguage(language);
    setDraftPerPlatformLanguages(perPlatformLanguages);
    setDraftProvider(provider);
    setDraftModel(selectedModel);
  }, [autoPublish, contexts, enabledPlatforms, language, open, perPlatformLanguages, provider, referencePosts, selectedModel]);

  const currentValue = useMemo(() => draftContexts[tab] ?? "", [draftContexts, tab]);
  const currentReferencePosts = useMemo(() => (draftReferencePosts[tab] ?? []).join("\n---\n"), [draftReferencePosts, tab]);
  const providerModels = useMemo(() => modelOptionsByProvider[draftProvider] ?? [], [draftProvider, modelOptionsByProvider]);

  if (!open) return null;

  const handleSave = () => {
    onSave({
      contexts: draftContexts,
      referencePosts: draftReferencePosts,
      enabledPlatforms: draftEnabled,
      autoPublish: draftAutoPublish,
      language: draftLanguage,
      perPlatformLanguages: draftPerPlatformLanguages,
      provider: draftProvider,
      selectedModel: draftModel,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <aside className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Options</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Provider, model, platform style, and language settings.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            닫기
          </button>
        </header>

        <div className="mb-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Model Provider</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={draftProvider}
              onChange={(e) => {
                const nextProvider = e.target.value as ProviderOption;
                const nextModels = modelOptionsByProvider[nextProvider] ?? [];
                setDraftProvider(nextProvider);
                if (!nextModels.includes(draftModel)) {
                  setDraftModel(nextModels[0] ?? draftModel);
                }
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {availableProviders.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {providerModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">게시 대상 플랫폼</p>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_ORDER.map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs capitalize dark:border-zinc-700">
                <input
                  type="checkbox"
                  checked={draftEnabled[p]}
                  onChange={(e) => setDraftEnabled((prev) => ({ ...prev, [p]: e.target.checked }))}
                />
                <span className="text-zinc-700 dark:text-zinc-200">{p}</span>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
            <input type="checkbox" checked={draftAutoPublish} onChange={(e) => setDraftAutoPublish(e.target.checked)} />
            생성 후 자동 게시
          </label>
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">출력 언어</label>
            <select
              value={draftLanguage}
              onChange={(e) => setDraftLanguage(e.target.value as LanguageOption)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              <option value="auto">Auto (입력과 동일)</option>
              <option value="korean">Korean</option>
              <option value="english">English</option>
              <option value="japanese">Japanese</option>
              <option value="per_platform">Per SNS platform</option>
            </select>
          </div>
          {draftLanguage === "per_platform" && (
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {tab} language
              </label>
              <select
                value={draftPerPlatformLanguages[tab]}
                onChange={(e) =>
                  setDraftPerPlatformLanguages((prev) => ({ ...prev, [tab]: e.target.value as LanguageOption }))
                }
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="auto">Auto</option>
                <option value="korean">Korean</option>
                <option value="english">English</option>
                <option value="japanese">Japanese</option>
              </select>
            </div>
          )}
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {PLATFORM_ORDER.map((p) => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs capitalize ${
                p === tab
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{tab} Context</label>
        <textarea
          value={currentValue}
          onChange={(e) => setDraftContexts((prev) => ({ ...prev, [tab]: e.target.value }))}
          placeholder="Optional: additional style constraints for this platform"
          className="mb-3 h-28 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
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
          className="h-[28vh] w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setDraftContexts(contexts);
              setDraftReferencePosts(referencePosts);
              setDraftEnabled(enabledPlatforms);
              setDraftAutoPublish(autoPublish);
              setDraftLanguage(language);
              setDraftPerPlatformLanguages(perPlatformLanguages);
              setDraftProvider(provider);
              setDraftModel(selectedModel);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            초기화
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            저장
          </button>
        </div>
      </aside>
    </div>
  );
}
