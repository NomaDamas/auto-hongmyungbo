import { useEffect } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { ChevronLeft, Command as CommandIcon, PanelRightClose, PanelRightOpen, Radio, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Toaster } from "sonner";
import clsx from "clsx";
import type { DocId } from "@shared/types";
import { useStore } from "@/store";
import { runPropagate } from "@/lib/dispatch";
import { resolveAll } from "@/components/DocEditor";
import { DocColumn } from "@/components/DocColumn";
import { Dock } from "@/components/Dock";
import { Home } from "@/components/Home";
import { PublishTray } from "@/components/PublishTray";
import { CommandPalette } from "@/components/CommandPalette";
import { HistoryPanel } from "@/components/HistoryPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { IntentBar } from "@/components/IntentBar";
import { ReviewBar } from "@/components/ReviewBar";
import { AsidePanel } from "@/components/AsidePanel";

export function App() {
  const settings = useStore((s) => s.settings);
  const project = useStore((s) => s.project);
  const dockOpen = useStore((s) => s.dockOpen);
  const soloDoc = useStore((s) => s.soloDoc);
  const autoSubmit = useStore((s) => s.autoSubmit);

  useEffect(() => {
    void useStore.getState().init();
  }, []);

  // Store is the source of truth for dock visibility (⌘J, palette, dispatch); mirror it onto the panel.
  const dockRef = usePanelRef();
  useEffect(() => {
    const panel = dockRef.current;
    if (!panel) return;
    if (dockOpen && panel.isCollapsed()) panel.expand();
    else if (!dockOpen && !panel.isCollapsed()) panel.collapse();
  }, [dockOpen]);
  const syncDock = (open: boolean) => {
    if (useStore.getState().dockOpen !== open) useStore.setState({ dockOpen: open });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const s = useStore.getState();
      const docs: DocId[] = ["master", ...(s.settings?.platforms ?? [])];
      if (e.key === "k") {
        e.preventDefault();
        useStore.setState({ paletteOpen: !s.paletteOpen });
      } else if (e.key === ",") {
        e.preventDefault();
        useStore.setState({ settingsOpen: true });
      } else if (e.key === "j") {
        e.preventDefault();
        useStore.setState({ dockOpen: !s.dockOpen });
      } else if (!s.project) {
        return;
      } else if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        resolveAll(s.focusDoc, "accept");
      } else if (e.key === "Backspace" && e.shiftKey) {
        e.preventDefault();
        resolveAll(s.focusDoc, "reject");
      } else if (e.key === "Enter" && !s.proposals[s.focusDoc]) {
        e.preventDefault();
        void runPropagate();
      } else if (e.key === "l") {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>("[data-intent-input]")?.focus();
      } else if (e.key === "0") {
        e.preventDefault();
        useStore.setState({ soloDoc: null });
      } else if (/^[1-9]$/.test(e.key) && docs[Number(e.key) - 1]) {
        e.preventDefault();
        const d = docs[Number(e.key) - 1];
        useStore.setState({ focusDoc: d, soloDoc: s.soloDoc === d ? null : d });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!settings) return null;
  const docs: DocId[] = soloDoc ? [soloDoc] : ["master", ...settings.platforms];

  return (
    <div className="flex h-screen flex-col">
      <header className="drag flex h-12 shrink-0 items-center gap-2 border-b border-[var(--border)] pl-[84px] pr-3">
        {project ? (
          <>
            <button className="no-drag icon-btn" onClick={() => useStore.getState().closeProject()} title="프로젝트 목록">
              <ChevronLeft size={15} />
            </button>
            <span className="truncate text-[13px] font-semibold">{project.meta.title}</span>
            <button className="no-drag btn btn-sm btn-primary ml-3" onClick={() => void runPropagate()} title="원문 → 모든 플랫폼에 한 번에 (⌘↵)">
              <Radio size={13} /> 원문 전파
            </button>
            <label className="no-drag ml-1 flex items-center gap-1.5 text-[12px] text-[var(--muted)]" title="끄면 프롬프트를 입력창에만 넣고 직접 전송합니다">
              <input type="checkbox" checked={autoSubmit} onChange={(e) => useStore.setState({ autoSubmit: e.target.checked })} />
              자동 전송
            </label>
            <div className="no-drag ml-auto flex items-center gap-2">
              <PublishTray />
            </div>
          </>
        ) : (
          <span className="text-[13px] font-semibold">Auto-HongMyungbo</span>
        )}
        <div className={`no-drag flex items-center gap-0.5 ${project ? "" : "ml-auto"}`}>
          <AsideButton />
          <button className="icon-btn" onClick={() => useStore.setState({ paletteOpen: true })} title="명령 (⌘K)">
            <CommandIcon size={14} />
          </button>
          <button className="icon-btn" onClick={() => useStore.setState({ settingsOpen: true })} title="설정 (⌘,)">
            <SettingsIcon size={14} />
          </button>
          <button className="icon-btn" onClick={() => useStore.setState({ dockOpen: !dockOpen })} title="AI 도크 (⌘J)">
            {dockOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>
      </header>

      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel id="main" minSize="35" defaultSize="62">
          {project ? (
            <div className="flex h-full flex-col">
              <ReviewBar />
              <Group orientation="horizontal" key={docs.join(",")} className="min-h-0 flex-1">
                {docs.map((d, i) => (
                  <WithSeparator key={d} index={i}>
                    <Panel id={d} minSize="12" defaultSize={d === "master" && docs.length > 1 ? "24" : undefined}>
                      <DocColumn doc={d} />
                    </Panel>
                  </WithSeparator>
                ))}
              </Group>
              <IntentBar />
            </div>
          ) : (
            <Home />
          )}
        </Panel>
        <Separator className={dockOpen ? "sep" : "hidden"} />
        {/* Collapsed, never unmounted: keeps web logins, chat state and terminal sessions alive. */}
        <Panel id="dock" panelRef={dockRef} collapsible collapsedSize="0" minSize="22" defaultSize="38" onResize={(size) => syncDock(size.asPercentage > 0)}>
          <Dock />
        </Panel>
      </Group>

      <CommandPalette />
      <HistoryPanel />
      <SettingsDialog />
      <AsidePanel />
      <Toaster theme={settings.theme} position="bottom-center" richColors closeButton />
    </div>
  );
}

function WithSeparator({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <>
      {index > 0 && <Separator className="sep" />}
      {children}
    </>
  );
}

/** Aside connection status at a glance; opens the connection hub. */
function AsideButton() {
  const aside = useStore((s) => s.aside);
  const logins = useStore((s) => s.asideLogins);
  const platforms = useStore((s) => s.settings?.platforms ?? []);
  const needLogin = platforms.filter((p) => logins[p] === "signed-out").length;
  const ok = aside?.installed && aside.signedIn;
  return (
    <button
      className={clsx("btn btn-xs mr-1 gap-1.5", !ok && "text-[var(--warning)]")}
      onClick={() => useStore.setState({ asideOpen: true })}
      title="Aside 연결 · 플랫폼 로그인 관리"
    >
      <ShieldCheck size={12} />
      Aside
      <span className={clsx("h-1.5 w-1.5 rounded-full", ok ? (needLogin ? "bg-[var(--warning)]" : "bg-[var(--success)]") : "bg-[var(--error)]")} />
      {needLogin > 0 && <span className="text-[var(--warning)]">로그인 {needLogin}</span>}
    </button>
  );
}
