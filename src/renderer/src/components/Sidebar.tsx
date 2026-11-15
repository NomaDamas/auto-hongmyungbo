import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FilePlus2, Folder, FolderPlus, MoreHorizontal, Plus, Settings, ShieldCheck, Wand2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import type { ProjectSummary } from "@shared/types";
import { useStore, type SidebarInput } from "@/store";

interface FolderNode {
  path: string;
  name: string;
  children: FolderNode[];
}

interface FolderMenu {
  path: string;
  x: number;
  y: number;
  depth: number;
}

const INPUT_LABEL: Record<SidebarInput["kind"], (where: string) => string> = {
  post: (where) => `${where}에 새 글`,
  folder: (where) => (where === "미분류" ? "새 폴더" : `${where} 안에 새 폴더`),
  rename: (where) => `${where} 이름 변경`,
};

export function Sidebar() {
  const projects = useStore((s) => s.projects);
  const folders = useStore((s) => s.folders);
  const current = useStore((s) => s.project);
  const proposals = useStore((s) => s.proposals);
  const aside = useStore((s) => s.aside);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const input = useStore((s) => s.sidebarInput);
  const setInput = (next: SidebarInput | null) => useStore.setState({ sidebarInput: next });
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<FolderMenu | null>(null);
  const [dropFolder, setDropFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  const tree = useMemo(() => makeTree(folders, projects), [folders, projects]);
  const byFolder = useMemo(() => {
    const grouped = new Map<string, ProjectSummary[]>();
    for (const project of projects) {
      const list = grouped.get(project.folder) ?? [];
      list.push(project);
      grouped.set(project.folder, list);
    }
    for (const list of grouped.values()) list.sort((a, b) => b.updatedAt - a.updatedAt);
    return grouped;
  }, [projects]);

  const openInput = (next: SidebarInput, initial = "") => {
    setTitle(initial);
    setInput(next);
  };

  /** One inline form for new post / new folder / rename (window.prompt is unsupported in Electron). */
  const submitInput = async () => {
    if (creating || !input) return;
    const name = title.trim();
    const { kind, path } = input;
    if (kind !== "post" && !name) return;
    setCreating(true);
    try {
      const store = useStore.getState();
      if (kind === "post") {
        await store.createProject(name || "새 글", path);
      } else if (kind === "folder") {
        await store.createFolder(path ? `${path}/${name}` : name);
        if (path) setCollapsed((old) => without(old, path));
      } else if (name !== path.split("/").at(-1)) {
        const parent = path.split("/").slice(0, -1).join("/");
        const to = parent ? `${parent}/${name}` : name;
        await window.api.projects.renameFolder(path, to);
        const open = store.project;
        await Promise.all([store.refreshProjects(), store.refreshFolders()]);
        if (open && (open.slug === path || open.slug.startsWith(`${path}/`))) await store.openProject(`${to}${open.slug.slice(path.length)}`);
      }
      setTitle("");
      setInput(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const move = async (event: React.DragEvent, folder: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDropFolder(null);
    const slug = event.dataTransfer.getData("application/x-hmb-project") || event.dataTransfer.getData("text/plain");
    if (!slug) return;
    try {
      await useStore.getState().moveProject(slug, folder);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const projectRow = (item: ProjectSummary, depth: number) => {
    const active = current?.slug === item.slug;
    const pending = active && Object.keys(proposals).length > 0;
    const scheduled = !!item.nextScheduledAt;
    const posted = item.postedCount > 0;
    const color = pending ? "var(--warning)" : scheduled ? "var(--focus)" : posted ? "var(--success)" : "var(--muted)";
    return (
      <button
        key={item.slug}
        draggable
        className={clsx("group flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[12.5px]", active ? "bg-[var(--surface-3)] text-[var(--fg)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]")}
        style={{ paddingLeft: `${30 + depth * 14}px` }}
        onClick={() => void useStore.getState().openProject(item.slug)}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-hmb-project", item.slug);
          e.dataTransfer.setData("text/plain", item.slug);
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        {item.nextScheduledAt && <span className="shrink-0 text-[9.5px] text-[var(--focus)]">{shortTime(item.nextScheduledAt)}</span>}
      </button>
    );
  };

  const folderBlock = (node: FolderNode, depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(node.path);
    const items = byFolder.get(node.path) ?? [];
    return (
      <div key={node.path || "root"}>
        <div
          className={clsx("group flex h-7 items-center gap-1 rounded-md pr-1 text-[12px]", dropFolder === node.path && "bg-[color-mix(in_srgb,var(--focus)_15%,transparent)]")}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ path: node.path, x: e.clientX, y: e.clientY, depth });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            setDropFolder(node.path);
          }}
          onDragLeave={() => setDropFolder((old) => (old === node.path ? null : old))}
          onDrop={(e) => void move(e, node.path)}
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-1 text-left text-[var(--muted)] hover:text-[var(--fg)]"
            onClick={() => setCollapsed((old) => (old.has(node.path) ? without(old, node.path) : new Set(old).add(node.path)))}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <Folder size={12} />
            <span className="truncate">{node.name}</span>
            <span className="text-[10px] opacity-50">{items.length || ""}</span>
          </button>
          <button
            className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100"
            title="이 폴더에 새 글"
            onClick={() => {
              openInput({ kind: "post", path: node.path });
              setCollapsed((old) => without(old, node.path));
            }}
          >
            <Plus size={12} />
          </button>
          {node.path && (
            <button className="icon-btn h-5 w-5 opacity-0 group-hover:opacity-100" title="폴더 메뉴" onClick={(e) => setMenu({ path: node.path, x: e.clientX, y: e.clientY, depth })}>
              <MoreHorizontal size={12} />
            </button>
          )}
        </div>
        {!isCollapsed && (
          <>
            {items.map((item) => projectRow(item, depth))}
            {node.children.map((child) => folderBlock(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-2)]">
      <header className="flex h-11 shrink-0 items-center gap-1 px-3">
        <span className="text-[12px] font-semibold">홍보</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button className="btn btn-xs btn-ghost" onClick={() => openInput({ kind: "folder", path: "" })}>
            <FolderPlus size={12} /> 폴더
          </button>
          <button className="btn btn-xs btn-ghost" onClick={() => openInput({ kind: "post", path: "" })}>
            <FilePlus2 size={12} /> 새 글
          </button>
        </div>
      </header>

      {input && (
        <form
          className="mx-2 mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitInput();
          }}
        >
          <div className="mb-1 text-[10px] text-[var(--muted)]">{INPUT_LABEL[input.kind](input.path || "미분류")}</div>
          <div className="flex gap-1">
            <input
              autoFocus
              className="input min-w-0 flex-1 rounded-md px-2 py-1 text-[12px]"
              placeholder={input.kind === "post" ? "글 제목" : "폴더 이름"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setInput(null)}
            />
            <button className="icon-btn bg-[var(--surface-3)]" disabled={creating} title="확인">
              <Plus size={13} />
            </button>
          </div>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        {folderBlock(tree, 0)}
        {projects.length === 0 && <p className="px-3 py-6 text-center text-[11.5px] leading-relaxed text-[var(--muted)]">아직 글이 없습니다.<br />위의 ‘새 글’로 시작하세요.</p>}
      </div>

      <footer className="shrink-0 border-t border-[var(--border)] p-2">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--surface-3)]" onClick={() => useStore.setState({ asideOpen: true })}>
          <span className={clsx("h-1.5 w-1.5 rounded-full", aside?.installed && aside.signedIn ? "bg-[var(--success)]" : "bg-[var(--error)]")} />
          <ShieldCheck size={13} /> Aside
          <span className="ml-auto text-[10px] text-[var(--muted)]">{aside?.signedIn ? "연결됨" : "연결 필요"}</span>
        </button>
        <div className="mt-1 flex items-center">
          <button className="btn btn-xs btn-ghost" onClick={() => useStore.setState({ setupOpen: true })}>
            <Wand2 size={12} /> 설정 마법사
          </button>
          <button className="icon-btn ml-auto" title="설정" onClick={() => useStore.setState({ settingsOpen: true })}>
            <Settings size={14} />
          </button>
        </div>
      </footer>

      {menu && (
        <div className="glass fixed z-[70] w-44 p-1 text-[12px]" style={{ left: menu.x, top: menu.y }} onPointerDown={(e) => e.stopPropagation()}>
          {menu.depth < 2 && (
            <button className="w-full rounded-md px-3 py-2 text-left hover:bg-[var(--surface-2)]" onClick={() => { setMenu(null); openInput({ kind: "folder", path: menu.path }); }}>
              새 하위 폴더
            </button>
          )}
          {menu.path && (
            <button className="w-full rounded-md px-3 py-2 text-left hover:bg-[var(--surface-2)]" onClick={() => { setMenu(null); openInput({ kind: "rename", path: menu.path }, menu.path.split("/").at(-1) ?? ""); }}>
              이름 변경
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

function makeTree(folders: string[], projects: ProjectSummary[]): FolderNode {
  const root: FolderNode = { path: "", name: "미분류", children: [] };
  const nodes = new Map<string, FolderNode>([["", root]]);
  const paths = new Set(folders);
  for (const folder of [...folders, ...projects.map((project) => project.folder)]) {
    const parts = folder.split("/").filter(Boolean);
    parts.forEach((_, index) => paths.add(parts.slice(0, index + 1).join("/")));
  }
  for (const path of [...paths].sort()) {
    if (!path || nodes.has(path)) continue;
    const parts = path.split("/");
    const parentPath = parts.slice(0, -1).join("/");
    const parent = nodes.get(parentPath) ?? root;
    const node: FolderNode = { path, name: parts.at(-1) ?? path, children: [] };
    nodes.set(path, node);
    parent.children.push(node);
  }
  const sort = (node: FolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    node.children.forEach(sort);
  };
  sort(root);
  return root;
}

function without(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.delete(value);
  return next;
}

function shortTime(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
