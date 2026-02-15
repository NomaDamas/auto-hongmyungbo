"use client";

import { useMemo, useState } from "react";
import type { Platform } from "@/lib/types";

const PLATFORM_ORDER: Platform[] = ["instagram", "twitter", "linkedin", "reddit", "blog"];

type Props = {
  open: boolean;
  contexts: Record<Platform, string>;
  onClose: () => void;
  onSave: (next: Record<Platform, string>) => void;
};

export function ContextPanel({ open, contexts, onClose, onSave }: Props) {
  const [tab, setTab] = useState<Platform>("instagram");
  const [draft, setDraft] = useState<Record<Platform, string>>(contexts);

  const currentValue = useMemo(() => draft[tab] ?? "", [draft, tab]);

  if (!open) return null;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button className="h-full w-full bg-black/50" onClick={onClose} aria-label="close context panel" />
      <aside className="relative h-full w-full max-w-xl border-l border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">플랫폼별 스타일 설정</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">저장된 문구는 생성/수정 시 시스템 컨텍스트로 전달됩니다.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700 dark:text-zinc-200"
          >
            닫기
          </button>
        </header>

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

        <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {tab} Context
        </label>
        <textarea
          value={currentValue}
          onChange={(e) => setDraft((prev) => ({ ...prev, [tab]: e.target.value }))}
          placeholder="예: 문장 길이는 짧게, 이모지 금지, 해시태그는 마지막에 3개"
          className="h-[54vh] w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-700"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setDraft(contexts)}
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
