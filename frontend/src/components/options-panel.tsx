"use client";

import { useEffect, useState } from "react";
import type { GenerationConfig, ModelOption, ProviderOption, ReasoningEffortOption } from "@/lib/types";

type Props = {
  open: boolean;
  provider: ProviderOption;
  selectedModel: ModelOption;
  generationConfig: GenerationConfig;
  openaiApiKey: string;
  openrouterApiKey: string;
  availableProviders: ProviderOption[];
  modelOptionsByProvider: Record<ProviderOption, ModelOption[]>;
  onClose: () => void;
  onSave: (payload: {
    provider: ProviderOption;
    model: ModelOption;
    generationConfig: GenerationConfig;
    openaiApiKey: string;
    openrouterApiKey: string;
    rememberApiKeys: boolean;
  }) => void;
};

export function OptionsPanel({
  open,
  provider,
  selectedModel,
  generationConfig,
  openaiApiKey,
  openrouterApiKey,
  availableProviders,
  modelOptionsByProvider,
  onClose,
  onSave,
}: Props) {
  const [draftProvider, setDraftProvider] = useState<ProviderOption>(provider);
  const [draftModel, setDraftModel] = useState<ModelOption>(selectedModel);
  const [customModel, setCustomModel] = useState("");
  const [draftOpenaiApiKey, setDraftOpenaiApiKey] = useState(openaiApiKey);
  const [draftOpenrouterApiKey, setDraftOpenrouterApiKey] = useState(openrouterApiKey);
  const [thinkingMode, setThinkingMode] = useState(generationConfig.thinkingMode);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortOption>(generationConfig.reasoningEffort);
  const [temperature, setTemperature] = useState(generationConfig.temperature);
  const [topP, setTopP] = useState(generationConfig.topP);
  const [maxOutputTokens, setMaxOutputTokens] = useState(generationConfig.maxOutputTokens);
  const [rememberApiKeys, setRememberApiKeys] = useState(false);
  const [showProviderModel, setShowProviderModel] = useState(true);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [showGeneration, setShowGeneration] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftProvider(provider);
    setDraftModel(selectedModel);
    setCustomModel("");
    setDraftOpenaiApiKey(openaiApiKey);
    setDraftOpenrouterApiKey(openrouterApiKey);
    setThinkingMode(generationConfig.thinkingMode);
    setReasoningEffort(generationConfig.reasoningEffort);
    setTemperature(generationConfig.temperature);
    setTopP(generationConfig.topP);
    setMaxOutputTokens(generationConfig.maxOutputTokens);
    setRememberApiKeys(window.localStorage.getItem("hmb_remember_api_keys") === "1");
    setShowProviderModel(true);
    setShowApiKeys(false);
    setShowGeneration(false);
  }, [generationConfig, open, openaiApiKey, openrouterApiKey, provider, selectedModel]);

  useEffect(() => {
    const options = modelOptionsByProvider[draftProvider] ?? [];
    if (!options.length) return;
    if (!draftModel.trim()) {
      setDraftModel(options[0]);
    }
  }, [draftModel, draftProvider, modelOptionsByProvider]);

  if (!open) return null;

  const providerModels = modelOptionsByProvider[draftProvider] ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <aside className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Options</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Expandable settings</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200">
            Close
          </button>
        </header>

        <section className="space-y-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowProviderModel((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"
            >
              Provider & Model
              <span>{showProviderModel ? "−" : "+"}</span>
            </button>
            {showProviderModel && (
              <div className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Provider
                </label>
                <select
                  value={draftProvider}
                  onChange={(e) => setDraftProvider(e.target.value as ProviderOption)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Model
                </label>
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
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Custom Model ID
                </label>
                <div className="flex gap-2">
                  <input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="e.g. gpt-5, openai/gpt-5"
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => {
                      const next = customModel.trim();
                      if (!next) return;
                      setDraftModel(next);
                    }}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
                  >
                    Use
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowApiKeys((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"
            >
              API Keys
              <span>{showApiKeys ? "−" : "+"}</span>
            </button>
            {showApiKeys && (
              <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
                  <input type="checkbox" checked={rememberApiKeys} onChange={(e) => setRememberApiKeys(e.target.checked)} />
                  Remember API keys on this browser
                </label>
                <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  OpenAI API key
                  <input
                    type="password"
                    value={draftOpenaiApiKey}
                    onChange={(e) => setDraftOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  OpenRouter API key
                  <input
                    type="password"
                    value={draftOpenrouterApiKey}
                    onChange={(e) => setDraftOpenrouterApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setShowGeneration((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"
            >
              Generation Controls
              <span>{showGeneration ? "−" : "+"}</span>
            </button>
            {showGeneration && (
              <div className="space-y-3 border-t border-zinc-200 p-3 dark:border-zinc-800">
                <label className="mb-2 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
                  <input type="checkbox" checked={thinkingMode} onChange={(e) => setThinkingMode(e.target.checked)} />
                  Enable Thinking mode
                </label>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Reasoning effort
                </label>
                <select
                  value={reasoningEffort}
                  disabled={!thinkingMode}
                  onChange={(e) => setReasoningEffort(e.target.value as ReasoningEffortOption)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="minimal">minimal</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Temperature
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Top p
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={topP}
                      onChange={(e) => setTopP(Number(e.target.value))}
                      className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                </div>

                <label className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Max output tokens
                  <input
                    type="number"
                    step="1"
                    min="128"
                    value={maxOutputTokens}
                    onChange={(e) => setMaxOutputTokens(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setDraftProvider(provider);
              setDraftModel(selectedModel);
              setCustomModel("");
              setDraftOpenaiApiKey(openaiApiKey);
              setDraftOpenrouterApiKey(openrouterApiKey);
              setThinkingMode(generationConfig.thinkingMode);
              setReasoningEffort(generationConfig.reasoningEffort);
              setTemperature(generationConfig.temperature);
              setTopP(generationConfig.topP);
              setMaxOutputTokens(generationConfig.maxOutputTokens);
            }}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            Reset
          </button>
          <button
            onClick={() => {
              onSave({
                provider: draftProvider,
                model: draftModel.trim() || (providerModels[0] ?? selectedModel),
                generationConfig: {
                  thinkingMode,
                  reasoningEffort,
                  temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(2, temperature)) : generationConfig.temperature,
                  topP: Number.isFinite(topP) ? Math.max(0, Math.min(1, topP)) : generationConfig.topP,
                  maxOutputTokens: Number.isFinite(maxOutputTokens)
                    ? Math.max(128, Math.round(maxOutputTokens))
                    : generationConfig.maxOutputTokens,
                },
                openaiApiKey: draftOpenaiApiKey.trim(),
                openrouterApiKey: draftOpenrouterApiKey.trim(),
                rememberApiKeys,
              });
              onClose();
            }}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </aside>
    </div>
  );
}
