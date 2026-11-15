import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import type { CommentState, PlatformId } from "@shared/types";
import { PLATFORMS, commentDoc } from "@shared/platforms";
import { useStore } from "@/store";
import { countFor } from "@/lib/count";
import { Popover } from "./Popover";

function statusLine(state: CommentState | undefined): string {
  if (!state || state.status === "draft") return "댓글 초안";
  if (state.status === "sent") return "Aside에서 댓글을 등록하는 중";
  if (state.status === "posted") return "댓글 등록 완료";
  return "댓글 등록 실패";
}

export function CommentButton({ platform }: { platform: PlatformId }) {
  const project = useStore((s) => s.project);
  const proposal = useStore((s) => s.proposals[commentDoc(platform)]);
  const commentState = useStore((s) => s.project?.meta.comments?.[platform]);
  const aside = useStore((s) => s.aside);
  const login = useStore((s) => s.asideLogins[platform]);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [mode, setMode] = useState<"first" | "reply">(commentState?.mode ?? "first");
  const [targetUrl, setTargetUrl] = useState(commentState?.targetUrl ?? "");
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(commentState?.mode ?? "first");
    setTargetUrl(commentState?.targetUrl ?? "");
  }, [open]);

  if (!project) return null;
  const doc = commentDoc(platform);
  const text = project.docs[doc] ?? "";
  const postUrl = project.meta.publish[platform]?.url;

  const chooseMode = (next: "first" | "reply") => {
    setMode(next);
    useStore.getState().setComment(platform, { mode: next, targetUrl: targetUrl.trim() || undefined });
  };

  const publish = async () => {
    if (proposal) {
      toast.error(`${PLATFORMS[platform].label} 댓글에 검토 안 된 수정 제안이 있습니다.`);
      return;
    }
    if (!text.trim()) {
      toast.error(`${PLATFORMS[platform].label} 댓글이 비어 있습니다.`);
      return;
    }
    const count = countFor(doc, text);
    if (count.limit !== null && count.used > count.limit) {
      toast.error(`${PLATFORMS[platform].label} 댓글 글자수 초과 (${count.used}/${count.limit})`);
      return;
    }
    if (mode === "reply" && !targetUrl.trim()) {
      toast.error("답글을 달 게시물 URL을 입력하세요.");
      return;
    }
    if (!aside?.installed || !aside.signedIn || login === "signed-out") {
      toast.error(`Aside에서 ${PLATFORMS[platform].label} 로그인이 필요합니다.`);
      useStore.setState({ asideOpen: true });
      setOpen(false);
      return;
    }

    const url = mode === "reply" ? targetUrl.trim() : undefined;
    useStore.getState().setComment(platform, { mode, targetUrl: targetUrl.trim() || undefined, status: "sent", error: undefined });
    setWorking(true);
    try {
      await window.api.publish.comment(project.slug, platform, url);
      setOpen(false);
    } catch (error) {
      const message = (error as Error).message;
      useStore.getState().setComment(platform, { status: "failed", error: message });
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div ref={anchor}>
      <button className="btn btn-xs btn-primary" onClick={() => setOpen((value) => !value)} title={`${PLATFORMS[platform].label} 댓글 등록`}>
        <MessageCircle size={11} /> 댓글 <ChevronDown size={11} />
      </button>
      {open && (
        <Popover anchor={anchor} align="right" width={330} onClose={() => setOpen(false)} className="p-4 text-[12.5px]">
          <div className="mb-3 font-semibold">{PLATFORMS[platform].label} 댓글</div>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-[var(--surface-2)]">
              <input type="radio" name={`comment-mode-${platform}`} checked={mode === "first"} onChange={() => chooseMode("first")} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">내 게시물 첫 댓글</span>
                {postUrl ? (
                  <button
                    className="mt-1 flex max-w-full items-center gap-1 text-left text-[11px] text-[var(--focus)]"
                    onClick={(event) => {
                      event.preventDefault();
                      window.api.openExternal(postUrl);
                    }}
                  >
                    <span className="truncate">{postUrl}</span><ExternalLink size={10} />
                  </button>
                ) : (
                  <span className="mt-1 block text-[11px] text-[var(--muted)]">게시 후 자동으로 달립니다</span>
                )}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-[var(--surface-2)]">
              <input type="radio" name={`comment-mode-${platform}`} checked={mode === "reply"} onChange={() => chooseMode("reply")} />
              <span className="font-medium">다른 게시물에 답글</span>
            </label>
            {mode === "reply" && (
              <input
                className="input w-full text-[12px]"
                type="url"
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                onBlur={() => useStore.getState().setComment(platform, { targetUrl: targetUrl.trim() || undefined })}
                placeholder="답글을 달 게시물 URL"
                autoFocus
              />
            )}
          </div>

          <div className={`mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[11px] ${commentState?.status === "failed" ? "text-[var(--error)]" : "text-[var(--muted)]"}`}>
            <div className="flex items-center gap-1.5">
              <span>{statusLine(commentState)}</span>
              {commentState?.status === "posted" && commentState.url && (
                <button className="ml-auto flex items-center gap-1 text-[var(--focus)]" onClick={() => window.api.openExternal(commentState.url!)}>
                  열기 <ExternalLink size={10} />
                </button>
              )}
            </div>
            {commentState?.status === "failed" && commentState.error && <div className="mt-1 break-words">{commentState.error}</div>}
          </div>

          <button className="btn btn-sm btn-primary mt-3 w-full justify-center" disabled={working} onClick={() => void publish()}>
            {working ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            지금 댓글 달기
          </button>
        </Popover>
      )}
    </div>
  );
}
