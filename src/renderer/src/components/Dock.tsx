import { useEffect, useRef, useState } from "react";
import type { WebviewTag } from "electron";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Globe, Loader2, Plus, RotateCw, TerminalSquare, Send, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { useStore } from "@/store";
import { grabLatestReply, grabSelection, registerWebview, webControls } from "@/lib/web-bridge";
import { applyReply } from "@/lib/dispatch";
import { Terminal } from "./Terminal";

/**
 * Right-hand dock: embedded AI web chats (shared persistent login partition)
 * and harness terminals running in the project folder. Every tab stays mounted
 * so chat state and terminal sessions survive switching.
 */
export function Dock() {
  const settings = useStore((s) => s.settings)!;
  const project = useStore((s) => s.project);
  const dockTab = useStore((s) => s.dockTab);
  const runTabs = useStore((s) => s.runTabs);
  const pending = useStore((s) => s.pendingReply);
  const [startedHarness, setStartedHarness] = useState<Set<string>>(new Set());

  useEffect(() => {
    const [kind, id] = dockTab.split(":");
    if (kind === "harness" && !startedHarness.has(id)) setStartedHarness((s) => new Set(s).add(id));
  }, [dockTab]);

  const select = (id: string) => useStore.setState({ dockTab: id });

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--surface)]">
      <nav className="flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--border)] px-2">
        {settings.webTabs.map((t) => (
          <Tab key={t.id} active={dockTab === `web:${t.id}`} onClick={() => select(`web:${t.id}`)} icon={<Globe size={13} />}>
            {t.label}
            {pending?.tabId === t.id && <Loader2 size={11} className="animate-spin text-[var(--accent)]" />}
          </Tab>
        ))}
        {project && <span className="mx-1 h-4 w-px bg-[var(--border)]" />}
        {project && settings.harnesses.map((h) => (
          <Tab key={h.id} active={dockTab === `harness:${h.id}`} onClick={() => select(`harness:${h.id}`)} icon={<TerminalSquare size={13} />}>
            {h.label}
          </Tab>
        ))}
        {runTabs.map((r) => (
          <Tab
            key={r.id}
            active={dockTab === `run:${r.id}`}
            onClick={() => select(`run:${r.id}`)}
            icon={<Send size={13} />}
            onClose={() => {
              const rest = runTabs.filter((x) => x.id !== r.id);
              useStore.setState({ runTabs: rest, dockTab: dockTab === `run:${r.id}` ? `harness:${settings.harnesses[0]?.id}` : dockTab });
            }}
          >
            {r.label}
          </Tab>
        ))}
        <button className="icon-btn ml-auto shrink-0" title="탭 추가/편집 (설정)" onClick={() => useStore.setState({ settingsOpen: true })}>
          <Plus size={14} />
        </button>
      </nav>

      <div className="relative min-h-0 flex-1">
        {settings.webTabs.map((t) => (
          <div key={t.id} className={clsx("absolute inset-0 flex flex-col", dockTab !== `web:${t.id}` && "invisible")}>
            <WebPane id={t.id} url={t.url} />
          </div>
        ))}
        {project &&
          settings.harnesses.map((h) =>
          startedHarness.has(h.id) ? (
            <div key={h.id} className={clsx("absolute inset-0", dockTab !== `harness:${h.id}` && "invisible")}>
              <Terminal ptyId={`harness:${h.id}`} command={h.command} cwd={project.dir} visible={dockTab === `harness:${h.id}`} />
            </div>
          ) : null,
        )}
        {runTabs.map((r) => (
          <div key={r.id} className={clsx("absolute inset-0", dockTab !== `run:${r.id}` && "invisible")}>
            <Terminal
              ptyId={`run:${r.id}`}
              command={r.command}
              cwd={project!.dir}
              visible={dockTab === `run:${r.id}`}
              onExit={(code) => {
                if (!r.platform) return;
                if (code === 0) {
                  useStore.getState().setPublish(r.platform, { status: "sent", at: new Date().toISOString() });
                  toast.success(`${r.label}: Aside 작업 완료`, { description: "게시가 확인되면 트레이에서 '게시됨'으로 표시하세요." });
                } else toast.error(`${r.label}: Aside 종료 코드 ${code}`);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Tab(props: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode; onClose?: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={clsx(
        "group flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition-colors",
        props.active ? "bg-[var(--surface-3)] text-[var(--fg)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
      )}
    >
      {props.icon}
      {props.children}
      {props.onClose && (
        <XIcon
          size={11}
          className="opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            props.onClose!();
          }}
        />
      )}
    </button>
  );
}

function WebPane({ id, url }: { id: string; url: string }) {
  const ref = useRef<WebviewTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(url);
  const focusDoc = useStore((s) => s.focusDoc);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerWebview(id, el);
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      setCurrent(el.getURL());
    };
    el.addEventListener("did-start-loading", onStart);
    el.addEventListener("did-stop-loading", onStop);
    return () => {
      el.removeEventListener("did-start-loading", onStart);
      el.removeEventListener("did-stop-loading", onStop);
      registerWebview(id, null);
    };
  }, [id]);

  const pull = async (mode: "reply" | "selection") => {
    try {
      const text = mode === "reply" ? await grabLatestReply(id) : await grabSelection(id);
      if (!text) return toast.error(mode === "reply" ? "가져올 응답이 없습니다." : "웹에서 텍스트를 먼저 선택하세요.");
      // Pending multi-doc request → route by sections; otherwise drop into the focused column.
      const { pendingReply, selections } = useStore.getState();
      const target = pendingReply?.tabId === id ? pendingReply : { docs: [focusDoc], selection: selections[focusDoc] ?? "" };
      useStore.setState({ pendingReply: null });
      applyReply(text, target);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const wv = () => webControls(id);

  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 text-[12px]">
        <button className="icon-btn" onClick={() => wv()?.goBack()} title="뒤로">
          <ArrowLeft size={13} />
        </button>
        <button className="icon-btn" onClick={() => wv()?.goForward()} title="앞으로">
          <ArrowRight size={13} />
        </button>
        <button className="icon-btn" onClick={() => wv()?.reload()} title="새로고침">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
        </button>
        <span className="mx-1 min-w-0 flex-1 truncate text-[var(--muted)]">{current}</span>
        <button className="btn btn-xs btn-ghost" onClick={() => void pull("selection")} title="웹에서 선택한 텍스트를 현재 열로">
          선택 가져오기
        </button>
        <button className="btn btn-xs btn-primary" onClick={() => void pull("reply")} title="마지막 AI 응답을 현재 열에 diff로">
          <Download size={12} /> 응답 가져오기
        </button>
        <button className="icon-btn" onClick={() => window.api.openExternal(current)} title="브라우저에서 열기">
          <ExternalLink size={13} />
        </button>
      </div>
      <webview ref={ref as never} src={url} partition="persist:ai-web" allowpopups={"true" as never} className="min-h-0 flex-1" />
    </>
  );
}
