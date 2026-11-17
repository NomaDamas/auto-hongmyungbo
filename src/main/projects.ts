import { dialog, shell, type WebContents } from "electron";
import { watch, type FSWatcher } from "chokidar";
import { access, copyFile, lstat, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import type {
  DocId,
  FileChangedEvent,
  MediaItem,
  PlatformId,
  ProjectData,
  ProjectMeta,
  ProjectSummary,
  Snapshot,
  SourceProject,
} from "@shared/types";
import { ALL_PLATFORMS, commentDoc, docFile, isDocId } from "@shared/platforms";
import { agentsMd } from "@shared/agents-md";
import { getSettings } from "./settings";

const META = "project.json";
const HISTORY = ".history";
const MEDIA = "media";
const IMAGE_EXTENSIONS: Record<string, true> = { ".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".heic": true };
const VIDEO_EXTENSIONS: Record<string, true> = { ".mp4": true, ".mov": true, ".webm": true, ".m4v": true };
const BINARY_EXTENSIONS: Record<string, true> = { ...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ".pdf": true, ".zip": true, ".gz": true, ".dmg": true, ".woff": true, ".woff2": true, ".ttf": true, ".otf": true, ".sqlite": true };
const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, { cwd, maxBuffer: 2 * 1024 * 1024 });
  return result.stdout;
}

function relativeParts(value: string, allowEmpty = false): string[] {
  if (typeof value !== "string" || (!allowEmpty && !value) || value.includes("\0") || value.includes("\\")) {
    throw new Error(`invalid relative path: ${value}`);
  }
  if (isAbsolute(value) || win32.isAbsolute(value)) throw new Error(`absolute paths are not allowed: ${value}`);
  if (!value && allowEmpty) return [];
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) throw new Error(`invalid relative path: ${value}`);
  return parts;
}

function resolveInside(root: string, value: string, allowEmpty = false): string {
  const parts = relativeParts(value, allowEmpty);
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, ...parts);
  const prefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;
  if (target !== resolvedRoot && !target.startsWith(prefix)) throw new Error(`path escapes workspace: ${value}`);
  return target;
}

function validFolder(folder: string, allowEmpty = true): string[] {
  const parts = relativeParts(folder, allowEmpty);
  if (parts.length > 2) throw new Error(`promotion folders may be at most two levels deep: ${folder}`);
  return parts;
}

function validateDoc(doc: DocId): void {
  if (!isDocId(doc)) throw new Error(`unknown document: ${doc}`);
}

function enabledPlatforms(meta: ProjectMeta, defaults: PlatformId[]): PlatformId[] {
  return (meta.platforms ?? defaults).filter((platform, index, all) => ALL_PLATFORMS.includes(platform) && all.indexOf(platform) === index);
}

async function projectDir(slug: string): Promise<string> {
  const parts = relativeParts(slug);
  if (parts.length > 3) throw new Error(`invalid project slug: ${slug}`);
  return resolveInside((await getSettings()).workspaceRoot, slug);
}

function projectSlug(root: string, dir: string): string {
  return relative(root, dir).split(sep).join("/");
}

function folderOf(slug: string): string {
  return slug.split("/").slice(0, -1).join("/");
}

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10);
  return `${stamp}-${base || "untitled"}`;
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

async function isFile(path: string): Promise<boolean> {
  return stat(path).then((s) => s.isFile(), () => false);
}

async function readMeta(dir: string): Promise<ProjectMeta> {
  return JSON.parse(await readFile(join(dir, META), "utf8")) as ProjectMeta;
}

function summarize(slug: string, meta: ProjectMeta, defaults: PlatformId[], updatedAt: number): ProjectSummary {
  const states = Object.values(meta.publish ?? {});
  const scheduled = states
    .filter((state) => state.status === "scheduled" && state.scheduledAt && Number.isFinite(Date.parse(state.scheduledAt)))
    .map((state) => state.scheduledAt as string)
    .sort();
  return {
    slug,
    title: meta.title,
    updatedAt,
    folder: folderOf(slug),
    nextScheduledAt: scheduled[0],
    postedCount: states.filter((state) => state.status === "posted").length,
    platformCount: enabledPlatforms(meta, defaults).length,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const settings = await getSettings();
  const root = resolve(settings.workspaceRoot);
  const out: ProjectSummary[] = [];

  async function scan(dir: string, folderDepth: number): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      if (await isFile(join(child, META))) {
        try {
          const meta = await readMeta(child);
          const info = await stat(join(child, docFile("master"))).catch(() => stat(child));
          out.push(summarize(projectSlug(root, child), meta, settings.platforms, info.mtimeMs));
        } catch {
          // A malformed or partially written project must not hide the other projects.
        }
      } else if (folderDepth < 2) {
        await scan(child, folderDepth + 1);
      }
    }
  }

  await scan(root, 0);
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listFolders(): Promise<string[]> {
  const root = resolve((await getSettings()).workspaceRoot);
  const folders: string[] = [];

  async function scan(dir: string, depth: number): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const child = join(dir, entry.name);
      if (await isFile(join(child, META))) continue;
      const folder = projectSlug(root, child);
      folders.push(folder);
      if (depth < 2) await scan(child, depth + 1);
    }
  }

  await scan(root, 1);
  return folders.sort((a, b) => a.localeCompare(b, "ko"));
}

export async function createFolder(folder: string): Promise<void> {
  validFolder(folder, false);
  const root = (await getSettings()).workspaceRoot;
  await mkdir(resolveInside(root, folder), { recursive: true });
}

export async function renameFolder(from: string, to: string): Promise<void> {
  validFolder(from, false);
  validFolder(to, false);
  if (from === to) return;
  if (to.startsWith(from + "/")) throw new Error("a folder cannot be moved inside itself");
  const root = (await getSettings()).workspaceRoot;
  const source = resolveInside(root, from);
  const target = resolveInside(root, to);
  if (await isFile(join(source, META))) throw new Error("a project is not a promotion folder");
  await mkdir(dirname(target), { recursive: true });
  await rename(source, target);
  if (watcherDir && (watcherDir === source || watcherDir.startsWith(source + sep))) {
    const suffix = relative(source, watcherDir);
    const nextDir = resolve(target, suffix);
    const nextSlug = projectSlug(resolve(root), nextDir);
    watchProject(nextSlug, nextDir);
  }
}

export async function createProject(title: string, folder = ""): Promise<ProjectData> {
  validFolder(folder);
  const settings = await getSettings();
  const root = settings.workspaceRoot;
  const base = slugify(title);
  let name = base;
  let slug = folder ? `${folder}/${name}` : name;
  for (let n = 2; await stat(resolveInside(root, slug)).then(() => true, () => false); n++) {
    name = `${base}-${n}`;
    slug = folder ? `${folder}/${name}` : name;
  }
  const dir = resolveInside(root, slug);
  await mkdir(join(dir, HISTORY), { recursive: true });
  await mkdir(join(dir, MEDIA), { recursive: true });
  const platforms = [...settings.platforms];
  const meta: ProjectMeta = {
    title: title.trim() || "Untitled",
    createdAt: new Date().toISOString(),
    derivedFrom: {},
    publish: {},
    platforms,
  };
  await writeFile(join(dir, META), JSON.stringify(meta, null, 2));
  const instructions = agentsMd(meta.title, platforms);
  await Promise.all([
    writeFile(join(dir, docFile("master")), ""),
    ...platforms.map((platform) => writeFile(join(dir, docFile(platform)), "")),
    writeFile(join(dir, "AGENTS.md"), instructions),
    writeFile(join(dir, "CLAUDE.md"), "@AGENTS.md\n"),
  ]);
  return openProject(slug);
}

export async function readProject(slug: string): Promise<ProjectData> {
  const dir = await projectDir(slug);
  const settings = await getSettings();
  const meta = await readMeta(dir);
  const docs: Partial<Record<DocId, string>> = { master: await readFile(join(dir, docFile("master")), "utf8") };
  await Promise.all(
    enabledPlatforms(meta, settings.platforms).flatMap((platform) => [
      readText(join(dir, docFile(platform))).then((text) => void (docs[platform] = text)),
      readText(join(dir, docFile(commentDoc(platform)))).then((text) => void (docs[commentDoc(platform)] = text)),
    ]),
  );
  return { slug, folder: folderOf(slug), dir, meta, docs };
}

export async function openProject(slug: string): Promise<ProjectData> {
  const data = await readProject(slug);
  watchProject(slug, data.dir);
  return data;
}

export async function moveProject(slug: string, folder: string): Promise<string> {
  validFolder(folder);
  const source = await projectDir(slug);
  const root = (await getSettings()).workspaceRoot;
  const name = basename(source);
  const nextSlug = folder ? `${folder}/${name}` : name;
  if (nextSlug === slug) return slug;
  const target = resolveInside(root, nextSlug);
  await mkdir(dirname(target), { recursive: true });
  await rename(source, target);
  if (currentSlug === slug) watchProject(nextSlug, target);
  return nextSlug;
}

/** Content we just wrote, so the watcher can ignore our own echoes. */
const ownWrites = new Map<string, string>();
const docWrites = new Map<string, Promise<void>>();

export async function writeDoc(slug: string, doc: DocId, content: string): Promise<void> {
  validateDoc(doc);
  const path = join(await projectDir(slug), docFile(doc));
  const previous = docWrites.get(path) ?? Promise.resolve();
  const next = previous.then(async () => {
    ownWrites.set(path, content);
    await writeFile(path, content);
  });
  docWrites.set(path, next.catch(() => undefined));
  await next;
}

export async function commitProject(slug: string, message: string, doc?: DocId): Promise<void> {
  const dir = await projectDir(slug);
  await git(dir, ["init", "-q"]);
  if (doc) {
    validateDoc(doc);
    await git(dir, ["add", "--", docFile(doc), "project.json"]);
  } else {
    await git(dir, ["add", "--", "."]);
  }
  const status = await git(dir, ["status", "--porcelain"]);
  if (!status.trim()) return;
  await git(dir, ["-c", "user.name=Auto-HongMyungbo", "-c", "user.email=local@auto-hongmyungbo", "commit", "-m", message.slice(0, 120)]);
}

export async function gitLog(slug: string, doc?: DocId): Promise<{ hash: string; message: string; at: string }[]> {
  const dir = await projectDir(slug);
  try {
    const output = await git(dir, ["log", "-20", "--format=%H%x09%aI%x09%s", ...(doc ? ["--", docFile(doc)] : [])]);
    return output.trim().split("\n").filter(Boolean).map((line) => {
      const [hash, at, ...message] = line.split("\t");
      return { hash, at, message: message.join("\t") };
    });
  } catch { return []; }
}

export async function rollbackProject(slug: string, hash: string, doc: DocId): Promise<string> {
  if (!/^[0-9a-f]{7,64}$/i.test(hash)) throw new Error("invalid git revision");
  validateDoc(doc);
  const dir = await projectDir(slug);
  const relativePath = docFile(doc);
  const { stdout } = await execFileAsync("git", ["show", `${hash}:${relativePath}`], { cwd: dir, maxBuffer: 2 * 1024 * 1024 });
  return stdout;
}

export async function writeMeta(slug: string, meta: ProjectMeta): Promise<void> {
  const dir = await projectDir(slug);
  const previous = await readMeta(dir).catch(() => null);
  await writeFile(join(dir, META), JSON.stringify(meta, null, 2));
  if (
    !previous ||
    previous.title !== meta.title ||
    JSON.stringify(previous.platforms) !== JSON.stringify(meta.platforms) ||
    JSON.stringify(previous.source) !== JSON.stringify(meta.source)
  ) {
    const settings = await getSettings();
    await writeFile(join(dir, "AGENTS.md"), agentsMd(meta.title, enabledPlatforms(meta, settings.platforms), meta.source));
  }
}

export async function snapshot(slug: string, doc: DocId, content: string, label: string): Promise<Snapshot> {
  validateDoc(doc);
  const at = Date.now();
  const id = `${at}`;
  const dir = join(await projectDir(slug), HISTORY, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, docFile(doc)), content);
  await writeFile(join(dir, "label.txt"), label);
  return { id, doc, at, label };
}

export async function listSnapshots(slug: string, doc: DocId): Promise<Snapshot[]> {
  validateDoc(doc);
  const root = join(await projectDir(slug), HISTORY);
  const ids = (await readdir(root).catch(() => [] as string[])).filter((id) => /^\d+$/.test(id));
  const out: Snapshot[] = [];
  for (const id of ids) {
    if (!(await isFile(join(root, id, docFile(doc))))) continue;
    out.push({ id, doc, at: Number(id), label: await readText(join(root, id, "label.txt")) });
  }
  return out.sort((a, b) => b.at - a.at);
}

export async function readSnapshot(slug: string, id: string, doc: DocId): Promise<string> {
  validateDoc(doc);
  if (!/^\d+$/.test(id)) throw new Error(`invalid snapshot id: ${id}`);
  return readText(join(await projectDir(slug), HISTORY, id, docFile(doc)));
}

export async function revealProject(slug: string): Promise<void> {
  shell.showItemInFolder(join(await projectDir(slug), docFile("master")));
}

export async function resolveMediaFile(slug: string, file: string): Promise<string> {
  if (!file || file !== basename(file) || file === "." || file === ".." || file.includes("\\") || file.includes("\0")) {
    throw new Error(`invalid media file: ${file}`);
  }
  const dir = await projectDir(slug);
  const mediaRoot = resolve(dir, MEDIA);
  const target = resolve(mediaRoot, file);
  if (!target.startsWith(mediaRoot + sep)) throw new Error(`media path escapes project: ${file}`);
  return target;
}

export async function addMedia(slug: string, paths: string[]): Promise<MediaItem[]> {
  if (!Array.isArray(paths)) throw new Error("media paths must be an array");
  const dir = await projectDir(slug);
  const mediaDir = join(dir, MEDIA);
  await mkdir(mediaDir, { recursive: true });
  const items: MediaItem[] = [];
  for (const source of paths) {
    if (typeof source !== "string" || !source) continue;
    const extension = extname(source).toLowerCase();
    const kind = IMAGE_EXTENSIONS[extension] ? "image" : VIDEO_EXTENSIONS[extension] ? "video" : null;
    if (!kind) throw new Error(`지원하지 않는 미디어 형식입니다: ${basename(source)}`);
    const original = basename(source);
    const stem = basename(original, extname(original));
    let file = original;
    for (let n = 2; await access(join(mediaDir, file)).then(() => true, () => false); n++) file = `${stem}-${n}${extension}`;
    await copyFile(source, join(mediaDir, file));
    items.push({ file, kind });
  }
  return items;
}

export async function pickMedia(slug: string): Promise<MediaItem[]> {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Images & Videos", extensions: ["jpg", "jpeg", "png", "gif", "webp", "heic", "mp4", "mov", "webm", "m4v"] }],
  });
  return result.canceled ? [] : addMedia(slug, result.filePaths);
}

function normalizeHttpUrl(value: string): string | null {
  let url = value.trim().replace(/^git\+/, "");
  const scp = /^git@([^:]+):(.+)$/.exec(url);
  if (scp) url = `https://${scp[1]}/${scp[2]}`;
  if (url.startsWith("ssh://")) {
    try {
      const parsed = new URL(url);
      url = `https://${parsed.hostname}${parsed.pathname}`;
    } catch {
      return null;
    }
  }
  if (url.startsWith("git://")) url = "https://" + url.slice("git://".length);
  if (!/^https?:\/\//i.test(url)) return null;
  return url.replace(/\.git(?=\/|$)/i, "").replace(/\.git$/i, "").replace(/\/$/, "");
}

function gitOrigin(config: string): string | null {
  let origin = false;
  for (const line of config.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) origin = /^\s*\[remote\s+"origin"\]\s*$/.test(line);
    else if (origin) {
      const match = /^\s*url\s*=\s*(.+?)\s*$/.exec(line);
      if (match) return match[1];
    }
  }
  return null;
}

function readmeDetails(markdown: string): { links: string[]; summary?: string } {
  const links: string[] = [];
  for (const match of markdown.matchAll(/https?:\/\/[^\s<>"'`\[\]]+/gi)) {
    const url = match[0].replace(/[.,;:!?，。）)]+$/, "");
    if (!links.includes(url)) links.push(url);
    if (links.length === 5) break;
  }
  const paragraphs = markdown.split(/\r?\n\s*\r?\n/);
  const paragraph = paragraphs.find((part) => part.trim() && !/^\s{0,3}(?:#{1,6}\s|```)/.test(part));
  const summary = paragraph?.replace(/\r?\n/g, " ").trim().slice(0, 400) || undefined;
  return { links, summary };
}

export async function pickSource(): Promise<SourceProject | null> {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  const path = result.filePaths[0];
  if (result.canceled || !path) return null;

  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(await readFile(join(path, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    // package.json is optional for source projects.
  }
  const entries = await readdir(path).catch(() => [] as string[]);
  const readme = entries.filter((name) => /^README.*\.md$/i.test(name)).sort()[0];
  const markdown = readme ? await readText(join(path, readme)) : "";
  const details = readmeDetails(markdown);
  const config = await readText(join(path, ".git", "config"));
  const links: string[] = [];
  const addLink = (value: unknown): void => {
    if (typeof value !== "string") return;
    const url = normalizeHttpUrl(value);
    if (url && !links.includes(url)) links.push(url);
  };
  const origin = gitOrigin(config);
  if (origin) addLink(origin);
  addLink(pkg.homepage);
  const repository = pkg.repository;
  if (typeof repository === "string") addLink(repository);
  else if (repository && typeof repository === "object" && "url" in repository) addLink(repository.url);
  for (const link of details.links) addLink(link);

  return {
    path,
    name: typeof pkg.name === "string" && pkg.name ? pkg.name : basename(path),
    links,
    summary: details.summary,
  };
}

/** Search project text files for the file agent. Binary/media and hidden metadata are excluded. */
export async function searchFiles(slug: string, query: string): Promise<{ path: string; snippet: string }[]> {
  const project = await openProject(slug);
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const results: { path: string; snippet: string }[] = [];
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "media") continue;
      const absolute = join(dir, entry.name);
      if (entry.isDirectory()) { await walk(absolute); continue; }
      if ((await lstat(absolute).catch(() => null))?.isSymbolicLink()) continue;
      if (results.length >= 50 || await stat(absolute).then((s) => s.size > 2_000_000).catch(() => true)) continue;
      if (BINARY_EXTENSIONS[extname(entry.name).toLowerCase()]) continue;
      const text = await readFile(absolute, "utf8").catch(() => "");
      if (text.includes("\0")) continue;
      const index = text.toLowerCase().indexOf(needle);
      if (index < 0 && !entry.name.toLowerCase().includes(needle)) continue;
      if (index < 0) {
        results.push({ path: relative(project.dir, absolute), snippet: "파일 이름이 검색어와 일치합니다." });
        continue;
      }
      const start = Math.max(0, index - 180);
      results.push({ path: relative(project.dir, absolute), snippet: text.slice(start, Math.min(text.length, index + needle.length + 260)).replace(/\s+/g, " ").trim() });
    }
  }
  await walk(project.dir);
  return results;
}

let watcher: FSWatcher | null = null;
let watcherDir: string | null = null;
let currentSlug: string | null = null;
let sink: WebContents | null = null;

export function setChangeSink(wc: WebContents): void {
  sink = wc;
}

/**
 * Watch only the open project. External writers (harness agents, the user's editor)
 * edit the .md files directly; the UI turns those writes into reviewable diffs.
 */
function watchProject(slug: string, dir: string): void {
  void watcher?.close();
  currentSlug = slug;
  watcherDir = dir;
  const files = new Set(["master.md", ...ALL_PLATFORMS.flatMap((p) => [docFile(p), docFile(commentDoc(p))])]);
  watcher = watch(dir, { depth: 0, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } });
  const onChange = async (path: string): Promise<void> => {
    const name = basename(path);
    if (!files.has(name)) return;
    const content = await readText(path);
    if (ownWrites.get(path) === content) return;
    ownWrites.delete(path);
    const event: FileChangedEvent = { slug, doc: name.slice(0, -3) as DocId, content };
    sink?.send("projects:fileChanged", event);
  };
  watcher.on("change", onChange).on("add", onChange);
}
