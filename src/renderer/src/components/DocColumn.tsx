import { Check, Copy, History, Loader2, Maximize2, Minimize2, RefreshCw, Sparkles, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import type { DocId } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { isStale, useStore } from "@/store";
import { countFor } from "@/lib/count";
import { ACTIONS, type RewriteAction } from "@/lib/prompts";
import { cancelPending, runRewrite, runUpdateFromMaster } from "@/lib/dispatch";
import { DocEditor, resolveAll } from "./DocEditor";
import { PlatformIcon } from "./PlatformIcon";

const QUICK: RewriteAction[] = ["humanize", "shorter", "hook"];

const PLACEHOLDER: Record<DocId, string> = {
  master: "생각나는 대로 쓰세요. 이 원문에서 플랫폼별 글이 만들어집니다.\n\n⌘↵ 전체 생성 · ⌘K 명령",
  linkedin: "아직 비어 있음 — 원문에서 생성하거나 직접 쓰세요.",
  x: "아직 비어 있음",
  threads: "아직 비어 있음",
  reddit: "# 제목\n\n본문",
};

export function DocColumn({ doc }: { doc: DocId }) {
  const project = useStore((s) => s.project)!;
  const proposal = useStore((s) => s.proposals[doc]);
  const selection = useStore((s) => s.selections[doc] ?? "");
  const focused = useStore((s) => s.focusDoc === doc);
  const solo = useStore((s) => s.soloDoc === doc);
  const pending = useStore((s) => s.pendingReply);
  const publish = doc === "master" ? undefined : project.meta.publish[doc];
  const text = proposal?.proposed ?? project.docs[doc];
  const count = countFor(doc, text);
  const over = count.limit !== null && count.used > count.limit;
  const stale = doc !== "master" && isStale(project, doc);
  const waiting = pending?.doc === doc || (pending?.kind === "generate" && doc !== "master");

  return (
    <section
      className={clsx(
        "@container flex h-full min-w-0 flex-col border-r border-[var(--border)] last:border-r-0",
        focused && "bg-[var(--surface-2)]",
      )}
      onMouseDown={() => useStore.setState({ focusDoc: doc })}
    >
      <header className="flex h-11 shrink-0 items-center gap-1.5 overflow-hidden border-b border-[var(--border)] px-3">
        <PlatformIcon doc={doc} />
        <span className="truncate text-[13px] font-semibold">{docLabel(doc)}</span>
        {publish?.status === "posted" && <span className="pill pill-success">게시됨</span>}
        {publish?.status === "ready" && <span className="pill pill-accent">게시 대기</span>}
        {stale && (
          <button
            className="pill pill-warning hover:brightness-110"
            title="원문이 바뀌었습니다. 클릭하면 변경분을 반영하도록 요청합니다."
            onClick={() => void runUpdateFromMaster(doc)}
          >
            <RefreshCw size={11} /> 원문 변경됨
          </button>
        )}
        <div className="ml-auto flex shrink-0 items-center">
          <button className="icon-btn hidden @[240px]:inline-flex" title="버전 기록" onClick={() => useStore.setState({ historyDoc: doc })}>
            <History size={14} />
          </button>
          <button
            className="icon-btn"
            title="복사"
            onClick={() => {
              window.api.clipboard.write(text);
              toast.success(`${docLabel(doc)} 복사됨`);
            }}
          >
            <Copy size={14} />
          </button>
          <button className="icon-btn" title={solo ? "모든 열 보기" : "이 열만 보기"} onClick={() => useStore.setState({ soloDoc: solo ? null : doc })}>
            {solo ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      {proposal && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px]">
          <span className="flex min-w-0 items-center gap-1.5">
            <Sparkles size={13} className="shrink-0 text-[var(--accent)]" />
            <b className="truncate">{proposal.source}</b>
            <span className="hidden truncate text-[var(--muted)] @[340px]:inline">수정 제안 · 덩어리별 수락/거절 또는 직접 편집</span>
          </span>
          <div className="ml-auto flex gap-1">
            <button className="btn btn-xs btn-primary" onClick={() => resolveAll(doc, "accept")} title="모두 수락 (⌘⇧↵)">
              <Check size={12} /> 모두 수락
            </button>
            <button className="btn btn-xs" onClick={() => resolveAll(doc, "reject")} title="모두 거절 (⌘⇧⌫)">
              <XIcon size={12} /> 거절
            </button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <DocEditor doc={doc} value={project.docs[doc]} proposal={proposal} placeholder={PLACEHOLDER[doc]} />
        {waiting && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[12px] shadow-lg">
              <Loader2 size={12} className="animate-spin" /> AI 응답 기다리는 중
              <button className="text-[var(--muted)] hover:text-[var(--fg)]" onClick={cancelPending}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      <footer className="flex h-10 shrink-0 items-center gap-0.5 overflow-hidden border-t border-[var(--border)] px-1.5">
        {/* Narrow column: one primary action; wider columns show the rest. ⌘K always has all. */}
        {QUICK.map((a, i) => (
          <button
            key={a}
            className={clsx("btn btn-xs btn-ghost", i > 0 && "hidden @[300px]:inline-flex")}
            onClick={() => void runRewrite(doc, a)}
            title={selection ? "선택 영역에 적용" : "전체에 적용"}
          >
            {ACTIONS[a].label}
          </button>
        ))}
        {over && doc !== "master" && (
          <button className="btn btn-xs btn-ghost text-[var(--error)]" onClick={() => void runRewrite(doc, "fit")}>
            글자수 맞추기
          </button>
        )}
        {selection && <span className="ml-1 truncate text-[11px] text-[var(--accent)]">선택 {selection.length}자</span>}
        <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-[var(--muted)]">
          {count.note && <span className="hidden @[260px]:inline">{count.note}</span>}
          <CountGauge used={count.used} limit={count.limit} />
        </div>
      </footer>
    </section>
  );
}

function CountGauge({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) return <span>{used.toLocaleString()}자</span>;
  const ratio = Math.min(used / limit, 1);
  const color = used > limit ? "var(--error)" : ratio > 0.9 ? "var(--warning)" : "var(--success)";
  return (
    <span className="flex items-center gap-1.5" style={{ color: used > limit ? "var(--error)" : undefined }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="var(--border)" strokeWidth="2" />
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={`${ratio * 37.7} 37.7`}
          transform="rotate(-90 8 8)"
          strokeLinecap="round"
        />
      </svg>
      {used.toLocaleString()} / {limit.toLocaleString()}
    </span>
  );
}
