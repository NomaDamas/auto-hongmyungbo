export type PlatformId =
  | "linkedin"
  | "x"
  | "threads"
  | "instagram"
  | "facebook"
  | "bluesky"
  | "mastodon"
  | "reddit"
  | "hackernews"
  | "producthunt"
  | "devto"
  | "naver_cafe"
  | "okky"
  | "naver_blog"
  | "tistory"
  | "brunch"
  | "velog"
  | "medium"
  | "substack"
  | "hashnode"
  | "wordpress";
/** Comment/reply variant of a platform post; stored as `<platform>.comment.md`. */
export type CommentDocId = `${PlatformId}.comment`;
/** Editable docs: source, platform posts, platform comments. */
export type DocId = "master" | PlatformId | CommentDocId;

export type PublishStatus = "draft" | "ready" | "scheduled" | "sent" | "posted" | "failed";

export interface PublishState {
  status: PublishStatus;
  at?: string;
  /** ISO time the post should go live. */
  scheduledAt?: string;
  /** "aside-native": Aside sets the platform's own scheduler; "app": this app runs Aside at the time. */
  scheduleMode?: "aside-native" | "app";
  url?: string;
  error?: string;
}

export interface ProjectMeta {
  title: string;
  createdAt: string;
  /** Hash of master.md at the time each platform doc was last derived from it. */
  derivedFrom: Partial<Record<PlatformId, string>>;
  publish: Partial<Record<PlatformId, PublishState>>;
  /** Standing intent for this post (audience, tone, must-keeps); prepended to every prompt. */
  brief?: string;
  /** Platforms this post targets (subset of Settings.platforms); absent = settings default. */
  platforms?: PlatformId[];
  /** Media attached per platform ("master" = shared pool). */
  media?: Partial<Record<DocId, MediaItem[]>>;
  source?: SourceProject;
  /** Comment/reply per platform (text lives in `<platform>.comment.md`). */
  comments?: Partial<Record<PlatformId, CommentState>>;
  /** Latest engagement snapshot per platform, read by Aside from the live post page. */
  insights?: Partial<Record<PlatformId, PostInsights>>;
}

/** Numbers Aside could read from a published post; absent = not shown by the platform. */
export interface PostInsights {
  at: string;
  url: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  /** Up to 5 most recent comment snippets (author + text), for replying from the app. */
  recentComments?: { author: string; text: string; url?: string }[];
  error?: string;
}

/** Which variant of a platform doc is being edited/published. */
export type DocVariant = "post" | "comment";

export interface CommentState {
  /** "first": post right after our own post goes live; "reply": reply on targetUrl. */
  mode: "first" | "reply";
  /** Post to reply to (mode "reply"); for "first" the post URL from meta.publish is used. */
  targetUrl?: string;
  status: "draft" | "sent" | "posted" | "failed";
  at?: string;
  url?: string;
  error?: string;
}

export interface ProjectSummary {
  slug: string;
  title: string;
  updatedAt: number;
  /** Promotion folder path relative to workspaceRoot ("" = root), e.g. "홍보/런칭". */
  folder: string;
  /** Earliest pending scheduled time, for sidebar badges. */
  nextScheduledAt?: string;
  postedCount: number;
  platformCount: number;
}

export interface ProjectData {
  slug: string;
  folder: string;
  dir: string;
  meta: ProjectMeta;
  docs: Partial<Record<DocId, string>>;
}

export interface MediaItem {
  /** File name inside the project's media/ folder. */
  file: string;
  kind: "image" | "video";
  alt?: string;
}

/** A source code/project folder the post is about; harnesses read it via --add-dir. */
export interface SourceProject {
  path: string;
  name: string;
  links: string[];
  summary?: string;
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
  /** Flag that grants the harness read access to an extra directory (e.g. "--add-dir"). */
  addDirFlag?: string;
}

export type ProviderKind = "cli" | "web" | "browser" | "custom";
export type ProviderEffort = "low" | "medium" | "high" | "xhigh";

/** Non-secret provider settings. Credentials and cookies stay with the provider/Aside. */
export interface ProviderConfig {
  id: string;
  label: string;
  kind: ProviderKind;
  command?: string;
  url?: string;
  model?: string;
  effort?: ProviderEffort;
  timeoutMs: number;
  retries: number;
  skills: string[];
  browserProfileId?: string;
  enabled: boolean;
}

export interface Settings {
  workspaceRoot: string;
  webTabs: WebTabConfig[];
  harnesses: HarnessConfig[];
  providers: ProviderConfig[];
  platforms: PlatformId[];
  theme: "dark" | "light";
  /** Aside browser profile used for publishing and login checks; empty = Aside default. */
  asideProfileId: string;
  /** Dock tab groups (Chrome-style). Tab ids: `web:<id>` | `harness:<id>`. */
  dockGroups: DockGroup[];
  onboarded: boolean;
}

export type GroupColor = "grey" | "blue" | "red" | "yellow" | "green" | "pink" | "purple" | "cyan" | "orange";

export interface DockGroup {
  id: string;
  title: string;
  color: GroupColor;
  collapsed: boolean;
  tabIds: string[];
}

export type AsideLoginState = "signed-in" | "signed-out" | "error";

/** Non-secret Aside facts surfaced to the UI. Tokens and cookies never leave the Aside process. */
export interface AsideStatus {
  installed: boolean;
  signedIn: boolean;
  email?: string;
  name?: string;
  profiles: { id: string; label: string; connected: boolean }[];
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

export interface SetupStatus {
  asideApp: boolean;
  asideCli: boolean;
  asideSignedIn: boolean;
  /** Harness id → CLI found on PATH. */
  harnesses: Record<string, boolean>;
}

export interface PublishJobEvent {
  slug: string;
  platform: PlatformId;
  state: PublishState;
  /** Present when the event is about the platform's comment. */
  comment?: CommentState;
}

export interface Api {
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
    pickWorkspace(): Promise<Settings | null>;
  };
  /**
   * Projects live at `<workspaceRoot>/<folder>/<name>/`. `slug` is the path relative to
   * workspaceRoot (e.g. "홍보/런칭/2026-11-15-후기") and is the project's stable id.
   */
  projects: {
    list(): Promise<ProjectSummary[]>;
    folders(): Promise<string[]>;
    createFolder(path: string): Promise<void>;
    renameFolder(from: string, to: string): Promise<void>;
    create(title: string, folder: string): Promise<ProjectData>;
    move(slug: string, folder: string): Promise<string>;
    open(slug: string): Promise<ProjectData>;
    writeDoc(slug: string, doc: DocId, content: string): Promise<void>;
    writeMeta(slug: string, meta: ProjectMeta): Promise<void>;
    snapshot(slug: string, doc: DocId, content: string, label: string): Promise<Snapshot>;
    listSnapshots(slug: string, doc: DocId): Promise<Snapshot[]>;
    readSnapshot(slug: string, snapshotId: string, doc: DocId): Promise<string>;
    reveal(slug: string): Promise<void>;
    onFileChanged(cb: (e: FileChangedEvent) => void): () => void;
    /** Copy picked/dropped files into `<project>/media/`; returns added items. */
    addMedia(slug: string, paths: string[]): Promise<MediaItem[]>;
    pickMedia(slug: string): Promise<MediaItem[]>;
    pathForFile(file: File): string;
    mediaUrl(slug: string, file: string): string;
    /** Choose a source code folder; returns detected name, links (git remote, homepage, README URLs) and summary. */
    pickSource(): Promise<SourceProject | null>;
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
  aside: {
    status(): Promise<AsideStatus>;
    checkLogins(platforms: PlatformId[], profileId?: string): Promise<Partial<Record<PlatformId, AsideLoginState>>>;
    openLogin(platform: PlatformId, profileId?: string): Promise<void>;
    openImporter(profileId?: string): Promise<void>;
  };
  setup: {
    status(): Promise<SetupStatus>;
    /** Download + install Aside.app from releases.aside.com (or the bundled dmg). Progress via onProgress. */
    installAsideApp(): Promise<void>;
    onProgress(cb: (e: { step: string; pct?: number }) => void): () => void;
  };
  /** Publishing via Aside MCP (`aside mcp` exec tool), now or at scheduledAt. */
  publish: {
    now(slug: string, platform: PlatformId): Promise<void>;
    schedule(slug: string, platform: PlatformId, at: string, mode: "aside-native" | "app"): Promise<void>;
    cancel(slug: string, platform: PlatformId): Promise<void>;
    /**
     * Post the platform's comment doc via Aside: as a reply on `targetUrl`, or (default) on the
     * post URL recorded in meta.publish[platform].url. Result lands in meta.comments[platform].
     */
    comment(slug: string, platform: PlatformId, targetUrl?: string): Promise<void>;
    /** Ask Aside to open each published post (read-only) and read engagement numbers + recent comments. */
    refreshInsights(slug: string, platforms: PlatformId[]): Promise<Partial<Record<PlatformId, PostInsights>>>;
    onUpdate(cb: (e: PublishJobEvent) => void): () => void;
  };
  openExternal(url: string): void;
}
