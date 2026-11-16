import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from "electron";
import type { Api } from "@shared/types";

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: Api = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (patch) => ipcRenderer.invoke("settings:set", patch),
    pickWorkspace: () => ipcRenderer.invoke("settings:pickWorkspace"),
  },
  projects: {
    list: () => ipcRenderer.invoke("projects:list"),
    folders: () => ipcRenderer.invoke("projects:folders"),
    createFolder: (path) => ipcRenderer.invoke("projects:createFolder", path),
    renameFolder: (from, to) => ipcRenderer.invoke("projects:renameFolder", from, to),
    create: (title, folder) => ipcRenderer.invoke("projects:create", title, folder),
    move: (slug, folder) => ipcRenderer.invoke("projects:move", slug, folder),
    open: (slug) => ipcRenderer.invoke("projects:open", slug),
    writeDoc: (slug, doc, content) => ipcRenderer.invoke("projects:writeDoc", slug, doc, content),
    commit: (slug, message, doc) => ipcRenderer.invoke("projects:commit", slug, message, doc),
    gitLog: (slug) => ipcRenderer.invoke("projects:gitLog", slug),
    rollback: (slug, hash, doc) => ipcRenderer.invoke("projects:rollback", slug, hash, doc),
    writeMeta: (slug, meta) => ipcRenderer.invoke("projects:writeMeta", slug, meta),
    snapshot: (slug, doc, content, label) => ipcRenderer.invoke("projects:snapshot", slug, doc, content, label),
    listSnapshots: (slug, doc) => ipcRenderer.invoke("projects:listSnapshots", slug, doc),
    readSnapshot: (slug, id, doc) => ipcRenderer.invoke("projects:readSnapshot", slug, id, doc),
    reveal: (slug) => ipcRenderer.invoke("projects:reveal", slug),
    onFileChanged: (cb) => subscribe("projects:fileChanged", cb),
    addMedia: (slug, paths) => ipcRenderer.invoke("projects:addMedia", slug, paths),
    pickMedia: (slug) => ipcRenderer.invoke("projects:pickMedia", slug),
    pathForFile: (file) => webUtils.getPathForFile(file),
    mediaUrl: (slug, file) => `hmb-media://media/${encodeURIComponent(slug)}/${encodeURIComponent(file)}`,
    pickSource: () => ipcRenderer.invoke("projects:pickSource"),
  },
  pty: {
    spawn: (id, command, cwd, cols, rows) => ipcRenderer.invoke("pty:spawn", id, command, cwd, cols, rows),
    write: (id, data) => ipcRenderer.send("pty:write", id, data),
    resize: (id, cols, rows) => ipcRenderer.send("pty:resize", id, cols, rows),
    kill: (id) => ipcRenderer.send("pty:kill", id),
    onData: (cb) => subscribe("pty:data", cb),
    onExit: (cb) => subscribe("pty:exit", cb),
  },
  clipboard: {
    read: () => ipcRenderer.invoke("clipboard:read"),
    write: (text) => ipcRenderer.send("clipboard:write", text),
  },
  aside: {
    status: () => ipcRenderer.invoke("aside:status"),
    checkLogins: (platforms, profileId) => ipcRenderer.invoke("aside:checkLogins", platforms, profileId),
    openLogin: (platform, profileId) => ipcRenderer.invoke("aside:openLogin", platform, profileId),
    openImporter: (profileId) => ipcRenderer.invoke("aside:openImporter", profileId),
  },
  setup: {
    status: () => ipcRenderer.invoke("setup:status"),
    installAsideApp: () => ipcRenderer.invoke("setup:installAsideApp"),
    onProgress: (cb) => subscribe("setup:progress", cb),
  },
  publish: {
    now: (slug, platform) => ipcRenderer.invoke("publish:now", slug, platform),
    schedule: (slug, platform, at, mode) => ipcRenderer.invoke("publish:schedule", slug, platform, at, mode),
    cancel: (slug, platform) => ipcRenderer.invoke("publish:cancel", slug, platform),
    comment: (slug, platform, targetUrl) => ipcRenderer.invoke("publish:comment", slug, platform, targetUrl),
    refreshInsights: (slug, platforms) => ipcRenderer.invoke("publish:refreshInsights", slug, platforms),
    onUpdate: (cb) => subscribe("publish:update", cb),
  },
  openExternal: (url) => ipcRenderer.send("openExternal", url),
};

contextBridge.exposeInMainWorld("api", api);
