import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Settings } from "@shared/types";
import { ALL_PLATFORMS } from "@shared/platforms";

const file = () => join(app.getPath("userData"), "settings.json");

export function defaultSettings(): Settings {
  return {
    workspaceRoot: join(app.getPath("documents"), "HongMyungbo"),
    webTabs: [
      { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
      { id: "claude", label: "Claude", url: "https://claude.ai/new" },
      { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
    ],
    harnesses: [
      { id: "claude-code", label: "Claude Code", command: "claude" },
      { id: "codex", label: "Codex", command: "codex" },
      { id: "omp", label: "omp", command: "omp" },
    ],
    platforms: [...ALL_PLATFORMS],
    theme: "dark",
    asideProfileId: "",
  };
}

let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  try {
    cache = { ...defaultSettings(), ...JSON.parse(await readFile(file(), "utf8")) } as Settings;
  } catch {
    cache = defaultSettings();
  }
  await mkdir(cache.workspaceRoot, { recursive: true });
  return cache;
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(file(), JSON.stringify(next, null, 2));
  await mkdir(next.workspaceRoot, { recursive: true });
  cache = next;
  return next;
}
