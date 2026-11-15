import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CalendarDays, ChevronDown, CircleAlert, ExternalLink, Loader2, Send, X as XIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ko } from "date-fns/locale/ko";
import "react-day-picker/style.css";
import { toast } from "sonner";
import type { PlatformId, PublishState } from "@shared/types";
import { PLATFORMS } from "@shared/platforms";
import { useStore } from "@/store";
import { countFor } from "@/lib/count";
import { mediaProblems } from "./MediaStrip";
import { Popover } from "./Popover";

const dayPickerStyle = {
  "--rdp-accent-color": "var(--fg)",
  "--rdp-accent-background-color": "var(--surface-3)",
  "--rdp-range_middle-background-color": "var(--surface-2)",
  "--rdp-day_button-border-radius": "999px",
  "--rdp-selected-border": "1px solid var(--fg)",
} as CSSProperties;

function statusText(state: PublishState | undefined): string {
  if (!state || state.status === "draft") return "초안";
  if (state.status === "scheduled") {
    if (!state.scheduledAt) return "예약됨";
    const at = new Date(state.scheduledAt);
    return `예약됨 ${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  }
  if (state.status === "ready" || state.status === "sent") return "게시 중";
  if (state.status === "posted") return "게시됨";
  return "실패";
}

function atLocalTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function PublishButton({ doc }: { doc: PlatformId }) {
  const project = useStore((s) => s.project);
  const proposal = useStore((s) => s.proposals[doc]);
  const publishState = useStore((s) => s.project?.meta.publish[doc]);
  const aside = useStore((s) => s.aside);
  const login = useStore((s) => s.asideLogins[doc]);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const [working, setWorking] = useState(false);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [day, setDay] = useState<Date | undefined>(tomorrow);
  const [time, setTime] = useState("09:00");

  if (!project) return null;
  const text = project.docs[doc] ?? "";
  const media = project.meta.media?.[doc] ?? [];
  const mode = PLATFORMS[doc].nativeSchedule ? "aside-native" : "app";
  const scheduled = publishState?.status === "scheduled";

  const guard = (): boolean => {
    if (proposal) {
      toast.error(`${PLATFORMS[doc].label}에 검토 안 된 수정 제안이 있습니다.`);
      return false;
    }
    if (!text.trim()) {
      toast.error(`${PLATFORMS[doc].label} 글이 비어 있습니다.`);
      return false;
    }
    const count = countFor(doc, text);
    if (count.limit !== null && count.used > count.limit) {
      toast.error(`${PLATFORMS[doc].label} 글자수 초과 (${count.used}/${count.limit})`);
      return false;
    }
    const problems = mediaProblems(doc, media);
    if (problems.length) {
      toast.error(`${PLATFORMS[doc].label} 미디어 규칙을 확인하세요: ${problems.join(", ")}`);
      return false;
    }
    if (!aside?.installed || !aside.signedIn || login === "signed-out") {
      toast.error(`Aside에서 ${PLATFORMS[doc].label} 로그인이 필요합니다.`);
      useStore.setState({ asideOpen: true });
      setOpen(false);
      return false;
    }
    return true;
  };

  const publishNow = async () => {
    if (!guard()) return;
    setWorking(true);
    useStore.getState().setPublish(doc, { status: "ready", at: new Date().toISOString() });
    try {
      await window.api.publish.now(project.slug, doc);
      setOpen(false);
    } catch (error) {
      const message = (error as Error).message;
      useStore.getState().setPublish(doc, { status: "failed", error: message });
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const schedule = async () => {
    if (!day || !guard()) return;
    const at = atLocalTime(day, time);
    if (at.getTime() <= Date.now()) {
      toast.error("현재보다 이후 시간을 선택하세요.");
      return;
    }
    setWorking(true);
    try {
      await window.api.publish.schedule(project.slug, doc, at.toISOString(), mode);
      useStore.getState().setPublish(doc, { status: "scheduled", scheduledAt: at.toISOString(), scheduleMode: mode });
      toast.success(`${PLATFORMS[doc].label} 게시를 예약했습니다.`);
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const cancel = async () => {
    setWorking(true);
    try {
      await window.api.publish.cancel(project.slug, doc);
      useStore.getState().setPublish(doc, { status: "draft" });
      toast.success("예약을 취소했습니다.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const quickPick = (kind: "today" | "tomorrow" | "monday") => {
    const next = new Date();
    if (kind === "tomorrow") next.setDate(next.getDate() + 1);
    if (kind === "monday") next.setDate(next.getDate() + (((8 - next.getDay()) % 7) || 7));
    setDay(next);
    setTime(kind === "today" ? "18:00" : "09:00");
  };

  return (
    <div ref={anchor}>
      <button className="btn btn-xs btn-primary" onClick={() => setOpen((value) => !value)} title={`${PLATFORMS[doc].label} 게시 및 예약`}>
        <Send size={11} /> 게시 <ChevronDown size={11} />
      </button>
      {open && (
        <Popover anchor={anchor} align="right" width={350} onClose={() => setOpen(false)} className="p-4 text-[12px]">
          <div className="mb-3 flex items-start gap-2 border-b border-[var(--border)] pb-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{statusText(publishState)}</div>
              {publishState?.status === "failed" && publishState.error && <div className="mt-1 break-words text-[var(--error)]">{publishState.error}</div>}
              {publishState?.url && (
                <button className="mt-1 inline-flex items-center gap-1 text-[var(--focus)]" onClick={() => window.api.openExternal(publishState.url!)}>
                  게시물 열기 <ExternalLink size={10} />
                </button>
              )}
            </div>
            <button className="icon-btn -mr-1 -mt-1 h-6 w-6" onClick={() => setOpen(false)} title="닫기"><XIcon size={12} /></button>
          </div>

          <button className="btn btn-sm btn-primary w-full justify-center" disabled={working || scheduled} onClick={() => void publishNow()}>
            {working ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} 지금 게시
          </button>
          {scheduled && (
            <button className="btn btn-sm mt-2 w-full justify-center" disabled={working} onClick={() => void cancel()}>
              예약 취소
            </button>
          )}

          <div className="my-3 flex items-center gap-2 text-[11px] font-medium text-[var(--muted)]">
            <CalendarDays size={12} /> 예약
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          <DayPicker
            mode="single"
            locale={ko}
            selected={day}
            onSelect={setDay}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            className="mx-auto text-[var(--fg)] [&_.rdp-day_button]:h-8 [&_.rdp-day_button]:w-8 [&_.rdp-nav_button]:text-[var(--fg)]"
            style={dayPickerStyle}
          />
          <div className="mt-2 flex items-center gap-2">
            <input className="input flex-1" type="time" step={300} value={time} onChange={(event) => setTime(event.target.value)} />
            <span className="shrink-0 text-[10.5px] text-[var(--muted)]" title="이 기기의 시간대">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <button className="btn btn-xs btn-ghost" onClick={() => quickPick("today")}>오늘 18:00</button>
            <button className="btn btn-xs btn-ghost" onClick={() => quickPick("tomorrow")}>내일 09:00</button>
            <button className="btn btn-xs btn-ghost" onClick={() => quickPick("monday")}>다음 월요일 09:00</button>
          </div>
          <p className="mt-3 flex gap-1.5 rounded-lg bg-[var(--surface-2)] p-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
            <CircleAlert size={13} className="mt-0.5 shrink-0" />
            {mode === "aside-native" ? "플랫폼 예약 기능으로 Aside가 등록" : "앱이 켜져 있을 때 그 시간에 Aside가 게시"}
          </p>
          <button className="btn btn-sm mt-3 w-full justify-center" disabled={working || !day || scheduled} onClick={() => void schedule()}>
            예약하기
          </button>
        </Popover>
      )}
    </div>
  );
}
