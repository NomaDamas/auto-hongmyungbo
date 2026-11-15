import { create } from "zustand";
import { toast } from "sonner";
import type { AsideLoginState, AsideStatus, DocId, PlatformId, ProjectData, ProjectMeta, ProjectSummary, PublishState, Settings } from "@shared/types";
import { hashText } from "@shared/text";
import { docLabel } from "@shared/platforms";

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

/** Dock tab ids: `web:<id>`, `harness:<id>`, `run:<id>` (one-off commands such as Aside publishing). */
export interface RunTab {
  id: string;
  label: string;
  command: string;
  platform?: PlatformId;
}

interface State {
  settings: Settings | null;
  projects: ProjectSummary[];
  project: ProjectData | null;
  proposals: Partial<Record<DocId, Proposal>>;
  selections: Partial<Record<DocId, string>>;
  focusDoc: DocId;
  /** Single-column focus mode; null = all columns side by side. */
  soloDoc: DocId | null;
  dockTab: string;
  dockOpen: boolean;
  runTabs: RunTab[];
  pendingReply: PendingReply | null;
  autoSubmit: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;
  historyDoc: DocId | null;
  /** Docs the intent bar applies to. */
  scope: DocId[];
  aside: AsideStatus | null;
  asideLogins: Partial<Record<PlatformId, AsideLoginState>>;
  asideChecking: boolean;
  asideOpen: boolean;

  init(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  refreshProjects(): Promise<void>;
  createProject(title: string): Promise<void>;
  openProject(slug: string): Promise<void>;
  closeProject(): void;
  setDoc(doc: DocId, text: string): void;
  propose(doc: DocId, proposed: string, source: string): void;
  resolveProposal(doc: DocId, finalText: string): Promise<void>;
  rejectProposal(doc: DocId): void;
  markFresh(doc: PlatformId): void;
  setPublish(doc: PlatformId, state: PublishState): void;
  setBrief(brief: string): void;
  refreshAside(checkLogins?: boolean): Promise<void>;
  set(partial: Partial<State>): void;
}

const saveTimers = new Map<DocId, ReturnType<typeof setTimeout>>();

function scheduleSave(slug: string, doc: DocId, text: string): void {
  clearTimeout(saveTimers.get(doc));
  saveTimers.set(
    doc,
    setTimeout(() => void window.api.projects.writeDoc(slug, doc, text), 300),
  );
}

export const useStore = create<State>((set, get) => {
  const writeMeta = (meta: ProjectMeta) => {
    const p = get().project;
    if (!p) return;
    set({ project: { ...p, meta } });
    void window.api.projects.writeMeta(p.slug, meta);
  };

  return {
    settings: null,
    projects: [],
    project: null,
    proposals: {},
    selections: {},
    focusDoc: "master",
    soloDoc: null,
    dockTab: "web:chatgpt",
    dockOpen: true,
    runTabs: [],
    pendingReply: null,
    autoSubmit: true,
    paletteOpen: false,
    settingsOpen: false,
    historyDoc: null,
    scope: ["master"],
    aside: null,
    asideLogins: {},
    asideChecking: false,
    asideOpen: false,

    async init() {
      const settings = await window.api.settings.get();
      set({ settings, dockTab: settings.webTabs[0] ? `web:${settings.webTabs[0].id}` : "" });
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
      await get().refreshProjects();
      void get().refreshAside();
      window.api.projects.onFileChanged(({ slug, doc, content }) => {
        const { project, proposals } = get();
        if (project?.slug !== slug) return;
        const current = proposals[doc]?.baseline ?? project.docs[doc];
        if (content === current) {
          if (proposals[doc]) get().rejectProposal(doc);
          return;
        }
        get().propose(doc, content, "harness");
        toast.message(`${docLabel(doc)} 변경 감지`, { description: "에디터에서 diff로 검토하세요." });
      });
    },

    async updateSettings(patch) {
      const settings = await window.api.settings.set(patch);
      set({ settings });
      document.documentElement.classList.toggle("dark", settings.theme === "dark");
      if (patch.workspaceRoot) {
        set({ project: null, proposals: {} });
        await get().refreshProjects();
      }
    },

    async refreshProjects() {
      set({ projects: await window.api.projects.list() });
    },

    async createProject(title) {
      const project = await window.api.projects.create(title);
      set({ project, proposals: {}, selections: {}, focusDoc: "master", scope: ["master"], runTabs: [], pendingReply: null });
      await get().refreshProjects();
    },

    async openProject(slug) {
      const project = await window.api.projects.open(slug);
      set({ project, proposals: {}, selections: {}, focusDoc: "master", scope: ["master"], runTabs: [], pendingReply: null });
    },

    closeProject() {
      const web = get().settings?.webTabs[0];
      set({ project: null, proposals: {}, runTabs: [], pendingReply: null, soloDoc: null, dockTab: web ? `web:${web.id}` : "" });
      void get().refreshProjects();
    },

    setDoc(doc, text) {
      const p = get().project;
      if (!p || p.docs[doc] === text) return;
      set({ project: { ...p, docs: { ...p.docs, [doc]: text } } });
      scheduleSave(p.slug, doc, text);
    },

    propose(doc, proposed, source) {
      const { project, proposals } = get();
      if (!project) return;
      const baseline = proposals[doc]?.baseline ?? project.docs[doc];
      if (proposed === baseline) return;
      // Focus follows a single incoming change; batch results leave focus where the user is.
      const batch = Object.keys(proposals).length > 0;
      set({ proposals: { ...proposals, [doc]: { id: crypto.randomUUID(), baseline, proposed, source } }, ...(batch ? {} : { focusDoc: doc }) });
    },

    async resolveProposal(doc, finalText) {
      const { project, proposals } = get();
      const prop = proposals[doc];
      if (!project || !prop) return;
      // Commit state synchronously; bulk accept resolves several docs concurrently and must not clobber each other.
      const { [doc]: _, ...rest } = proposals;
      set({ proposals: rest, project: { ...project, docs: { ...project.docs, [doc]: finalText } } });
      clearTimeout(saveTimers.get(doc));
      if (doc !== "master") get().markFresh(doc);
      await window.api.projects.snapshot(project.slug, doc, prop.baseline, `before ${prop.source}`);
      await window.api.projects.writeDoc(project.slug, doc, finalText);
    },

    rejectProposal(doc) {
      const { project, proposals } = get();
      const prop = proposals[doc];
      if (!project || !prop) return;
      const { [doc]: _, ...rest } = proposals;
      set({ proposals: rest });
      // Harness writes already hit disk; restore the reviewed baseline.
      void window.api.projects.writeDoc(project.slug, doc, prop.baseline);
    },

    markFresh(doc) {
      const p = get().project;
      if (!p) return;
      writeMeta({ ...p.meta, derivedFrom: { ...p.meta.derivedFrom, [doc]: hashText(p.docs.master) } });
    },

    setPublish(doc, state) {
      const p = get().project;
      if (!p) return;
      writeMeta({ ...p.meta, publish: { ...p.meta.publish, [doc]: state } });
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
        const logins = await window.api.aside.checkLogins(s.platforms, s.asideProfileId || undefined);
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
  return !!from && !!project.docs[doc].trim() && from !== hashText(project.docs.master);
}
