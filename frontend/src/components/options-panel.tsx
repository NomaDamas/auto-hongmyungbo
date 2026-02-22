"use client";

import { useEffect, useState } from "react";
import type { ProviderOption } from "@/lib/types";

type Props = {
  open: boolean;
  provider: ProviderOption;
  availableProviders: ProviderOption[];
  onClose: () => void;
  onSave: (provider: ProviderOption) => void;
};

export function OptionsPanel({ open, provider, availableProviders, onClose, onSave }: Props) {
  const [draftProvider, setDraftProvider] = useState<ProviderOption>(provider);

  useEffect(() => {
    if (!open) return;
    setDraftProvider(provider);
  }, [open, provider]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <aside className="relative w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-zinc-900">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Options</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Provider settings</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200">
            Close
          </button>
        </header>

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

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setDraftProvider(provider)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            Reset
          </button>
          <button
            onClick={() => {
              onSave(draftProvider);
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

