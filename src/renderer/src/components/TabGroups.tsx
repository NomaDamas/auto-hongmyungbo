import { useEffect, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";
import { Loader2, Plus, X as XIcon } from "lucide-react";
import clsx from "clsx";
import type { DockGroup, GroupColor } from "@shared/types";

export interface DockTabDescriptor {
  id: string;
  label: string;
  kind: "web" | "harness" | "run";
  icon: ReactNode;
  busy?: boolean;
}

interface Props {
  tabs: DockTabDescriptor[];
  groups: DockGroup[];
  activeId: string;
  onSelect: (id: string) => void;
  onGroupsChange: (groups: DockGroup[]) => void;
  onClose: (id: string) => void;
  onOpenSettings: () => void;
}

type MenuState = { kind: "group" | "tab"; id: string; x: number; y: number };

const COLORS: Record<GroupColor, string> = {
  grey: "#a1a1aa",
  blue: "#60a5fa",
  red: "#f87171",
  yellow: "#facc15",
  green: "#4ade80",
  pink: "#f472b6",
  purple: "#c084fc",
  cyan: "#22d3ee",
  orange: "#fb923c",
};

export function TabGroups({ tabs, groups, activeId, onSelect, onGroupsChange, onClose, onOpenSettings }: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [rename, setRename] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const groupable = tabs.filter((tab) => tab.kind !== "run");
  const grouped = new Set(groups.flatMap((group) => group.tabIds));
  const ungrouped = groupable.filter((tab) => !grouped.has(tab.id));
  const runs = tabs.filter((tab) => tab.kind === "run");

  const openMenu = (event: MouseEvent, state: Omit<MenuState, "x" | "y">) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ ...state, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 224)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 280)) });
    if (state.kind === "group") setRename(groups.find((group) => group.id === state.id)?.title ?? "");
  };

  const removeFromGroups = (tabId: string) => groups.map((group) => ({ ...group, tabIds: group.tabIds.filter((id) => id !== tabId) })).filter((group) => group.tabIds.length > 0);
  const removeTab = (tabId: string) => onGroupsChange(removeFromGroups(tabId));
  const moveToGroup = (tabId: string, groupId: string, requestedIndex?: number) => {
    const source = groups.find((group) => group.tabIds.includes(tabId));
    if (source?.id === groupId && source.tabIds.length === 1) return;
    let index = requestedIndex;
    if (source?.id === groupId && index !== undefined && source.tabIds.indexOf(tabId) < index) index--;
    const next = removeFromGroups(tabId).map((group) => {
      if (group.id !== groupId) return group;
      const tabIds = [...group.tabIds];
      tabIds.splice(Math.max(0, Math.min(index ?? tabIds.length, tabIds.length)), 0, tabId);
      return { ...group, tabIds };
    });
    onGroupsChange(next);
  };
  const newGroup = (tabId: string) => {
    onGroupsChange([...removeFromGroups(tabId), { id: crypto.randomUUID(), title: "새 그룹", color: "grey", collapsed: false, tabIds: [tabId] }]);
  };
  const visibleIds = (nextGroups: DockGroup[]) => {
    const inGroups = new Set(nextGroups.flatMap((group) => group.tabIds));
    return [
      ...nextGroups.flatMap((group) => group.collapsed ? [] : group.tabIds),
      ...groupable.filter((tab) => !inGroups.has(tab.id)).map((tab) => tab.id),
      ...runs.map((tab) => tab.id),
    ];
  };
  const collapse = (groupId: string) => {
    const next = groups.map((group) => group.id === groupId ? { ...group, collapsed: !group.collapsed } : group);
    onGroupsChange(next);
    const group = next.find((item) => item.id === groupId);
    if (group?.collapsed && group.tabIds.includes(activeId)) {
      const replacement = visibleIds(next).find((id) => id !== activeId && tabs.some((tab) => tab.id === id));
      if (replacement) onSelect(replacement);
    }
  };
  const finishDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };
  const drop = (event: DragEvent, action: (tabId: string) => void, target: string) => {
    event.preventDefault();
    event.stopPropagation();
    const tabId = event.dataTransfer.getData("application/x-hong-dock-tab") || dragging;
    if (tabId && tabs.find((tab) => tab.id === tabId)?.kind !== "run") action(tabId);
    finishDrag();
  };

  const renderTab = (tab: DockTabDescriptor, color?: GroupColor, group?: DockGroup) => (
    <button
      key={tab.id}
      draggable={tab.kind !== "run"}
      className={clsx(
        "group relative flex h-8 max-w-44 shrink-0 items-center gap-1.5 rounded-t-md px-2.5 text-[11.5px]",
        activeId === tab.id ? "bg-[var(--surface-3)] text-[var(--fg)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]",
        dropTarget === `tab:${tab.id}` && "bg-[var(--surface-3)]",
      )}
      style={color ? { boxShadow: `inset 0 -2px 0 ${COLORS[color]}` } : undefined}
      onClick={() => onSelect(tab.id)}
      onContextMenu={(event) => tab.kind !== "run" && openMenu(event, { kind: "tab", id: tab.id })}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-hong-dock-tab", tab.id);
        setDragging(tab.id);
      }}
      onDragEnd={finishDrag}
      onDragOver={(event) => {
        if (!dragging || tab.kind === "run") return;
        event.preventDefault();
        setDropTarget(`tab:${tab.id}`);
      }}
      onDrop={(event) => drop(event, (tabId) => {
        if (!group) {
          removeTab(tabId);
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const before = event.clientX < rect.left + rect.width / 2;
        const targetIndex = group.tabIds.indexOf(tab.id);
        moveToGroup(tabId, group.id, targetIndex + (before ? 0 : 1));
      }, `tab:${tab.id}`)}
    >
      {tab.icon}
      <span className="min-w-0 truncate">{tab.label}</span>
      {tab.busy && <Loader2 size={11} className="shrink-0 animate-spin text-[var(--accent)]" />}
      {tab.kind === "run" && (
        <XIcon size={11} className="shrink-0 opacity-0 group-hover:opacity-100" onClick={(event) => { event.stopPropagation(); onClose(tab.id); }} />
      )}
    </button>
  );

  return (
    <>
      <nav
        className="flex h-11 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-[var(--border)] px-2 pt-1"
        onDragOver={(event) => { if (dragging) event.preventDefault(); }}
        onDrop={(event) => drop(event, removeTab, "outside")}
      >
        {groups.map((group) => {
          const groupTabs = group.tabIds.map((id) => groupable.find((tab) => tab.id === id)).filter((tab): tab is DockTabDescriptor => Boolean(tab));
          if (groupTabs.length === 0) return null;
          return (
            <div key={group.id} className="flex shrink-0 items-end gap-0.5">
              <button
                className={clsx("mb-1 flex h-7 max-w-36 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium", dropTarget === `group:${group.id}` && "ring-1 ring-[var(--focus)]")}
                style={{ color: COLORS[group.color], backgroundColor: `color-mix(in srgb, ${COLORS[group.color]} 14%, transparent)`, borderColor: `color-mix(in srgb, ${COLORS[group.color]} 35%, transparent)` }}
                onClick={() => collapse(group.id)}
                onContextMenu={(event) => openMenu(event, { kind: "group", id: group.id })}
                onDragOver={(event) => { if (dragging) { event.preventDefault(); setDropTarget(`group:${group.id}`); } }}
                onDrop={(event) => drop(event, (tabId) => moveToGroup(tabId, group.id), `group:${group.id}`)}
                title={`${group.title} · ${group.collapsed ? "펼치기" : "접기"}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[group.color] }} />
                <span className="truncate">{group.title}</span>
                {group.collapsed && <span className="opacity-70">{groupTabs.length}</span>}
              </button>
              {!group.collapsed && groupTabs.map((tab) => renderTab(tab, group.color, group))}
            </div>
          );
        })}
        {ungrouped.map((tab) => renderTab(tab))}
        {runs.map((tab) => renderTab(tab))}
        <button className="icon-btn mb-1 ml-auto shrink-0" title="탭 추가/편집 (설정)" onClick={onOpenSettings}><Plus size={14} /></button>
      </nav>

      {menu && (
        <div
          className="glass fixed z-[70] w-52 p-1.5 text-[12px]"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menu.kind === "group" ? (
            <>
              <input
                className="input mb-1 w-full py-1 text-[12px]"
                value={rename}
                autoFocus
                onChange={(event) => setRename(event.target.value)}
                onBlur={() => {
                  const title = rename.trim();
                  if (title) onGroupsChange(groups.map((group) => group.id === menu.id ? { ...group, title } : group));
                }}
                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              />
              <div className="grid grid-cols-9 gap-1 px-1 py-2">
                {(Object.keys(COLORS) as GroupColor[]).map((color) => (
                  <button key={color} className="h-4 w-4 rounded-full hover:scale-110" style={{ backgroundColor: COLORS[color] }} title={color} onClick={() => onGroupsChange(groups.map((group) => group.id === menu.id ? { ...group, color } : group))} />
                ))}
              </div>
              <button className="flex w-full rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-3)]" onClick={() => { onGroupsChange(groups.filter((group) => group.id !== menu.id)); setMenu(null); }}>그룹 해제</button>
              <button className="flex w-full rounded-md px-2.5 py-1.5 text-left text-[var(--error)] hover:bg-[var(--surface-3)]" onClick={() => { onGroupsChange(groups.filter((group) => group.id !== menu.id)); setMenu(null); }}>그룹 닫기</button>
            </>
          ) : (
            <>
              <button className="flex w-full rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-3)]" onClick={() => { newGroup(menu.id); setMenu(null); }}>새 그룹에 추가</button>
              {groups.some((group) => group.tabIds.includes(menu.id)) && <button className="flex w-full rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-3)]" onClick={() => { removeTab(menu.id); setMenu(null); }}>그룹에서 제거</button>}
              {groups.filter((group) => !group.tabIds.includes(menu.id)).map((group) => (
                <button key={group.id} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-[var(--surface-3)]" onClick={() => { moveToGroup(menu.id, group.id); setMenu(null); }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[group.color] }} /> {group.title} 그룹으로 이동
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
