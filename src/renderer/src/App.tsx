import { useEffect } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { FilePlus2, Loader2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Radio } from "lucide-react";
import { Toaster } from "sonner";
import { TABS, parseDoc } from "@shared/platforms";
import { useStore } from "@/store";
import { runPropagate } from "@/lib/dispatch";
import { resolveAll } from "@/components/DocEditor";
import { Dock } from "@/components/Dock";
import { CommandPalette } from "@/components/CommandPalette";
import { HistoryPanel } from "@/components/HistoryPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { IntentBar } from "@/components/IntentBar";
import { AsidePanel } from "@/components/AsidePanel";
import { PreviewModal } from "@/components/PreviewModal";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Sidebar } from "@/components/Sidebar";
import { EditorArea, focusEditorTab } from "@/components/EditorArea";
import { EmbedInbox } from "@/components/EmbedInbox";
import { InsightsBoard } from "@/components/InsightsBoard";
import { UnifiedChat } from "@/components/UnifiedChat";

export function App() {
  const settings = useStore((s) => s.settings);
  const project = useStore((s) => s.project);
  const dockOpen = useStore((s) => s.dockOpen);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const mode = useStore((s) => s.mode);

  useEffect(() => {
    void useStore.getState().init();
  }, []);

  // Collapse only the dock's layout panel; its webviews and terminals stay mounted.
  const dockRef = usePanelRef();
  useEffect(() => {
    const panel = dockRef.current;
    if (!panel) return;
    if (dockOpen && panel.isCollapsed()) panel.expand();
    else if (!dockOpen && !panel.isCollapsed()) panel.collapse();
  }, [dockOpen, dockRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const key = e.key.toLowerCase();
      const s = useStore.getState();
      if (e.shiftKey && /^Digit[1-3]$/.test(e.code)) {
        e.preventDefault();
        s.setMode((["post", "comment", "insights"] as const)[Number(e.code.slice(-1)) - 1]);
        return;
      }
      if (key === "k") {
        e.preventDefault();
        useStore.setState({ paletteOpen: !s.paletteOpen });
      } else if (key === "b") {
        e.preventDefault();
        useStore.setState({ sidebarOpen: !s.sidebarOpen });
      } else if (key === "j") {
        e.preventDefault();
        useStore.setState({ dockOpen: !s.dockOpen });
      } else if (key === "p") {
        e.preventDefault();
        const platform = parseDoc(s.activeDoc).platform;
        if (platform) useStore.setState({ previewDoc: platform });
      } else if (key === ",") {
        e.preventDefault();
        useStore.setState({ settingsOpen: true });
      } else if (!s.project) {
        return;
      } else if (key === "enter" && e.shiftKey) {
        e.preventDefault();
        resolveAll(s.activeDoc, "accept");
      } else if (key === "backspace" && e.shiftKey) {
        e.preventDefault();
        resolveAll(s.activeDoc, "reject");
      } else if (key === "enter") {
        e.preventDefault();
        void runPropagate();
      } else if (key === "l") {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>("[data-intent-input]")?.focus();
      } else if (/^[1-4]$/.test(key)) {
        e.preventDefault();
        focusEditorTab(TABS[Number(key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!settings) return null;
  return (
    <div className="flex h-screen flex-col">
      <header className="drag relative flex h-12 shrink-0 items-center gap-2 pl-[84px] pr-3">
        <button className="no-drag icon-btn" onClick={() => useStore.setState({ sidebarOpen: !sidebarOpen })} title="사이드바 (⌘B)">
          {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        </button>
        <span className="max-w-[320px] truncate text-[13px] font-medium">{project?.meta.title ?? "Auto-HongMyungbo"}</span>
        {project && <ModeSwitch />}
        {project && mode !== "insights" && (
          <button className="no-drag btn btn-sm btn-primary ml-2" onClick={() => void runPropagate()} title="원문 → 모든 플랫폼 (⌘↵)">
            <Radio size={13} /> 원문 전파
          </button>
        )}
        <DockToggle />
      </header>

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar />}
        <Group orientation="horizontal" className="min-h-0 min-w-0 flex-1">
          <Panel id="editor" minSize="35" defaultSize="64">
            {project ? (
              <div className="flex h-full min-w-0 flex-col">
                {mode === "insights" ? (
                  <InsightsBoard />
                ) : (
                  <>
                    <EditorArea />
                    <EmbedInbox />
                    <IntentBar />
                  </>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="text-[13px] text-[var(--muted)]">왼쪽에서 글을 고르거나 새 글을 만드세요</p>
                <button className="btn btn-primary" onClick={() => void useStore.getState().createProject("새 글", "")}>
                  <FilePlus2 size={14} /> 새 글
                </button>
              </div>
            )}
          </Panel>
          <Separator className={dockOpen ? "sep-ghost" : "hidden"} />
        <Panel
            id="dock"
            panelRef={dockRef}
            collapsible
            collapsedSize="0"
            minSize="22"
            defaultSize="36"
            onResize={(size) => {
              const open = size.asPercentage > 0;
              if (useStore.getState().dockOpen !== open) useStore.setState({ dockOpen: open });
            }}
          >
            <div className="relative flex h-full min-h-0 flex-col p-1 pl-0">
              <div className="min-h-0 flex-1 overflow-hidden rounded-[12px] border border-[var(--border)]">
                <UnifiedChat />
              </div>
              {/* Web and CLI panes are execution surfaces, not user-facing workspace panes. */}
              <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-0 h-px w-px overflow-hidden opacity-0">
                <Dock />
              </div>
            </div>
          </Panel>
        </Group>
      </div>

      <CommandPalette />
      <HistoryPanel />
      <SettingsDialog />
      <AsidePanel />
      <PreviewModal />
      <OnboardingWizard />
      <Toaster theme={settings.theme} position="bottom-center" richColors closeButton />
    </div>
  );
}

function ModeSwitch() {
  const mode = useStore((s) => s.mode);
  const modes = [
    ["post", "글", "⌘⇧1"],
    ["comment", "댓글", "⌘⇧2"],
    ["insights", "인사이트", "⌘⇧3"],
  ] as const;
  return (
    <div className="no-drag absolute left-1/2 flex -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-0.5" aria-label="작업 모드">
      {modes.map(([value, label, shortcut]) => (
        <button
          key={value}
          className={`h-6 rounded-full px-3 text-[11.5px] ${mode === value ? "bg-[var(--surface-3)] font-medium text-[var(--fg)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}`}
          onClick={() => useStore.getState().setMode(value)}
          title={`${label} 모드 (${shortcut})`}
          aria-pressed={mode === value}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DockToggle() {
  const settings = useStore((s) => s.settings)!;
  const dockOpen = useStore((s) => s.dockOpen);
  const dockTab = useStore((s) => s.dockTab);
  const pending = useStore((s) => s.pendingReply);
  const runTabs = useStore((s) => s.runTabs);
  const [kind, id] = dockTab.split(":");
  const label =
    kind === "web"
      ? settings.webTabs.find((tab) => tab.id === id)?.label
      : kind === "harness"
        ? settings.harnesses.find((harness) => harness.id === id)?.label
        : runTabs.find((tab) => tab.id === dockTab)?.label;
  return (
    <button className="no-drag btn btn-xs ml-auto max-w-44" onClick={() => useStore.setState({ dockOpen: !dockOpen })} title="AI 도크 (⌘J)">
      {dockOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
      <span className="truncate">{label ?? "AI 도크"}</span>
      {pending && <Loader2 size={11} className="animate-spin" />}
    </button>
  );
}
