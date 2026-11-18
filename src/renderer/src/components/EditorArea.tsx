import { useEffect, useRef, useState } from "react";
import {
  DockviewReact,
  themeDark,
  themeLight,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
  type SerializedDockview,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { TABS, commentDoc, platformsInTab, type TabId } from "@shared/platforms";
import { useStore } from "@/store";
import { DocPane } from "./DocPane";
import { ReviewBar } from "./ReviewBar";

const components = {
  doc: (props: IDockviewPanelProps) => <DocPane tab={props.params.tab as TabId} api={props.api} />,
};

/** Ask the mounted dockview to focus a tab without splitting or changing the layout. */
export function focusEditorTab(tab: TabId): void {
  window.dispatchEvent(new CustomEvent<TabId>("hmb:focus-tab", { detail: tab }));
}

export function EditorArea() {
  const project = useStore((s) => s.project)!;
  const enabled = useStore((s) => s.project?.meta.platforms ?? s.settings?.platforms ?? []);
  const theme = useStore((s) => s.settings?.theme ?? "light");
  const apiRef = useRef<DockviewApi | null>(null);
  const disposables = useRef<{ dispose: () => void }[]>([]);
  const visibleTabs = TABS.filter((tab) => tab.id === "master" || platformsInTab(tab.id, enabled).length > 0);
  const layoutKey = `${project.slug}:${visibleTabs.map((tab) => tab.id).join(",")}`;
  const [openPanels, setOpenPanels] = useState<TabId[]>(visibleTabs.map((tab) => tab.id));

  useEffect(() => {
    const onFocus = (event: Event) => {
      const tab = (event as CustomEvent<TabId>).detail;
      const panel = apiRef.current?.getPanel(tab);
      if (!panel) return;
      panel.api.setActive();
      panel.focus();
    };
    const onReopen = (event: Event) => {
      const tab = (event as CustomEvent<TabId>).detail;
      const api = apiRef.current;
      if (!api || api.getPanel(tab)) return;
      const label = TABS.find((item) => item.id === tab)?.label ?? tab;
      api.addPanel({ id: tab, component: "doc", title: label, params: { tab }, position: { referencePanel: "master", direction: "right" } });
      setOpenPanels(api.panels.map((panel) => panel.id as TabId));
    };
    window.addEventListener("hmb:focus-tab", onFocus);
    window.addEventListener("hmb:reopen-tab", onReopen);
    return () => {
      window.removeEventListener("hmb:focus-tab", onFocus);
      window.removeEventListener("hmb:reopen-tab", onReopen);
      disposables.current.forEach((disposable) => disposable.dispose());
      disposables.current = [];
      apiRef.current = null;
    };
  }, [layoutKey]);

  const onReady = ({ api }: DockviewReadyEvent) => {
    apiRef.current = api;
    disposables.current.forEach((disposable) => disposable.dispose());
    disposables.current = [];
    const ids = visibleTabs.map((tab) => tab.id);
    let restored = false;
    try {
      const saved = JSON.parse(localStorage.getItem(`hmb_layout_${project.slug}`) ?? "null") as SerializedDockview | null;
      if (saved && samePanels(Object.keys(saved.panels), ids)) {
        // Saved layouts must never reopen floating or browser-popout groups.
        delete saved.floatingGroups;
        delete saved.popoutGroups;
        api.fromJSON(saved);
        restored = true;
      }
    } catch {
      api.clear();
    }
    if (!restored) defaultLayout(api, visibleTabs.map((tab) => tab.id));

    const activate = (tab: TabId | undefined) => {
      if (!tab) return;
      if (tab === "master") {
        useStore.setState({ activeDoc: "master" });
        return;
      }
      const state = useStore.getState();
      const platforms = platformsInTab(tab, state.enabledPlatforms());
      const remembered = state.tabSelection[tab];
      const selected = remembered && platforms.includes(remembered) ? remembered : platforms[0];
      if (selected) useStore.setState({ activeDoc: state.mode === "comment" ? commentDoc(selected) : selected });
    };
    activate(api.activePanel?.id as TabId | undefined);
    setOpenPanels(api.panels.map((panel) => panel.id as TabId));
    disposables.current = [
      api.onDidActivePanelChange(({ panel }) => activate(panel?.id as TabId | undefined)),
      api.onDidLayoutChange(() => {
        setOpenPanels(api.panels.map((panel) => panel.id as TabId));
        try {
          localStorage.setItem(`hmb_layout_${project.slug}`, JSON.stringify(api.toJSON()));
        } catch {
          // A full or unavailable localStorage must not interrupt editing.
        }
      }),
    ];
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReviewBar />
      <DockviewReact
        key={layoutKey}
        className="hmb-dockview min-h-0 flex-1"
        components={components}
        theme={theme === "dark" ? themeDark : themeLight}
        disableFloatingGroups
        getTabContextMenuItems={() => []}
        onReady={onReady}
      />
    </div>
  );
}

function samePanels(actual: string[], expected: TabId[]): boolean {
  return actual.length === expected.length && expected.every((id) => actual.includes(id));
}

function defaultLayout(api: DockviewApi, tabs: TabId[]): void {
  api.addPanel({ id: "master", component: "doc", title: "원문", params: { tab: "master" } });
  const rest = tabs.filter((tab) => tab !== "master");
  rest.forEach((tab, index) => {
    const label = TABS.find((item) => item.id === tab)?.label ?? tab;
    api.addPanel({
      id: tab,
      component: "doc",
      title: label,
      params: { tab },
      inactive: index > 0,
      ...(index === 0 ? { position: { referencePanel: "master", direction: "right" as const } } : { position: { referencePanel: rest[0], direction: "within" as const } }),
    });
  });
  api.getPanel("master")?.api.setActive();
}
