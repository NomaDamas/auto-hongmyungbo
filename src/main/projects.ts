import { shell, type WebContents } from "electron";
import { watch, type FSWatcher } from "chokidar";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { DocId, FileChangedEvent, ProjectData, ProjectMeta, ProjectSummary, Snapshot } from "@shared/types";
import { ALL_DOCS, docFile } from "@shared/platforms";
import { agentsMd } from "@shared/agents-md";
import { getSettings } from "./settings";

const META = "project.json";
const HISTORY = ".history";

async function projectDir(slug: string): Promise<string> {
  if (!/^[\w가-힣-]+$/.test(slug)) throw new Error(`invalid project slug: ${slug}`);
  return join((await getSettings()).workspaceRoot, slug);
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

export async function listProjects(): Promise<ProjectSummary[]> {
  const root = (await getSettings()).workspaceRoot;
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const out: ProjectSummary[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = join(root, e.name);
    const metaRaw = await readText(join(dir, META));
    if (!metaRaw) continue;
    const meta = JSON.parse(metaRaw) as ProjectMeta;
    const s = await stat(join(dir, docFile("master"))).catch(() => stat(dir));
    out.push({ slug: e.name, title: meta.title, updatedAt: s.mtimeMs });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createProject(title: string): Promise<ProjectData> {
  let slug = slugify(title);
  const root = (await getSettings()).workspaceRoot;
  for (let n = 2; await stat(join(root, slug)).then(() => true, () => false); n++) slug = `${slugify(title)}-${n}`;
  const dir = join(root, slug);
  await mkdir(join(dir, HISTORY), { recursive: true });
  const meta: ProjectMeta = { title: title.trim() || "Untitled", createdAt: new Date().toISOString(), derivedFrom: {}, publish: {} };
  await writeFile(join(dir, META), JSON.stringify(meta, null, 2));
  await Promise.all([
    ...ALL_DOCS.map((d) => writeFile(join(dir, docFile(d)), "")),
    writeFile(join(dir, "AGENTS.md"), agentsMd(meta.title)),
    writeFile(join(dir, "CLAUDE.md"), "@AGENTS.md\n"),
  ]);
  return openProject(slug);
}

export async function openProject(slug: string): Promise<ProjectData> {
  const dir = await projectDir(slug);
  const meta = JSON.parse(await readFile(join(dir, META), "utf8")) as ProjectMeta;
  const docs = Object.fromEntries(
    await Promise.all(ALL_DOCS.map(async (d) => [d, await readText(join(dir, docFile(d)))] as const)),
  ) as Record<DocId, string>;
  watchProject(slug, dir);
  return { slug, dir, meta, docs };
}

/** Content we just wrote, so the watcher can ignore our own echoes. */
const ownWrites = new Map<string, string>();

export async function writeDoc(slug: string, doc: DocId, content: string): Promise<void> {
  const path = join(await projectDir(slug), docFile(doc));
  ownWrites.set(path, content);
  await writeFile(path, content);
}

export async function writeMeta(slug: string, meta: ProjectMeta): Promise<void> {
  await writeFile(join(await projectDir(slug), META), JSON.stringify(meta, null, 2));
}

export async function snapshot(slug: string, doc: DocId, content: string, label: string): Promise<Snapshot> {
  const at = Date.now();
  const id = `${at}`;
  const dir = join(await projectDir(slug), HISTORY, id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, docFile(doc)), content);
  await writeFile(join(dir, "label.txt"), label);
  return { id, doc, at, label };
}

export async function listSnapshots(slug: string, doc: DocId): Promise<Snapshot[]> {
  const root = join(await projectDir(slug), HISTORY);
  const ids = await readdir(root).catch(() => [] as string[]);
  const out: Snapshot[] = [];
  for (const id of ids) {
    const has = await stat(join(root, id, docFile(doc))).then(() => true, () => false);
    if (!has) continue;
    out.push({ id, doc, at: Number(id), label: await readText(join(root, id, "label.txt")) });
  }
  return out.sort((a, b) => b.at - a.at);
}

export async function readSnapshot(slug: string, id: string, doc: DocId): Promise<string> {
  if (!/^\d+$/.test(id)) throw new Error(`invalid snapshot id: ${id}`);
  return readText(join(await projectDir(slug), HISTORY, id, docFile(doc)));
}

export async function revealProject(slug: string): Promise<void> {
  shell.showItemInFolder(join(await projectDir(slug), docFile("master")));
}

let watcher: FSWatcher | null = null;
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
  const files = new Set(ALL_DOCS.map(docFile));
  watcher = watch(dir, { depth: 0, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 } });
  const onChange = async (path: string) => {
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
