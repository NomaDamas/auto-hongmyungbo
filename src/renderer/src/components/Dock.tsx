import { useEffect, useRef, useState } from "react";
import type { WebviewTag } from "electron";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Globe, Loader2, RotateCw, Send, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import type { HarnessConfig, SourceProject } from "@shared/types";
import { useStore } from "@/store";
import { grabLatestReply, grabSelection, pollNewWebReply, registerWebview, webControls } from "@/lib/web-bridge";
import { applyReply } from "@/lib/dispatch";
import { shellQuote } from "@/lib/term-bridge";
import { Terminal } from "./Terminal";
import { TabGroups, type DockTabDescriptor } from "./TabGroups";

function harnessCommand(harness: HarnessConfig, source: SourceProject | undefined): string {
  if (!source || !harness.addDirFlag) return harness.command;
  const flag = harness.addDirFlag;
  const argument = flag.endsWith("=") ? `${flag}${shellQuote(source.path)}` : `${flag} ${shellQuote(source.path)}`;
  return `${harness.command} ${argument}`;
}

/** All tab bodies stay mounted; only visibility changes, preserving web logins and pty sessions. */
export function Dock() {
  const settings = useStore((s) => s.settings)!;
  const project = useStore((s) => s.project);
  const dockTab = useStore((s) => s.dockTab);
  const runTabs = useStore((s) => s.runTabs);
  const pending = useStore((s) => s.pendingReply);
  const [startedHarness, setStartedHarness] = useState<Set<string>>(new Set());

  useEffect(() => {
    const [kind, id] = dockTab.split(":");
    if (kind !== "harness") return;
    setStartedHarness((started) => started.has(id) ? started : new Set(started).add(id));
  }, [dockTab]);

  const tabs: DockTabDescriptor[] = [
    ...settings.webTabs.map((tab) => ({
      id: `web:${tab.id}`,
      label: tab.label,
      kind: "web" as const,
      icon: <Globe size={13} />,
      busy: pending?.tabId === tab.id || pending?.tabId === `web:${tab.id}`,
    })),
    ...settings.harnesses.map((harness) => ({ id: `harness:${harness.id}`, label: harness.label, kind: "harness" as const, icon: <TerminalSquare size={13} /> })),
    ...runTabs.map((tab) => ({ id: `run:${tab.id}`, label: tab.label, kind: "run" as const, icon: <Send size={13} /> })),
  ];

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--surface-2)]">
      <TabGroups
        tabs={tabs}
        groups={settings.dockGroups}
        activeId={dockTab}
        onSelect={(id) => useStore.setState({ dockTab: id })}
        onGroupsChange={(dockGroups) => void useStore.getState().updateSettings({ dockGroups })}
        onClose={(id) => {
          const runId = id.slice(4);
          const rest = runTabs.filter((tab) => tab.id !== runId);
          useStore.setState({
            runTabs: rest,
            dockTab: dockTab === id ? tabs.find((tab) => tab.kind !== "run")?.id ?? "" : dockTab,
          });
        }}
        onOpenSettings={() => useStore.setState({ settingsOpen: true })}
      />

      <div className="relative min-h-0 flex-1">
        {settings.webTabs.map((tab) => (
          <div key={tab.id} className={clsx("absolute inset-0 flex flex-col", dockTab !== `web:${tab.id}` && "invisible")}>
            <WebPane id={tab.id} url={tab.url} label={tab.label} />
          </div>
        ))}
        {settings.harnesses.map((harness) => (
          <div key={harness.id} className={clsx("absolute inset-0", dockTab !== `harness:${harness.id}` && "invisible")}>
            {!project ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-[12px] text-[var(--muted)]">
                <TerminalSquare size={22} />
                <span>하네스를 실행하려면 먼저 홍보 프로젝트를 여세요.</span>
                <span className="text-[11px]">프로젝트 폴더가 터미널의 작업 디렉터리가 됩니다.</span>
              </div>
            ) : startedHarness.has(harness.id) ? (
              <Terminal
                ptyId={`harness:${harness.id}`}
                command={harnessCommand(harness, project.meta.source)}
                cwd={project.dir}
                visible={dockTab === `harness:${harness.id}`}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-[var(--muted)]">탭을 선택하면 {harness.label}을(를) 시작합니다.</div>
            )}
          </div>
        ))}
        {runTabs.map((tab) => (
          <div key={tab.id} className={clsx("absolute inset-0", dockTab !== `run:${tab.id}` && "invisible")}>
            <Terminal
              ptyId={`run:${tab.id}`}
              command={tab.command}
              cwd={project?.dir ?? settings.workspaceRoot}
              visible={dockTab === `run:${tab.id}`}
              onExit={(code) => {
                if (!tab.platform) return;
                if (code === 0) {
                  useStore.getState().setPublish(tab.platform, { status: "sent", at: new Date().toISOString() });
                  toast.success(`${tab.label}: Aside 작업 완료`);
                } else toast.error(`${tab.label}: Aside 종료 코드 ${code}`);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function WebPane({ id, url, label }: { id: string; url: string; label: string }) {
  const ref = useRef<WebviewTag | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(url);
  const activeDoc = useStore((s) => s.activeDoc);
  const autoEmbed = useStore((s) => s.autoEmbed);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    registerWebview(id, element);
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      setCurrent(element.getURL());
    };
    element.addEventListener("did-start-loading", onStart);
    element.addEventListener("did-stop-loading", onStop);
    return () => {
      element.removeEventListener("did-start-loading", onStart);
      element.removeEventListener("did-stop-loading", onStop);
      registerWebview(id, null);
    };
  }, [id]);

  useEffect(() => {
    if (!autoEmbed) return;
    let running = false;
    const poll = async () => {
      // Not hasFocus(): typing inside the webview moves focus into the guest, so the host reports unfocused.
      if (running || document.hidden) return;
      const state = useStore.getState();
      const pending = state.pendingReply;
      if (!state.project || (pending && (pending.tabId === id || pending.tabId === `web:${id}`))) return;
      running = true;
      try {
        const text = await pollNewWebReply(id);
        if (!text || !useStore.getState().project) return;
        useStore.setState((currentState) => ({
          embedInbox: [...currentState.embedInbox, { id: crypto.randomUUID(), tabId: id, label, text }],
        }));
      } catch {
        // A navigating/unloaded webview simply misses this poll.
      } finally {
        running = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => window.clearInterval(timer);
  }, [autoEmbed, id, label]);

  const pull = async (mode: "reply" | "selection") => {
    try {
      const text = mode === "reply" ? await grabLatestReply(id) : await grabSelection(id);
      if (!text) return toast.error(mode === "reply" ? "가져올 응답이 없습니다." : "웹에서 텍스트를 먼저 선택하세요.");
      const { pendingReply, selections } = useStore.getState();
      const target = pendingReply?.tabId === id || pendingReply?.tabId === `web:${id}` ? pendingReply : { docs: [activeDoc], selection: selections[activeDoc] ?? "" };
      useStore.setState({ pendingReply: null });
      applyReply(text, target);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 text-[12px]">
        <button className="icon-btn" onClick={() => webControls(id)?.goBack()} title="뒤로"><ArrowLeft size={13} /></button>
        <button className="icon-btn" onClick={() => webControls(id)?.goForward()} title="앞으로"><ArrowRight size={13} /></button>
        <button className="icon-btn" onClick={() => webControls(id)?.reload()} title="새로고침">{loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}</button>
        <span className="mx-1 min-w-0 flex-1 truncate text-[var(--muted)]">{current}</span>
        <button className="btn btn-xs btn-ghost" onClick={() => void pull("selection")} title="웹에서 선택한 텍스트를 현재 문서로">선택 가져오기</button>
        <button className="btn btn-xs btn-primary" onClick={() => void pull("reply")} title="마지막 AI 응답을 현재 문서에 diff로"><Download size={12} /> 응답 가져오기</button>
        <button className="icon-btn" onClick={() => window.api.openExternal(current)} title="브라우저에서 열기"><ExternalLink size={13} /></button>
      </div>
      <webview ref={ref as never} src={url} partition="persist:ai-web" allowpopups={"true" as never} className="min-h-0 flex-1" />
    </>
  );
}
