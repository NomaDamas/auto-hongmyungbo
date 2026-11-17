import { useEffect } from "react";
import { Check, Eye, RefreshCw, X as XIcon } from "lucide-react";
import clsx from "clsx";
import type { DockviewPanelApi } from "dockview-react";
import type { DocId, PlatformId } from "@shared/types";
import { PLATFORMS, TABS, TITLE_PLATFORMS, commentDoc, parseDoc, platformsInTab, type TabId } from "@shared/platforms";
import { isStale, useStore } from "@/store";
import { countFor } from "@/lib/count";
import { runPropagate } from "@/lib/dispatch";
import { DocEditor, resolveAll } from "./DocEditor";
import { PlatformIcon } from "./PlatformIcon";
import { AdvancedMenu } from "./AdvancedMenu";
import { MediaStrip } from "./MediaStrip";
import { PublishButton } from "./PublishButton";
import { CommentButton } from "./CommentButton";
import { SourcePicker } from "./SourcePicker";
import { ThreadEditor } from "./ThreadEditor";

const MASTER_PLACEHOLDER = "생각나는 대로 쓰세요. 이 원문이 모든 플랫폼으로 전파됩니다.";

function placeholderFor(doc: DocId): string {
  const { platform, variant } = parseDoc(doc);
  if (!platform) return MASTER_PLACEHOLDER;
  if (variant === "comment") return "짧고 자연스러운 댓글을 쓰거나 ⋯ 메뉴에서 초안을 만드세요.";
  return TITLE_PLATFORMS.includes(platform) ? "# 제목\n\n본문" : "아직 비어 있음 — 원문에서 생성하거나 직접 쓰세요.";
}

export function DocPane({ tab, api }: { tab: TabId; api: DockviewPanelApi }) {
  const project = useStore((s) => s.project)!;
  const enabled = useStore((s) => s.project?.meta.platforms ?? s.settings?.platforms ?? []);
  const tabSelection = useStore((s) => s.tabSelection);
  const mode = useStore((s) => s.mode);
  const platforms = platformsInTab(tab, enabled);
  const remembered = tabSelection[tab];
  const selected = remembered && platforms.includes(remembered) ? remembered : platforms[0];
  const variant = tab !== "master" && mode === "comment" ? "comment" : "post";
  const doc: DocId = tab === "master" ? "master" : variant === "comment" ? commentDoc(selected!) : selected!;
  const proposals = useStore((s) => s.proposals);
  const proposal = proposals[doc];
  const text = proposal?.proposed ?? project.docs[doc] ?? "";
  const count = countFor(doc, text);
  const stale = variant === "post" && !!selected && isStale(project, selected);

  useEffect(() => {
    if (tab === "master" || !selected) return;
    if (tabSelection[tab] !== selected) useStore.setState((s) => ({ tabSelection: { ...s.tabSelection, [tab]: selected } }));
    if (api.isActive) useStore.setState({ activeDoc: doc });
  }, [api, doc, selected, tab, tabSelection]);

  const selectPlatform = (platform: PlatformId) => {
    const nextDoc = variant === "comment" ? commentDoc(platform) : platform;
    useStore.setState((s) => ({ tabSelection: { ...s.tabSelection, [tab]: platform }, activeDoc: nextDoc }));
    api.setActive();
  };
  const publish = selected && variant === "post" ? project.meta.publish[selected] : undefined;

  return (
    <section
      className="flex h-full min-w-0 flex-col bg-[var(--surface)]"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("application/x-hmb-doc", doc)}
      onPointerDownCapture={() => {
        if (!api.isActive) api.setActive();
        if (useStore.getState().activeDoc !== doc) useStore.setState({ activeDoc: doc });
      }}
    >
      <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-2.5">
        {tab === "master" ? (
          <span className="px-1 text-[12px] font-medium text-[var(--muted)]">원문</span>
        ) : (
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-[var(--surface-2)] p-0.5">
            {platforms.map((platform) => {
              const comment = commentDoc(platform);
              const marked = !!proposals[platform] || !!proposals[comment] || !!project.docs[comment]?.trim() || isStale(project, platform);
              return (
                <button
                  key={platform}
                  className={clsx(
                    "flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px]",
                    selected === platform ? "bg-[var(--surface-3)] text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]",
                  )}
                  onClick={() => selectPlatform(platform)}
                >
                  <PlatformIcon doc={platform} size={11} />
                  {PLATFORMS[platform].label}
                  {marked && <span className={clsx("h-1.5 w-1.5 rounded-full", isStale(project, platform) ? "bg-[var(--warning)]" : "bg-[var(--focus)]")} />}
                </button>
              );
            })}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {tab !== "master" && <button className="icon-btn" title={`${TABS.find((item) => item.id === tab)?.label ?? tab} Pane 닫기`} onClick={() => api.close()}><XIcon size={12} /></button>}
          {publish?.status === "scheduled" && publish.scheduledAt && (
            <span className="pill bg-[color-mix(in_srgb,var(--focus)_12%,transparent)] text-[var(--focus)]">예약 {shortTime(publish.scheduledAt)}</span>
          )}
          {doc === "master" ? (
            <SourcePicker />
          ) : (
            <>
              <button className="btn btn-xs btn-ghost" onClick={() => useStore.setState({ previewDoc: selected })}>
                <Eye size={12} /> 미리보기
              </button>
              {variant === "comment" ? <CommentButton platform={selected!} /> : <PublishButton doc={selected!} />}
            </>
          )}
          <AdvancedMenu />
        </div>
      </header>

      {stale && selected && (
        <button className="flex shrink-0 items-center justify-center gap-1.5 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] px-3 py-1.5 text-[11.5px] text-[var(--warning)]" onClick={() => void runPropagate([selected])}>
          <RefreshCw size={11} /> 원문이 바뀌었어요 · 이 플랫폼에 반영
        </button>
      )}
      {proposal && (
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 text-[11.5px]">
          <span className="truncate text-[var(--muted)]">{proposal.source} 수정 제안</span>
          <div className="ml-auto flex gap-1">
            <button className="btn btn-xs btn-primary" onClick={() => resolveAll(doc, "accept")}>
              <Check size={11} /> 모두 수락
            </button>
            <button className="btn btn-xs" onClick={() => resolveAll(doc, "reject")}>
              <XIcon size={11} /> 모두 거절
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {variant === "post" && (selected === "x" || selected === "threads") && !proposal ? <ThreadEditor platform={selected} value={project.docs[doc] ?? ""} /> : <DocEditor doc={doc} value={project.docs[doc] ?? ""} proposal={proposal} placeholder={placeholderFor(doc)} />}
      </div>
      {variant === "post" && <MediaStrip doc={doc} />}
      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-[var(--border)] px-3 text-[10.5px] text-[var(--muted)]">
        <CountGauge used={count.used} limit={count.limit} />
        {count.note && <span>{count.note}</span>}
      </footer>
    </section>
  );
}

function shortTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CountGauge({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) return <span>{used.toLocaleString()}자</span>;
  const ratio = Math.min(used / limit, 1);
  const color = used > limit ? "var(--error)" : ratio > 0.9 ? "var(--warning)" : "var(--success)";
  return (
    <span className="flex items-center gap-1.5" style={{ color: used > limit ? "var(--error)" : undefined }}>
      <svg width="12" height="12" viewBox="0 0 12 12" className="-rotate-90">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--surface-3)" strokeWidth="1.5" />
        <circle cx="6" cy="6" r="4.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={`${ratio * 28.27} 28.27`} />
      </svg>
      {used.toLocaleString()} / {limit.toLocaleString()}
    </span>
  );
}
