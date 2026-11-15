import { app, BrowserWindow, clipboard, dialog, ipcMain, session, shell } from "electron";
import { join } from "node:path";
import type { DocId, PlatformId, ProjectMeta, Settings } from "@shared/types";
import { getSettings, setSettings } from "./settings";
import {
  createProject,
  listProjects,
  listSnapshots,
  openProject,
  readSnapshot,
  revealProject,
  setChangeSink,
  snapshot,
  writeDoc,
  writeMeta,
} from "./projects";
import { killAllPtys, killPty, resizePty, spawnPty, writePty } from "./pty";
import { asideCheckLogins, asideOpenLogin, asideStatus } from "./aside";

// HMB_USER_DATA isolates settings/logins (second profile or a clean test run).
if (process.env.HMB_USER_DATA) app.setPath("userData", process.env.HMB_USER_DATA);

/** Shared login partition for every embedded AI web tab, persisted across restarts. */
const WEB_PARTITION = "persist:ai-web";

/**
 * Some AI sites (and Google sign-in) reject UAs containing "Electron".
 * Present the same Chrome UA without the Electron token.
 */
function chromeUserAgent(): string {
  return session.defaultSession.getUserAgent().replace(/\s?Electron\/\S+/, "").replace(/\s?auto-hongmyungbo\/\S+/, "");
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: "#0b0b0f",
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

  // Embedded AI tabs: keep OAuth popups (Google/Apple sign-in) in-app on the same
  // partition so the session lands in the webview; plain links go to the browser.
  win.webContents.on("did-attach-webview", (_e, wc) => {
    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (disposition === "foreground-tab" || disposition === "background-tab") {
        void shell.openExternal(url);
        return { action: "deny" };
      }
      return {
        action: "allow",
        overrideBrowserWindowOptions: { width: 520, height: 720, webPreferences: { partition: WEB_PARTITION } },
      };
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
  ipcMain.handle("projects:create", (_e, title: string) => createProject(title));
  ipcMain.handle("projects:open", (_e, slug: string) => openProject(slug));
  ipcMain.handle("projects:writeDoc", (_e, slug: string, doc: DocId, content: string) => writeDoc(slug, doc, content));
  ipcMain.handle("projects:writeMeta", (_e, slug: string, meta: ProjectMeta) => writeMeta(slug, meta));
  ipcMain.handle("projects:snapshot", (_e, slug: string, doc: DocId, content: string, label: string) =>
    snapshot(slug, doc, content, label),
  );
  ipcMain.handle("projects:listSnapshots", (_e, slug: string, doc: DocId) => listSnapshots(slug, doc));
  ipcMain.handle("projects:readSnapshot", (_e, slug: string, id: string, doc: DocId) => readSnapshot(slug, id, doc));
  ipcMain.handle("projects:reveal", (_e, slug: string) => revealProject(slug));

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

  ipcMain.on("openExternal", (_e, url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  session.fromPartition(WEB_PARTITION).setUserAgent(chromeUserAgent());
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", killAllPtys);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
