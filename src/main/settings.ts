import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessConfig, Settings } from "@shared/types";
import { DEFAULT_PLATFORMS } from "@shared/platforms";

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
      { id: "claude-code", label: "Claude Code", command: "claude", addDirFlag: "--add-dir" },
      { id: "codex", label: "Codex", command: "codex", addDirFlag: "--add-dir" },
      { id: "omp", label: "omp", command: "omp", addDirFlag: "--add-dir=" },
    ],
    platforms: [...DEFAULT_PLATFORMS],
    theme: "dark",
    asideProfileId: "",
    dockGroups: [
      { id: "web", title: "Web", color: "blue", collapsed: false, tabIds: ["web:chatgpt", "web:claude", "web:gemini"] },
      { id: "cli", title: "CLI", color: "green", collapsed: false, tabIds: ["harness:claude-code", "harness:codex", "harness:omp"] },
    ],
    onboarded: false,
  };
}

function withHarnessDefaults(settings: Settings): Settings {
  const defaults = defaultSettings();
  const harnesses: HarnessConfig[] = settings.harnesses.map((harness) => ({
    ...harness,
    addDirFlag: harness.addDirFlag ?? defaults.harnesses.find((item) => item.id === harness.id)?.addDirFlag,
  }));
  return { ...settings, harnesses };
}

let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  const defaults = defaultSettings();
  try {
    const loaded = JSON.parse(await readFile(file(), "utf8")) as Partial<Settings>;
    cache = withHarnessDefaults({ ...defaults, ...loaded });
  } catch {
    cache = defaults;
  }
  await mkdir(cache.workspaceRoot, { recursive: true });
  return cache;
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = withHarnessDefaults({ ...(await getSettings()), ...patch });
  await mkdir(app.getPath("userData"), { recursive: true });
  await writeFile(file(), JSON.stringify(next, null, 2));
  await mkdir(next.workspaceRoot, { recursive: true });
  cache = next;
  return next;
}
