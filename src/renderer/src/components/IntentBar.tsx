import { useRef, useState } from "react";
import { ArrowUp, Loader2, Radio } from "lucide-react";
import { docLabel } from "@shared/platforms";
import { useStore } from "@/store";
import { runIntent, runPropagate } from "@/lib/dispatch";
import { readRecentIntents, rememberIntent } from "./AdvancedMenu";

/** Say what you want; the focused editor is always the target. */
export function IntentBar() {
  const settings = useStore((s) => s.settings)!;
  const activeDoc = useStore((s) => s.activeDoc);
  const dockTab = useStore((s) => s.dockTab);
  const runTabs = useStore((s) => s.runTabs);
  const pending = useStore((s) => s.pendingReply);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<string[]>(readRecentIntents);
  const [histIdx, setHistIdx] = useState(-1);
  const input = useRef<HTMLTextAreaElement>(null);

  const [kind, id] = dockTab.split(":");
  const targetLabel =
    kind === "web"
      ? settings.webTabs.find((tab) => tab.id === id)?.label
      : kind === "harness"
        ? settings.harnesses.find((harness) => harness.id === id)?.label
        : runTabs.find((tab) => tab.id === dockTab)?.label;

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setHistory(rememberIntent(value));
    setText("");
    setHistIdx(-1);
    void runIntent(value, undefined, [activeDoc]);
  };

  return (
    <div className="mx-2 mb-2 mt-1 shrink-0 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2">
      <div className="flex items-end gap-2">
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
                const index = Math.min(histIdx + 1, history.length - 1);
                setHistIdx(index);
                setText(history[index]);
              } else if (e.key === "Escape") {
                setText("");
                input.current?.blur();
              }
            }}
            placeholder={`→ ${docLabel(activeDoc)}에 원하는 걸 말하세요`}
            className="input max-h-32 min-h-[38px] w-full resize-none py-2 pr-10 text-[13.5px] leading-5"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] disabled:opacity-30"
            disabled={!text.trim()}
            onClick={submit}
            title="보내기 (↵)"
          >
            <ArrowUp size={14} />
          </button>
        </div>
        <button className="btn h-[38px] gap-1.5 px-3" onClick={() => void runPropagate()} title="원문 → 모든 플랫폼 (⌘↵)">
          <Radio size={14} /> 원문 전파
        </button>
      </div>
      <div className="flex min-h-4 items-center justify-end gap-1 px-1 pt-1 text-[10.5px] text-[var(--muted)]">
        {pending && <Loader2 size={10} className="animate-spin" />}
        <span>{pending ? `${pending.docs.map(docLabel).join(" · ")} 응답 대기` : `${targetLabel ?? "AI"}로 보냄`}</span>
      </div>
    </div>
  );
}
