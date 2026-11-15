import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Globe, History, MessageCircle, MoreHorizontal, Reply, Send, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import { docLabel, parseDoc } from "@shared/platforms";
import { useStore } from "@/store";
import { PRESETS, type Preset } from "@/lib/prompts";
import { applyReply, publishAllComments, runCommentReply, runComments, runIntent } from "@/lib/dispatch";
import { grabLatestReply, grabSelection } from "@/lib/web-bridge";
import { Popover } from "./Popover";

const RECENT_KEY = "hmb_recent_intents";

export function readRecentIntents(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function rememberIntent(text: string): string[] {
  const value = text.trim();
  if (!value) return readRecentIntents();
  const next = [value, ...readRecentIntents().filter((item) => item !== value)].slice(0, 20);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

/** Less-frequent document actions, kept out of the writing surface. */
export function AdvancedMenu() {
  const project = useStore((s) => s.project)!;
  const settings = useStore((s) => s.settings)!;
  const activeDoc = useStore((s) => s.activeDoc);
  const autoSubmit = useStore((s) => s.autoSubmit);
  const autoEmbed = useStore((s) => s.autoEmbed);
  const dockTab = useStore((s) => s.dockTab);
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setRecent(readRecentIntents());
  }, [open]);

  const preset = (value: Preset) => {
    setOpen(false);
    void runIntent("", value, [activeDoc]);
  };
  const copy = () => {
    const state = useStore.getState();
    const text = state.proposals[activeDoc]?.proposed ?? project.docs[activeDoc] ?? "";
    window.api.clipboard.write(text);
    toast.success(`${docLabel(activeDoc)} 복사됨`);
    setOpen(false);
  };
  const grab = async (mode: "reply" | "selection") => {
    if (!dockTab.startsWith("web:")) {
      toast.error("웹 AI 탭을 먼저 선택하세요.");
      return;
    }
    try {
      const id = dockTab.slice(4);
      const text = mode === "reply" ? await grabLatestReply(id) : await grabSelection(id);
      if (!text) {
        toast.error(mode === "reply" ? "가져올 응답이 없습니다." : "웹에서 텍스트를 먼저 선택하세요.");
        return;
      }
      applyReply(text, { docs: [activeDoc], selection: useStore.getState().selections[activeDoc] ?? "" });
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const activePlatform = parseDoc(activeDoc).platform;

  return (
    <div ref={root} className="shrink-0">
      <button className="icon-btn" onClick={() => setOpen((value) => !value)} title={`${docLabel(activeDoc)} 추가 작업`} aria-expanded={open}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <Popover anchor={root} align="right" width={320} onClose={() => setOpen(false)} className="p-2 text-[12.5px]">
          <MenuSection title="빠른 다듬기">
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(PRESETS) as Preset[]).map((key) => (
                <button key={key} className="btn btn-xs justify-start" onClick={() => preset(key)}>
                  {PRESETS[key].label}
                </button>
              ))}
            </div>
          </MenuSection>

          <MenuSection title="댓글">
            <MenuButton
              onClick={() => {
                setOpen(false);
                void runComments();
              }}
            >
              <MessageCircle size={13} /> 모든 플랫폼 댓글 초안
            </MenuButton>
            <textarea
              className="input mb-1 h-16 w-full resize-none text-[12px]"
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="답할 댓글 붙여넣기"
            />
            <MenuButton
              onClick={() => {
                if (!replyText.trim()) {
                  toast.error("답할 댓글을 붙여넣으세요.");
                  return;
                }
                if (!activePlatform) {
                  toast.error("플랫폼 탭을 먼저 선택하세요.");
                  return;
                }
                setOpen(false);
                void runCommentReply(replyText, activePlatform);
                setReplyText("");
              }}
            >
              <Reply size={13} /> 답글 초안{activePlatform ? ` · ${docLabel(activeDoc).replace(" 댓글", "")}` : ""}
            </MenuButton>
            <MenuButton
              onClick={() => {
                setOpen(false);
                void publishAllComments();
              }}
            >
              <Send size={13} /> 모든 플랫폼에 댓글 달기
            </MenuButton>
          </MenuSection>

          <MenuSection title="브리프">
            <textarea
              key={project.slug}
              className="input h-20 w-full resize-none text-[12px]"
              placeholder="독자, 톤, 꼭 지킬 내용"
              defaultValue={project.meta.brief ?? ""}
              onBlur={(e) => useStore.getState().setBrief(e.target.value)}
            />
          </MenuSection>

          <MenuSection title="문서 작업">
            <label className="flex cursor-pointer items-center rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">
              <span className="flex-1">자동 전송</span>
              <input type="checkbox" checked={autoSubmit} onChange={(e) => useStore.setState({ autoSubmit: e.target.checked })} />
            </label>
            <label className="flex cursor-pointer items-center rounded-md px-2 py-1.5 hover:bg-[var(--surface-2)]">
              <span className="flex-1">웹 응답 자동 감지</span>
              <input type="checkbox" checked={autoEmbed} onChange={(e) => useStore.getState().setAutoEmbed(e.target.checked)} />
            </label>
            <MenuButton
              onClick={() => {
                useStore.setState({ historyDoc: activeDoc });
                setOpen(false);
              }}
            >
              <History size={13} /> 버전 기록
            </MenuButton>
            <MenuButton onClick={copy}>
              <Copy size={13} /> 복사
            </MenuButton>
            <MenuButton onClick={() => void grab("reply")}>
              <Download size={13} /> 응답 가져오기
            </MenuButton>
            <MenuButton onClick={() => void grab("selection")}>
              <Download size={13} /> 선택 가져오기
            </MenuButton>
          </MenuSection>

          {recent.length > 0 && (
            <MenuSection title="최근 의도">
              {recent.slice(0, 6).map((item) => (
                <MenuButton
                  key={item}
                  onClick={() => {
                    setOpen(false);
                    void runIntent(item, undefined, [activeDoc]);
                  }}
                >
                  <span className="truncate" title={item}>{item}</span>
                </MenuButton>
              ))}
            </MenuSection>
          )}

          <MenuSection title="보낼 AI">
            {settings.webTabs.map((tab) => {
              const id = `web:${tab.id}`;
              return (
                <MenuButton
                  key={tab.id}
                  onClick={() => {
                    useStore.setState({ dockTab: id, dockOpen: true });
                    setOpen(false);
                  }}
                >
                  <Globe size={13} /> <span className="flex-1 text-left">{tab.label}</span>
                  {dockTab === id && <Check size={12} />}
                </MenuButton>
              );
            })}
            {settings.harnesses.map((harness) => {
              const id = `harness:${harness.id}`;
              return (
                <MenuButton
                  key={harness.id}
                  onClick={() => {
                    useStore.setState({ dockTab: id, dockOpen: true });
                    setOpen(false);
                  }}
                >
                  <TerminalSquare size={13} /> <span className="flex-1 text-left">{harness.label}</span>
                  {dockTab === id && <Check size={12} />}
                </MenuButton>
              );
            })}
          </MenuSection>
        </Popover>
      )}
    </div>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--border)] px-1 py-2 last:border-0">
      <h3 className="mb-1 px-1 text-[10.5px] font-medium text-[var(--muted)]">{title}</h3>
      {children}
    </section>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--surface-2)]" onClick={onClick}>
      {children}
    </button>
  );
}
