import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
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
    create: (title) => ipcRenderer.invoke("projects:create", title),
    open: (slug) => ipcRenderer.invoke("projects:open", slug),
    writeDoc: (slug, doc, content) => ipcRenderer.invoke("projects:writeDoc", slug, doc, content),
    writeMeta: (slug, meta) => ipcRenderer.invoke("projects:writeMeta", slug, meta),
    snapshot: (slug, doc, content, label) => ipcRenderer.invoke("projects:snapshot", slug, doc, content, label),
    listSnapshots: (slug, doc) => ipcRenderer.invoke("projects:listSnapshots", slug, doc),
    readSnapshot: (slug, id, doc) => ipcRenderer.invoke("projects:readSnapshot", slug, id, doc),
    reveal: (slug) => ipcRenderer.invoke("projects:reveal", slug),
    onFileChanged: (cb) => subscribe("projects:fileChanged", cb),
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
  },
  openExternal: (url) => ipcRenderer.send("openExternal", url),
};

contextBridge.exposeInMainWorld("api", api);
