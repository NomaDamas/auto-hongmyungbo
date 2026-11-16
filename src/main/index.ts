import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, net, protocol, session, shell } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { DocId, PlatformId, ProjectMeta, Settings } from "@shared/types";
import { getSettings, setSettings } from "./settings";
import {
  addMedia,
  createFolder,
  createProject,
  commitProject,
  gitLog,
  listFolders,
  listProjects,
  listSnapshots,
  moveProject,
  openProject,
  pickMedia,
  pickSource,
  readSnapshot,
  renameFolder,
  resolveMediaFile,
  rollbackProject,
  revealProject,
  setChangeSink,
  snapshot,
  writeDoc,
  writeMeta,
} from "./projects";
import { killAllPtys, killPty, resizePty, spawnPty, writePty } from "./pty";
import { asideCheckLogins, asideOpenImporter, asideOpenLogin, asideStatus } from "./aside";
import { installAsideApp, setupStatus } from "./setup";
import { cancelPublish, initPublishing, publishComment, publishNow, refreshInsights, schedulePublish, shutdownPublishing } from "./publish";

// HMB_USER_DATA isolates settings/logins (second profile or a clean test run).
if (process.env.HMB_USER_DATA) app.setPath("userData", process.env.HMB_USER_DATA);

protocol.registerSchemesAsPrivileged([
  { scheme: "hmb-media", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

/** Shared login partition for every embedded AI web tab, persisted across restarts. */
const WEB_PARTITION = "persist:ai-web";

/**
 * Some AI sites (and Google sign-in) reject UAs containing "Electron".
 * Present the same Chrome UA without the Electron token.
 */
function chromeUserAgent(): string {
  return session.defaultSession.getUserAgent().replace(/\s?Electron\/\S+/i, "").replace(/\s?auto-hongmyungbo\/\S+/i, "");
}

function isGoogleAuthUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return /(^|\.)accounts\.google\.com$|(^|\.)oauth2?\.googleapis\.com$|(^|\.)google\.com$/.test(host) &&
      /\/signin|\/oauth|\/auth|\/v[0-9]+\/auth|accounts\.google\.com/i.test(url);
  } catch {
    return false;
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#09090b" : "#fafafa",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      webviewTag: true,
      contextIsolation: true,
    },
  });

  setChangeSink(win.webContents);

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Google explicitly rejects embedded WebView OAuth. Send Google auth to the system browser;
  // never attempt to spoof it or copy credentials/cookies back into the app.
  win.webContents.on("did-attach-webview", (_e, wc) => {
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (isGoogleAuthUrl(url) || disposition === "foreground-tab" || disposition === "background-tab") {
        void shell.openExternal(url);
        return { action: "deny" };
      }
      return { action: "allow", overrideBrowserWindowOptions: { width: 520, height: 720, webPreferences: { partition: WEB_PARTITION } } };
    });
    wc.on("will-navigate", (event, url) => {
      if (isGoogleAuthUrl(url)) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    });
    wc.on("will-redirect", (event, url) => {
      if (isGoogleAuthUrl(url)) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    });
  });

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, "../renderer/index.html"));
}

function registerIpc(): void {
  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:set", (_e, patch: Partial<Settings>) => setSettings(patch));
  ipcMain.handle("settings:pickWorkspace", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return null;
    return setSettings({ workspaceRoot: r.filePaths[0] });
  });

  ipcMain.handle("projects:list", () => listProjects());
  ipcMain.handle("projects:folders", () => listFolders());
  ipcMain.handle("projects:createFolder", (_e, path: string) => createFolder(path));
  ipcMain.handle("projects:renameFolder", (_e, from: string, to: string) => renameFolder(from, to));
  ipcMain.handle("projects:create", (_e, title: string, folder: string) => createProject(title, folder));
  ipcMain.handle("projects:move", (_e, slug: string, folder: string) => moveProject(slug, folder));
  ipcMain.handle("projects:open", (_e, slug: string) => openProject(slug));
  ipcMain.handle("projects:writeDoc", (_e, slug: string, doc: DocId, content: string) => writeDoc(slug, doc, content));
  ipcMain.handle("projects:commit", (_e, slug: string, message: string) => commitProject(slug, message));
  ipcMain.handle("projects:gitLog", (_e, slug: string) => gitLog(slug));
  ipcMain.handle("projects:rollback", (_e, slug: string, hash: string) => rollbackProject(slug, hash));
  ipcMain.handle("projects:writeMeta", (_e, slug: string, meta: ProjectMeta) => writeMeta(slug, meta));
  ipcMain.handle("projects:snapshot", (_e, slug: string, doc: DocId, content: string, label: string) =>
    snapshot(slug, doc, content, label),
  );
  ipcMain.handle("projects:listSnapshots", (_e, slug: string, doc: DocId) => listSnapshots(slug, doc));
  ipcMain.handle("projects:readSnapshot", (_e, slug: string, id: string, doc: DocId) => readSnapshot(slug, id, doc));
  ipcMain.handle("projects:reveal", (_e, slug: string) => revealProject(slug));
  ipcMain.handle("projects:addMedia", (_e, slug: string, paths: string[]) => addMedia(slug, paths));
  ipcMain.handle("projects:pickMedia", (_e, slug: string) => pickMedia(slug));
  ipcMain.handle("projects:pickSource", () => pickSource());

  ipcMain.handle("pty:spawn", (e, id: string, command: string, cwd: string, cols: number, rows: number) =>
    spawnPty(e.sender, id, command, cwd, cols, rows),
  );
  ipcMain.on("pty:write", (_e, id: string, data: string) => writePty(id, data));
  ipcMain.on("pty:resize", (_e, id: string, cols: number, rows: number) => resizePty(id, cols, rows));
  ipcMain.on("pty:kill", (_e, id: string) => killPty(id));

  ipcMain.handle("clipboard:read", () => clipboard.readText());
  ipcMain.on("clipboard:write", (_e, text: string) => clipboard.writeText(text));

  ipcMain.handle("aside:status", () => asideStatus());
  ipcMain.handle("aside:checkLogins", (_e, platforms: PlatformId[], profileId?: string) => asideCheckLogins(platforms, profileId));
  ipcMain.handle("aside:openLogin", (_e, platform: PlatformId, profileId?: string) => asideOpenLogin(platform, profileId));
  ipcMain.handle("aside:openImporter", (_e, profileId?: string) => asideOpenImporter(profileId));

  ipcMain.handle("setup:status", () => setupStatus());
  ipcMain.handle("setup:installAsideApp", () => installAsideApp());
  ipcMain.handle("publish:now", (_e, slug: string, platform: PlatformId) => publishNow(slug, platform));
  ipcMain.handle("publish:schedule", (_e, slug: string, platform: PlatformId, at: string, mode: "aside-native" | "app") =>
    schedulePublish(slug, platform, at, mode),
  );
  ipcMain.handle("publish:cancel", (_e, slug: string, platform: PlatformId) => cancelPublish(slug, platform));
  ipcMain.handle("publish:comment", (_e, slug: string, platform: PlatformId, targetUrl?: string) => publishComment(slug, platform, targetUrl));
  ipcMain.handle("publish:refreshInsights", (_e, slug: string, platforms: PlatformId[]) => refreshInsights(slug, platforms));

  ipcMain.on("openExternal", (_e, url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });
}

app.whenReady().then(async () => {
  protocol.handle("hmb-media", async (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.slice(1).split("/");
      if (url.hostname !== "media" || parts.length !== 2) return new Response("Not found", { status: 404 });
      const file = await resolveMediaFile(decodeURIComponent(parts[0]), decodeURIComponent(parts[1]));
      return net.fetch(pathToFileURL(file).toString());
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  session.fromPartition(WEB_PARTITION).setUserAgent(chromeUserAgent());
  await initPublishing();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  killAllPtys();
  void shutdownPublishing();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
