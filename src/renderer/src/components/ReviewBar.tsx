import { Check, X as XIcon } from "lucide-react";
import type { DocId } from "@shared/types";
import { PLATFORMS, docLabel, parseDoc } from "@shared/platforms";
import { useStore } from "@/store";
import { resolveAll } from "./DocEditor";
import { PlatformIcon } from "./PlatformIcon";

/** Batch review for propagation results; individual diffs stay in their own panels. */
export function ReviewBar() {
  const proposals = useStore((s) => s.proposals);
  const docs = Object.keys(proposals) as DocId[];
  if (docs.length < 2) return null;
  const all = (mode: "accept" | "reject") => docs.forEach((d) => resolveAll(d, mode));
  return (
    <div className="mx-2 mb-1 flex h-9 shrink-0 items-center gap-2 rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-[12px]">
      <span className="font-medium">{docs.length}개 문서에 수정 제안</span>
      <div className="flex min-w-0 gap-1 overflow-x-auto">
        {docs.map((d) => (
          <button
            key={d}
            className="pill pill-accent gap-1"
            onClick={() => {
              const { platform, variant } = parseDoc(d);
              const tab = platform ? PLATFORMS[platform].tab : "master";
              if (platform) useStore.getState().setMode(variant);
              useStore.setState((s) => ({
                activeDoc: d,
                tabSelection: platform ? { ...s.tabSelection, [tab]: platform } : s.tabSelection,
              }));
              window.dispatchEvent(new CustomEvent("hmb:focus-tab", { detail: tab }));
            }}
          >
            <PlatformIcon doc={d} size={10} /> {docLabel(d)}
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-1">
        <button className="btn btn-xs btn-primary" onClick={() => all("accept")}>
          <Check size={12} /> 모두 수락
        </button>
        <button className="btn btn-xs" onClick={() => all("reject")}>
          <XIcon size={12} /> 모두 거절
        </button>
      </div>
    </div>
  );
}
