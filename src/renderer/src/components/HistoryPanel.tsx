import { useEffect, useState } from "react";
import { X as XIcon } from "lucide-react";
import type { Snapshot } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { useStore } from "@/store";

/** Snapshots are taken automatically before every accepted AI/harness change. Restoring goes through the diff review. */
export function HistoryPanel() {
  const doc = useStore((s) => s.historyDoc);
  const project = useStore((s) => s.project);
  const [items, setItems] = useState<Snapshot[]>([]);

  useEffect(() => {
    if (!doc || !project) return;
    void window.api.projects.listSnapshots(project.slug, doc).then(setItems);
  }, [doc, project?.slug]);

  if (!doc || !project) return null;
  const close = () => useStore.setState({ historyDoc: null });

  const restore = async (s: Snapshot) => {
    const text = await window.api.projects.readSnapshot(project.slug, s.id, doc);
    close();
    useStore.getState().propose(doc, text, `버전 ${new Date(s.at).toLocaleString()}`);
  };

  return (
    <div className="scrim z-40 justify-end" onMouseDown={close}>
      <aside className="glass m-2 flex w-[340px] flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex h-11 items-center border-b border-[var(--border)] px-4">
          <span className="text-[13px] font-semibold">{docLabel(doc)} 버전 기록</span>
          <button className="icon-btn ml-auto" onClick={close}>
            <XIcon size={14} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-2">
          {items.length === 0 && <p className="p-3 text-[13px] text-[var(--muted)]">AI 수정을 수락할 때마다 직전 버전이 여기에 저장됩니다.</p>}
          {items.map((s) => (
            <button key={s.id} className="w-full rounded-md px-3 py-2 text-left hover:bg-[var(--surface-2)]" onClick={() => void restore(s)}>
              <div className="text-[13px]">{new Date(s.at).toLocaleString()}</div>
              <div className="text-[11px] text-[var(--muted)]">{s.label}</div>
            </button>
          ))}
        </div>
        <footer className="border-t border-[var(--border)] p-3 text-[11px] text-[var(--muted)]">클릭하면 현재 글과의 diff로 열립니다.</footer>
      </aside>
    </div>
  );
}
