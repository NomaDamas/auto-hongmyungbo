export type PlatformId = "linkedin" | "x" | "threads" | "reddit";
export type DocId = "master" | PlatformId;

export type PublishStatus = "draft" | "ready" | "sent" | "posted";

export interface PublishState {
  status: PublishStatus;
  at?: string;
}

export interface ProjectMeta {
  title: string;
  createdAt: string;
  /** Hash of master.md at the time each platform doc was last derived from it. */
  derivedFrom: Partial<Record<PlatformId, string>>;
  publish: Partial<Record<PlatformId, PublishState>>;
}

export interface ProjectSummary {
  slug: string;
  title: string;
  updatedAt: number;
}

export interface ProjectData {
  slug: string;
  dir: string;
  meta: ProjectMeta;
  docs: Record<DocId, string>;
}

export interface Snapshot {
  id: string;
  doc: DocId;
  at: number;
  label: string;
}

export interface WebTabConfig {
  id: string;
  label: string;
  url: string;
}

export interface HarnessConfig {
  id: string;
  label: string;
  /** Shell command line run inside the user's login shell, cwd = project folder. */
  command: string;
}

export interface Settings {
  workspaceRoot: string;
  webTabs: WebTabConfig[];
  harnesses: HarnessConfig[];
  platforms: PlatformId[];
  theme: "dark" | "light";
}

export interface FileChangedEvent {
  slug: string;
  doc: DocId;
  content: string;
}

export interface PtyDataEvent {
  id: string;
  data: string;
}

export interface PtyExitEvent {
  id: string;
  code: number;
}

export interface Api {
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
    pickWorkspace(): Promise<Settings | null>;
  };
  projects: {
    list(): Promise<ProjectSummary[]>;
    create(title: string): Promise<ProjectData>;
    open(slug: string): Promise<ProjectData>;
    writeDoc(slug: string, doc: DocId, content: string): Promise<void>;
    writeMeta(slug: string, meta: ProjectMeta): Promise<void>;
    snapshot(slug: string, doc: DocId, content: string, label: string): Promise<Snapshot>;
    listSnapshots(slug: string, doc: DocId): Promise<Snapshot[]>;
    readSnapshot(slug: string, snapshotId: string, doc: DocId): Promise<string>;
    reveal(slug: string): Promise<void>;
    onFileChanged(cb: (e: FileChangedEvent) => void): () => void;
  };
  pty: {
    spawn(id: string, command: string, cwd: string, cols: number, rows: number): Promise<void>;
    write(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    kill(id: string): void;
    onData(cb: (e: PtyDataEvent) => void): () => void;
    onExit(cb: (e: PtyExitEvent) => void): () => void;
  };
  clipboard: {
    read(): Promise<string>;
    write(text: string): void;
  };
  openExternal(url: string): void;
}
