import { useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, Globe, Loader2, Radio, TerminalSquare, X as XIcon } from "lucide-react";
import clsx from "clsx";
import type { DocId } from "@shared/types";
import { docLabel } from "@shared/platforms";
import { useStore } from "@/store";
import { PRESETS, type Preset } from "@/lib/prompts";
import { cancelPending, runIntent, runPropagate } from "@/lib/dispatch";
import { PlatformIcon } from "./PlatformIcon";

const CHIPS: Preset[] = ["humanize", "shorter", "hook", "casual", "professional", "translate-en", "translate-ko"];
const RECENT_KEY = "hmb_recent_intents";

function recent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * One place to say what you want. Pick the columns it applies to, type the intent
 * (or click a preset), and it goes to the active dock tab. Multi-column results come
 * back as one diff per column. "전파" pushes the source draft to every platform at once.
 */
export function IntentBar() {
  const project = useStore((s) => s.project)!;
  const settings = useStore((s) => s.settings)!;
  const scope = useStore((s) => s.scope);
  const dockTab = useStore((s) => s.dockTab);
  const pending = useStore((s) => s.pendingReply);
  const selections = useStore((s) => s.selections);
  const [text, setText] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(recent);
  const [histIdx, setHistIdx] = useState(-1);
  const input = useRef<HTMLTextAreaElement>(null);

  const docs: DocId[] = ["master", ...settings.platforms];
  const all = settings.platforms.every((p) => scope.includes(p));
  const selection = scope.length === 1 ? (selections[scope[0]] ?? "") : "";
  const [kind, id] = dockTab.split(":");
  const targetLabel =
    kind === "web" ? settings.webTabs.find((t) => t.id === id)?.label : kind === "harness" ? settings.harnesses.find((h) => h.id === id)?.label : undefined;

  const toggle = (d: DocId, solo: boolean) => {
    const next = solo ? [d] : scope.includes(d) ? scope.filter((x) => x !== d) : [...scope, d];
    useStore.setState({ scope: next.length ? next : [d] });
  };

  const submit = (preset?: Preset) => {
    const value = text.trim();
    if (!value && !preset) return;
    if (value) {
      const next = [value, ...history.filter((h) => h !== value)].slice(0, 20);
      setHistory(next);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    }
    setText("");
    setHistIdx(-1);
    void runIntent(value, preset);
  };

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)]">
      {briefOpen && (
        <div className="border-b border-[var(--border)] px-4 py-2">
          <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <span className="font-medium text-[var(--fg)]">글 브리프</span> 모든 요청 앞에 붙는 고정 의도 (독자, 톤, 꼭 지킬 것)
          </div>
          <textarea
            key={project.slug}
            className="input h-16 w-full resize-none"
            placeholder="예: 개발자 대상, 과장 없이, 숫자는 그대로, 반말 금지, 마지막에 GitHub 링크"
            defaultValue={project.meta.brief ?? ""}
            onBlur={(e) => useStore.getState().setBrief(e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 px-3 pt-2">
        <span className="mr-1 text-[11px] text-[var(--muted)]">적용 대상</span>
        {docs.map((d) => (
          <button
            key={d}
            className={clsx(
              "flex h-6 items-center gap-1 rounded-full border px-2 text-[11.5px] transition-colors",
              scope.includes(d) ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--fg)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]",
            )}
            onClick={(e) => toggle(d, !(e.metaKey || e.shiftKey))}
            title="클릭: 이 열만 · ⇧/⌘클릭: 추가/제외"
          >
            <PlatformIcon doc={d} size={11} />
            {docLabel(d)}
          </button>
        ))}
        <button
          className={clsx("h-6 rounded-full border px-2 text-[11.5px]", all ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]")}
          onClick={() => useStore.setState({ scope: all ? ["master"] : [...settings.platforms] })}
          title="모든 플랫폼에 같은 의도를 적용"
        >
          모든 플랫폼
        </button>
        {selection && <span className="ml-1 rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] text-[var(--accent)]">선택 {selection.length}자만</span>}
        <button className="btn btn-xs btn-ghost ml-auto" onClick={() => setBriefOpen(!briefOpen)} title="이 글의 고정 의도">
          브리프 {project.meta.brief ? "●" : ""} {briefOpen ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>

      <div className="flex items-end gap-2 px-3 pb-2 pt-1.5">
        <div className="relative flex-1">
          <textarea
            ref={input}
            data-intent-input
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              } else if (e.key === "ArrowUp" && !text && history.length) {
                e.preventDefault();
                const i = Math.min(histIdx + 1, history.length - 1);
                setHistIdx(i);
                setText(history[i]);
              } else if (e.key === "Escape") {
                setText("");
                input.current?.blur();
              }
            }}
            placeholder={`${scope.map(docLabel).join(" · ")}에 원하는 걸 말하세요 — 예: "첫 문장을 질문으로", "숫자 강조", "더 담백하게"   (⌘L 포커스 · ↑ 최근)`}
            className="input max-h-32 min-h-[38px] w-full resize-none py-2 pr-10 text-[13.5px] leading-5"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-white disabled:opacity-30"
            disabled={!text.trim()}
            onClick={() => submit()}
            title="보내기 (↵)"
          >
            <ArrowUp size={14} />
          </button>
        </div>
        <button className="btn h-[38px] gap-1.5 px-3" onClick={() => void runPropagate()} title="원문 → 모든 플랫폼에 한 번에 반영 (⌘↵)">
          <Radio size={14} /> 원문 전파
        </button>
      </div>

      <div className="flex items-center gap-1 px-3 pb-2">
        {CHIPS.map((p) => (
          <button key={p} className="btn btn-xs btn-ghost border border-[var(--border)]" onClick={() => submit(p)}>
            {PRESETS[p].label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
          {pending ? (
            <>
              <Loader2 size={11} className="animate-spin" /> {pending.docs.map(docLabel).join(" · ")} 응답 대기
              <button className="hover:text-[var(--fg)]" onClick={cancelPending} title="취소">
                <XIcon size={11} />
              </button>
            </>
          ) : (
            <>
              {kind === "harness" ? <TerminalSquare size={11} /> : <Globe size={11} />}
              {targetLabel ?? "도크 탭 선택"}(으)로 보냄
            </>
          )}
        </div>
      </div>
    </div>
  );
}
