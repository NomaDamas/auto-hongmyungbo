import { Check, X as XIcon } from "lucide-react";
import type { DocId } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { useStore } from "@/store";
import { resolveAll } from "./DocEditor";
import { PlatformIcon } from "./PlatformIcon";

/** Appears when 2+ columns have pending changes: review the batch at a glance, accept/reject all at once. */
export function ReviewBar() {
  const proposals = useStore((s) => s.proposals);
  const docs = Object.keys(proposals) as DocId[];
  if (docs.length < 2) return null;
  const all = (mode: "accept" | "reject") => docs.forEach((d) => resolveAll(d, mode));
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--accent-soft)] px-3 text-[12px]">
      <span className="font-medium">{docs.length}개 열에 수정 제안</span>
      <div className="flex gap-1">
        {docs.map((d) => (
          <button key={d} className="pill pill-accent gap-1" onClick={() => useStore.setState({ focusDoc: d })}>
            <PlatformIcon doc={d} size={10} /> {docLabel(d)}
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-1">
        <button className="btn btn-xs btn-primary" onClick={() => all("accept")}>
          <Check size={12} /> 전부 수락
        </button>
        <button className="btn btn-xs" onClick={() => all("reject")}>
          <XIcon size={12} /> 전부 거절
        </button>
      </div>
    </div>
  );
}
