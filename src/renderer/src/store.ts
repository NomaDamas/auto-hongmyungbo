import { create } from "zustand";
import { toast } from "sonner";
import type {
  AsideLoginState,
  AsideStatus,
  CommentState,
  DocId,
  MediaItem,
  PlatformId,
  PostInsights,
  ProjectData,
  ProjectMeta,
  ProjectSummary,
  PublishState,
  Settings,
  SourceProject,
} from "@shared/types";
import { hashText } from "@shared/text";
import { commentDoc, docLabel, parseDoc, type TabId } from "@shared/platforms";

export interface SidebarInput {
  kind: "post" | "folder" | "rename";
  path: string;
}

/** An external change (AI reply, harness file write, snapshot restore) awaiting review as a diff. */
export interface Proposal {
  id: string;
  baseline: string;
  proposed: string;
  source: string;
}

/** A prompt sent to a web chat whose reply should be pulled back into the editor. */
export interface PendingReply {
  tabId: string;
  /** Docs the reply should land in; multi-doc replies come back as `=== doc ===` sections. */
  docs: DocId[];
  /** Selected excerpt the reply should replace (single-doc only); empty = whole doc. */
  selection: string;
}

/** A user-authored web reply waiting for explicit approval before entering the editor. */
export interface EmbedItem {
  id: string;
  tabId: string;
  label: string;
  text: string;
}

/** Dock tab ids: `web:<id>`, `harness:<id>`, `run:<id>` (one-off commands such as Aside publishing). */
export interface RunTab {
  id: string;
  label: string;
  command: string;
  platform?: PlatformId;
}

export type WorkspaceMode = "post" | "comment" | "insights";

function savedMode(): WorkspaceMode {
  const value = localStorage.getItem("hmb_mode");
  return value === "comment" || value === "insights" ? value : "post";
}

interface State {
  settings: Settings | null;
  projects: ProjectSummary[];
  folders: string[];
  project: ProjectData | null;
  proposals: Partial<Record<DocId, Proposal>>;
  selections: Partial<Record<DocId, string>>;
  /** Intent target: the doc in the focused editor panel. */
  activeDoc: DocId;
  tabSelection: Partial<Record<TabId, PlatformId>>;
  mode: WorkspaceMode;
  previewDoc: PlatformId | null;
  setupOpen: boolean;
  sidebarOpen: boolean;
  /** Inline sidebar form: new post / new folder / rename (window.prompt is unsupported in Electron). */
  sidebarInput: SidebarInput | null;
  dockTab: string;
  dockOpen: boolean;
  runTabs: RunTab[];
  pendingReply: PendingReply | null;
  autoSubmit: boolean;
  autoEmbed: boolean;
  embedInbox: EmbedItem[];
  paletteOpen: boolean;
  settingsOpen: boolean;
  historyDoc: DocId | null;
  publishStates: Partial<Record<PlatformId, PublishState>>;
  aside: AsideStatus | null;
  asideLogins: Partial<Record<PlatformId, AsideLoginState>>;
  asideChecking: boolean;
  asideOpen: boolean;

  init(): Promise<void>;
  enabledPlatforms(): PlatformId[];
  updateSettings(patch: Partial<Settings>): Promise<void>;
  refreshProjects(): Promise<void>;
  refreshFolders(): Promise<void>;
  createFolder(path: string): Promise<void>;
  createProject(title: string, folder: string): Promise<void>;
  moveProject(slug: string, folder: string): Promise<void>;
  openProject(slug: string): Promise<void>;
  closeProject(): void;
  setDoc(doc: DocId, text: string): void;
  propose(doc: DocId, proposed: string, source: string): void;
  resolveProposal(doc: DocId, finalText: string): Promise<void>;
  rejectProposal(doc: DocId): void;
  markFresh(doc: PlatformId): void;
  setPublish(doc: PlatformId, state: PublishState): void;
  setComment(platform: PlatformId, patch: Partial<CommentState>): void;
  setInsights(insights: Partial<Record<PlatformId, PostInsights>>): void;
  setMode(mode: WorkspaceMode): void;
  setAutoEmbed(value: boolean): void;
  setMedia(doc: DocId, items: MediaItem[]): void;
  setSource(source: SourceProject | undefined): void;
  setBrief(brief: string): void;
  refreshAside(checkLogins?: boolean): Promise<void>;
  set(partial: Partial<State>): void;
}

const saveTimers = new Map<string, number>();
const pendingWrites = new Map<string, { slug: string; doc: DocId; text: string }>();
const inFlightWrites = new Map<Promise<void>, { slug: string; doc: DocId; text: string }>();
let initStarted = false;
const LAST_PROJECT_KEY = "hmb_last_project";

function trackedWriteDoc(slug: string, doc: DocId, text: string): Promise<void> {
  const write = window.api.projects.writeDoc(slug, doc, text);
  inFlightWrites.set(write, { slug, doc, text });
  void write.then(() => inFlightWrites.delete(write), () => undefined);
  return write;
}

function scheduleSave(slug: string, doc: DocId, text: string): void {
  const key = `${slug}:${doc}`;
  pendingWrites.set(key, { slug, doc, text });
  clearTimeout(saveTimers.get(key));
  saveTimers.set(
    key,
    window.setTimeout(() => {
      saveTimers.delete(key);
      const pending = pendingWrites.get(key);
      if (!pending) return;
      pendingWrites.delete(key);
      trackedWriteDoc(pending.slug, pending.doc, pending.text);
    }, 300),
  );
}

async function flushPendingWrites(): Promise<void> {
  for (const [key, timer] of saveTimers) {
    clearTimeout(timer);
    saveTimers.delete(key);
  }
  const writes = [...pendingWrites.values()];
  pendingWrites.clear();
  const queued = writes.map(({ slug, doc, text }) => trackedWriteDoc(slug, doc, text));
  const active = [...inFlightWrites.entries()];
  const results = await Promise.allSettled([...queued, ...active.map(([write]) => write)]);
  if (results.some((result) => result.status === "rejected")) {
    for (const pending of writes) pendingWrites.set(`${pending.slug}:${pending.doc}`, pending);
    for (const [index, result] of results.entries()) {
      if (result.status !== "rejected" || index < queued.length) continue;
      const pending = active[index - queued.length]?.[1];
      if (pending) pendingWrites.set(`${pending.slug}:${pending.doc}`, pending);
    }
    throw new Error("draft write failed");
  }
}

function cancelPendingWrite(slug: string, doc: DocId): void {
  const key = `${slug}:${doc}`;
  clearTimeout(saveTimers.get(key));
  saveTimers.delete(key);
  pendingWrites.delete(key);
}

export const useStore = create<State>((set, get) => {
  const writeMeta = (meta: ProjectMeta) => {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, meta }, publishStates: meta.publish });
    void window.api.projects.writeMeta(p.slug, meta);
  };

  const openData = (project: ProjectData) => {
    set({
      project,
      publishStates: project.meta.publish,
      proposals: {},
      selections: {},
      activeDoc: "master",
      tabSelection: {},
      embedInbox: [],
      previewDoc: null,
      historyDoc: null,
      runTabs: [],
      pendingReply: null,
    });
  };

  return {
    settings: null,
    projects: [],
    folders: [],
    project: null,
    proposals: {},
    selections: {},
    activeDoc: "master",
    tabSelection: {},
    mode: savedMode(),
    previewDoc: null,
    setupOpen: false,
    sidebarOpen: true,
    sidebarInput: null,
    dockTab: "web:chatgpt",
    dockOpen: false,
    runTabs: [],
    pendingReply: null,
    autoSubmit: true,
    autoEmbed: localStorage.getItem("hmb_auto_embed") !== "false",
    embedInbox: [],
    paletteOpen: false,
    settingsOpen: false,
    historyDoc: null,
    publishStates: {},
    aside: null,
    asideLogins: {},
    asideChecking: false,
    asideOpen: false,

    async init() {
      if (initStarted) return;
      initStarted = true;
      const settings = await window.api.settings.get();
      set({ settings, setupOpen: !settings.onboarded, dockTab: settings.webTabs[0] ? `web:${settings.webTabs[0].id}` : "" });
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
      await Promise.all([get().refreshProjects(), get().refreshFolders()]);
      const lastProject = localStorage.getItem(LAST_PROJECT_KEY);
      if (lastProject && get().projects.some((item) => item.slug === lastProject)) {
        await get().openProject(lastProject).catch(() => {
          localStorage.removeItem(LAST_PROJECT_KEY);
          toast.error("이전 프로젝트 파일을 읽지 못했습니다.", { description: "프로젝트 목록에서 복구할 항목을 선택하세요." });
        });
      } else if (lastProject) {
        localStorage.removeItem(LAST_PROJECT_KEY);
        toast.message("이전에 열었던 프로젝트를 찾지 못했습니다.", { description: "프로젝트 목록에서 다시 선택하세요." });
      }
      void get().refreshAside();

      let closingAfterFlush = false;
      window.addEventListener("beforeunload", (event) => {
        if (closingAfterFlush) return;
        event.preventDefault();
        closingAfterFlush = true;
        void flushPendingWrites().then(() => window.close()).catch(() => {
          closingAfterFlush = false;
          toast.error("저장 중 앱을 닫지 못했습니다. 다시 시도하세요.");
        });
      });

      window.api.projects.onFileChanged(({ slug, doc, content }) => {
        const { project, proposals } = get();
        if (project?.slug !== slug) return;
        const current = proposals[doc]?.baseline ?? project.docs[doc] ?? "";
        if (content === current) {
          if (proposals[doc]) get().rejectProposal(doc);
          return;
        }
        get().propose(doc, content, "harness");
        toast.message(`${docLabel(doc)} 변경 감지`, { description: "에디터에서 diff로 검토하세요." });
      });

      window.api.publish.onUpdate(({ slug, platform, state, comment }) => {
        const { project } = get();
        if (project?.slug === slug) {
          if (comment) {
            const comments = { ...project.meta.comments, [platform]: comment };
            set({ project: { ...project, meta: { ...project.meta, comments } } });
          } else {
            const publish = { ...project.meta.publish, [platform]: state };
            set({ project: { ...project, meta: { ...project.meta, publish } }, publishStates: publish });
          }
        }
        const label = docLabel(comment ? commentDoc(platform) : platform);
        const status = comment?.status ?? state.status;
        if (status === "posted") {
          toast.success(`${label} ${comment ? "등록" : "게시"} 완료`, { description: comment?.url ?? state.url });
        }
        if (status === "failed") {
          toast.error(`${label} ${comment ? "등록" : "게시"} 실패`, { description: comment?.error ?? state.error });
        }
        void get().refreshProjects();
      });
    },

    enabledPlatforms() {
      const { project, settings } = get();
      return project?.meta.platforms ?? settings?.platforms ?? [];
    },

    async updateSettings(patch) {
      const settings = await window.api.settings.set(patch);
      set({ settings });
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
      if (patch.workspaceRoot) {
        set({ project: null, publishStates: {}, proposals: {}, activeDoc: "master", previewDoc: null });
        await Promise.all([get().refreshProjects(), get().refreshFolders()]);
      }
    },

    async refreshProjects() {
      set({ projects: await window.api.projects.list() });
    },

    async refreshFolders() {
      set({ folders: await window.api.projects.folders() });
    },

    async createFolder(path) {
      const folder = path.trim().replace(/^\/+|\/+$/g, "");
      if (!folder) return;
      await window.api.projects.createFolder(folder);
      await get().refreshFolders();
    },

    async createProject(title, folder) {
      const project = await window.api.projects.create(title, folder);
      openData(project);
      localStorage.setItem(LAST_PROJECT_KEY, project.slug);
      await get().refreshProjects();
    },

    async moveProject(slug, folder) {
      const current = get().project;
      const summary = get().projects.find((p) => p.slug === slug);
      if (current?.slug !== slug && summary?.folder === folder) return;
      if (current?.slug === slug && current.folder === folder) return;
      const nextSlug = await window.api.projects.move(slug, folder);
      await get().refreshProjects();
      if (current?.slug === slug) await get().openProject(nextSlug);
    },

    async openProject(slug) {
      openData(await window.api.projects.open(slug));
      localStorage.setItem(LAST_PROJECT_KEY, slug);
    },

    closeProject() {
      const web = get().settings?.webTabs[0];
      set({
        project: null,
        publishStates: {},
        proposals: {},
        activeDoc: "master",
        tabSelection: {},
        embedInbox: [],
        previewDoc: null,
        historyDoc: null,
        runTabs: [],
        pendingReply: null,
        dockTab: web ? `web:${web.id}` : "",
      });
      void get().refreshProjects();
    },

    setDoc(doc, text) {
      const p = get().project;
      if (!p || (p.docs[doc] ?? "") === text) return;
      set({ project: { ...p, docs: { ...p.docs, [doc]: text } } });
      scheduleSave(p.slug, doc, text);
    },

    propose(doc, proposed, source) {
      const { project, proposals } = get();
      if (!project) return;
      const baseline = proposals[doc]?.baseline ?? project.docs[doc] ?? "";
      if (proposed === baseline) return;
      set({ proposals: { ...proposals, [doc]: { id: crypto.randomUUID(), baseline, proposed, source } } });
    },

    async resolveProposal(doc, finalText) {
      const { project, proposals } = get();
      const prop = proposals[doc];
      if (!project || !prop) return;
      // Commit synchronously: bulk accept resolves several docs concurrently.
      const rest = { ...proposals };
      delete rest[doc];
      set({ proposals: rest, project: { ...project, docs: { ...project.docs, [doc]: finalText } } });
      cancelPendingWrite(project.slug, doc);
      const { platform, variant } = parseDoc(doc);
      if (platform && variant === "post") get().markFresh(platform);
      await window.api.projects.snapshot(project.slug, doc, prop.baseline, `before ${prop.source}`);
      await trackedWriteDoc(project.slug, doc, finalText);
    },

    rejectProposal(doc) {
      const { project, proposals } = get();
      const prop = proposals[doc];
      if (!project || !prop) return;
      const rest = { ...proposals };
      delete rest[doc];
      set({ proposals: rest });
      cancelPendingWrite(project.slug, doc);
      // Harness writes already hit disk; restore the reviewed baseline.
      void trackedWriteDoc(project.slug, doc, prop.baseline);
    },

    markFresh(doc) {
      const p = get().project;
      if (!p) return;
      writeMeta({ ...p.meta, derivedFrom: { ...p.meta.derivedFrom, [doc]: hashText(p.docs.master ?? "") } });
    },

    setPublish(doc, state) {
      const p = get().project;
      if (!p) return;
      writeMeta({ ...p.meta, publish: { ...p.meta.publish, [doc]: state } });
    },

    setComment(platform, patch) {
      const p = get().project;
      if (!p) return;
      const current = p.meta.comments?.[platform] ?? { mode: "first" as const, status: "draft" as const };
      writeMeta({ ...p.meta, comments: { ...p.meta.comments, [platform]: { ...current, ...patch } } });
    },

    setInsights(insights) {
      const p = get().project;
      if (!p) return;
      set({ project: { ...p, meta: { ...p.meta, insights: { ...p.meta.insights, ...insights } } } });
    },

    setMode(mode) {
      localStorage.setItem("hmb_mode", mode);
      const { activeDoc } = get();
      const { platform } = parseDoc(activeDoc);
      const nextDoc = platform && mode !== "insights" ? (mode === "comment" ? commentDoc(platform) : platform) : activeDoc;
      set({ mode, activeDoc: nextDoc });
    },

    setAutoEmbed(value) {
      localStorage.setItem("hmb_auto_embed", String(value));
      set({ autoEmbed: value });
    },

    setMedia(doc, items) {
      const p = get().project;
      if (!p) return;
      writeMeta({ ...p.meta, media: { ...p.meta.media, [doc]: items } });
    },

    setSource(source) {
      const p = get().project;
      if (!p) return;
      writeMeta({ ...p.meta, source });
    },

    setBrief(brief) {
      const p = get().project;
      if (!p || (p.meta.brief ?? "") === brief) return;
      writeMeta({ ...p.meta, brief });
    },

    async refreshAside(checkLogins = false) {
      const status = await window.api.aside.status().catch(() => null);
      set({ aside: status });
      if (!checkLogins || !status?.installed || !status.signedIn) return;
      set({ asideChecking: true });
      try {
        const s = get().settings!;
        const logins = await window.api.aside.checkLogins(get().enabledPlatforms(), s.asideProfileId || undefined);
        set({ asideLogins: { ...get().asideLogins, ...logins } });
      } catch (e) {
        toast.error(`Aside 로그인 확인 실패: ${(e as Error).message}`);
      } finally {
        set({ asideChecking: false });
      }
    },

    set(partial) {
      set(partial);
    },
  };
});

export function isStale(project: ProjectData, doc: PlatformId): boolean {
  const from = project.meta.derivedFrom[doc];
  return !!from && !!(project.docs[doc] ?? "").trim() && from !== hashText(project.docs.master ?? "");
}
