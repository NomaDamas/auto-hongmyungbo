import { useEffect, useState } from "react";
import { Check, Inbox, X as XIcon } from "lucide-react";
import type { DocId } from "@shared/types";
import { commentDoc, docLabel } from "@shared/platforms";
import { useStore } from "@/store";
import { applyReply } from "@/lib/dispatch";
import { parseSections } from "@/lib/prompts";

/** Approval gate for replies written directly in an embedded AI chat. */
export function EmbedInbox() {
  const item = useStore((s) => s.embedInbox[0]);
  const queueLength = useStore((s) => s.embedInbox.length);
  const activeDoc = useStore((s) => s.activeDoc);
  const project = useStore((s) => s.project);
  const enabled = useStore((s) => s.enabledPlatforms)();
  const [target, setTarget] = useState<DocId>(activeDoc);

  const sections = item ? parseSections(item.text) : null;
  const sectionDocs = sections ? (Object.keys(sections) as DocId[]).filter((doc) => sections[doc]?.trim()) : [];
  const longForm = !!item && (item.text.length >= 700 || (item.text.match(/\n/g)?.length ?? 0) >= 10);
  const importMaster = !!item && !sections && longForm && !(project?.docs.master ?? "").trim();

  useEffect(() => {
    if (!item) return;
    setTarget(importMaster ? "master" : activeDoc);
  }, [item?.id]);

  if (!item || !project) return null;

  const remove = () => useStore.setState((state) => ({ embedInbox: state.embedInbox.filter((entry) => entry.id !== item.id) }));
  const apply = () => {
    applyReply(item.text, { docs: sections ? sectionDocs : [target], selection: "" });
    remove();
  };
  const targets = ([
    activeDoc,
    "master",
    ...enabled.flatMap((platform): DocId[] => [platform, commentDoc(platform)]),
  ] as DocId[]).filter((doc, index, all) => all.indexOf(doc) === index);

  return (
    <section className="mx-2 mb-1 shrink-0 rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface)] p-3 shadow-sm">
      <header className="flex items-center gap-2 text-[12px] font-medium">
        <Inbox size={14} className="text-[var(--focus)]" />
        <span>{item.label} 새 응답 · {importMaster ? "원문으로 가져오기" : "어디에 넣을까요?"}</span>
        {queueLength > 1 && <span className="pill pill-accent">{queueLength}개 대기</span>}
      </header>
      <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-[var(--muted)]">
        {item.text.slice(0, 160)}{item.text.length > 160 ? "…" : ""}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        {sections ? (
          <span className="input flex h-8 flex-1 items-center py-0 text-[11.5px]">플랫폼별로 나눠 넣기 ({sectionDocs.length}개)</span>
        ) : (
          <select className="input h-8 min-w-0 flex-1 py-0 text-[11.5px]" value={target} onChange={(event) => setTarget(event.target.value as DocId)} aria-label="응답을 넣을 문서">
            {targets.map((doc) => <option key={doc} value={doc}>{docLabel(doc)}{doc === activeDoc ? " (현재)" : ""}</option>)}
          </select>
        )}
        <button className="btn btn-xs btn-primary" disabled={sections ? sectionDocs.length === 0 : !target} onClick={apply}>
          <Check size={12} /> 넣기
        </button>
        <button className="btn btn-xs btn-ghost" onClick={remove}>
          <XIcon size={12} /> 무시
        </button>
      </div>
    </section>
  );
}
