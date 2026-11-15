import { useState } from "react";
import { BarChart3, ExternalLink, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { PlatformId, PostInsights, PublishState } from "@shared/types";
import { PLATFORMS, TABS, commentDoc, docLabel, platformsInTab } from "@shared/platforms";
import { useStore, type WorkspaceMode } from "@/store";
import { runIntent } from "@/lib/dispatch";
import { focusEditorTab } from "./EditorArea";
import { PlatformIcon } from "./PlatformIcon";

const METRICS = [
  ["views", "조회"],
  ["likes", "좋아요"],
  ["comments", "댓글"],
  ["shares", "공유"],
  ["saves", "저장"],
  ["clicks", "클릭"],
] as const;

type MetricKey = (typeof METRICS)[number][0];

function metricValue(value: number | undefined): string {
  return value === undefined ? "—" : value.toLocaleString();
}

function relativeTime(value: string | undefined): string {
  if (!value) return "아직 확인 안 함";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "확인 시간 없음";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 45) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function shortTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function publishLabel(state: PublishState | undefined): string {
  if (!state || state.status === "draft") return "초안";
  if (state.status === "scheduled") return state.scheduledAt ? `예약 ${shortTime(state.scheduledAt)}` : "예약됨";
  if (state.status === "posted") return "게시됨";
  if (state.status === "failed") return "실패";
  return "게시 중";
}

function publishClass(state: PublishState | undefined): string {
  if (state?.status === "posted") return "pill-success";
  if (state?.status === "failed") return "bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)]";
  if (state?.status === "scheduled" || state?.status === "ready" || state?.status === "sent") return "pill-warning";
  return "pill-accent";
}

function openPlatform(platform: PlatformId, mode: WorkspaceMode): void {
  const tab = PLATFORMS[platform].tab;
  useStore.getState().setMode(mode);
  useStore.setState((state) => ({
    activeDoc: mode === "comment" ? commentDoc(platform) : platform,
    tabSelection: { ...state.tabSelection, [tab]: platform },
  }));
  window.setTimeout(() => focusEditorTab(tab), 0);
}

export function InsightsBoard() {
  const project = useStore((s) => s.project)!;
  const enabled = useStore((s) => s.enabledPlatforms)();
  const [refreshing, setRefreshing] = useState<Set<PlatformId>>(new Set());
  const [refreshingAll, setRefreshingAll] = useState(false);
  const published = enabled.filter((platform) => !!project.meta.publish[platform]?.url);

  const refresh = async (platforms: PlatformId[], announce = false) => {
    if (!platforms.length) return;
    setRefreshing((current) => new Set([...current, ...platforms]));
    try {
      const result = await window.api.publish.refreshInsights(project.slug, platforms);
      useStore.getState().setInsights(result);
      if (announce) toast.success(`${Object.keys(result).length}개 플랫폼 인사이트를 새로고침했습니다.`);
    } catch (error) {
      toast.error(`인사이트 새로고침 실패: ${(error as Error).message}`);
    } finally {
      setRefreshing((current) => {
        const next = new Set(current);
        platforms.forEach((platform) => next.delete(platform));
        return next;
      });
      setRefreshingAll(false);
    }
  };

  const refreshAll = async () => {
    if (!published.length || refreshingAll) return;
    setRefreshingAll(true);
    await refresh(published, true);
  };

  const total = (key: MetricKey): number | undefined => {
    const values = enabled.map((platform) => project.meta.insights?.[platform]?.[key]).filter((value): value is number => value !== undefined);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <header className="mx-auto mb-5 flex max-w-[1500px] flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-[17px] font-semibold"><BarChart3 size={18} /> 플랫폼 인사이트</h1>
          <p className="mt-1 text-[11.5px] text-[var(--muted)]">게시된 글의 반응과 최근 댓글을 한눈에 확인하세요.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map(([key, label]) => (
            <div key={key} className="min-w-[68px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-center">
              <div className="text-[10px] text-[var(--muted)]">전체 {label}</div>
              <div className="mt-0.5 text-[13px] font-semibold">{metricValue(total(key))}</div>
            </div>
          ))}
        </div>
        <button className="btn btn-sm" disabled={!published.length || refreshingAll} onClick={() => void refreshAll()}>
          {refreshingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          새로고침
        </button>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-6 pb-6">
        {TABS.filter((tab) => tab.id !== "master").map((tab) => {
          const platforms = platformsInTab(tab.id, enabled);
          if (!platforms.length) return null;
          return (
            <section key={tab.id}>
              <h2 className="mb-2 px-0.5 text-[11px] font-semibold text-[var(--muted)]">{tab.label}</h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                {platforms.map((platform) => (
                  <InsightCard
                    key={platform}
                    platform={platform}
                    insight={project.meta.insights?.[platform]}
                    refreshing={refreshing.has(platform)}
                    onRefresh={() => void refresh([platform])}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function InsightCard({ platform, insight, refreshing, onRefresh }: { platform: PlatformId; insight?: PostInsights; refreshing: boolean; onRefresh: () => void }) {
  const project = useStore((s) => s.project)!;
  const publish = project.meta.publish[platform];
  const comment = project.meta.comments?.[platform];
  const published = !!publish?.url;
  const commentStatus = !comment || comment.status === "draft" ? "초안" : comment.status === "sent" ? "등록 중" : comment.status === "posted" ? "등록됨" : "실패";

  const reply = (author: string, text: string, url?: string) => {
    useStore.getState().setComment(platform, { mode: "reply", targetUrl: url ?? publish?.url });
    openPlatform(platform, "comment");
    void runIntent(`이 댓글에 답글을 써줘: "${text}" (by ${author})`, undefined, [commentDoc(platform)]);
  };

  return (
    <article className={`rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 ${published ? "" : "opacity-65"}`}>
      <header className="flex items-center gap-2">
        <PlatformIcon doc={platform} size={18} />
        <strong className="text-[13px]">{PLATFORMS[platform].label}</strong>
        <span className={`pill ${publishClass(publish)}`}>{publishLabel(publish)}</span>
        <button className="icon-btn ml-auto" disabled={!published || refreshing} onClick={onRefresh} title={`${docLabel(platform)} 인사이트 새로고침`}>
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </header>

      {!published ? (
        <div className="mt-5 rounded-xl bg-[var(--surface-2)] px-4 py-6 text-center">
          <p className="text-[12px] text-[var(--muted)]">아직 게시 전</p>
          <button className="btn btn-xs mt-3" onClick={() => openPlatform(platform, "post")}>게시하러 가기</button>
        </div>
      ) : (
        <>
          <button className="mt-3 flex w-full items-center gap-1 text-left text-[11px] text-[var(--focus)]" onClick={() => window.api.openExternal(publish.url!)} title={publish.url}>
            <span className="min-w-0 flex-1 truncate">{publish.url}</span><ExternalLink size={11} />
          </button>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {METRICS.map(([key, label]) => (
              <div key={key} className="rounded-lg bg-[var(--surface-2)] px-2 py-2 text-center">
                <div className="text-[10px] text-[var(--muted)]">{label}</div>
                <div className="mt-0.5 text-[15px] font-semibold">{metricValue(insight?.[key])}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[10.5px] text-[var(--muted)]">
            <span>{relativeTime(insight?.at)}</span>
            <span className={comment?.status === "failed" ? "text-[var(--error)]" : ""}>내 댓글: {commentStatus}</span>
          </div>
          {insight?.error && <p className="mt-2 break-words text-[11px] text-[var(--error)]">{insight.error}</p>}
          {!!insight?.recentComments?.length && (
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <h3 className="mb-2 flex items-center gap-1 text-[11px] font-medium"><MessageCircle size={12} /> 최근 댓글</h3>
              <div className="space-y-2">
                {insight.recentComments.slice(0, 3).map((item, index) => (
                  <div key={`${item.author}-${index}`} className="rounded-lg bg-[var(--surface-2)] p-2.5">
                    <div className="text-[10.5px] font-medium">{item.author}</div>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-[var(--muted)]">{item.text}</p>
                    <button className="btn btn-xs btn-ghost mt-1.5 px-0" onClick={() => reply(item.author, item.text, item.url)}>답글 쓰기</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}
