import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessConfig, ProviderConfig, ProviderEffort, ProviderKind, Settings } from "@shared/types";
import { DEFAULT_PLATFORMS } from "@shared/platforms";

const file = () => join(app.getPath("userData"), "settings.json");

export function defaultSettings(): Settings {
  const harnesses: HarnessConfig[] = [
    { id: "claude-code", label: "Claude Code", command: "claude", addDirFlag: "--add-dir" },
    { id: "codex", label: "Codex", command: "codex", addDirFlag: "--add-dir" },
    { id: "omp", label: "omp", command: "omp", addDirFlag: "--add-dir=" },
  ];
  const providers: ProviderConfig[] = [
    ...harnesses.map((harness) => ({
      id: harness.id,
      label: harness.label,
      kind: "cli" as const,
      command: harness.command,
      timeoutMs: 600000,
      retries: 0,
      skills: [],
      enabled: true,
    })),
    { id: "chatgpt", label: "ChatGPT Web", kind: "web", url: "https://chatgpt.com/", timeoutMs: 600000, retries: 1, skills: [], enabled: true },
    { id: "claude-web", label: "Claude Web", kind: "web", url: "https://claude.ai/new", timeoutMs: 600000, retries: 1, skills: [], enabled: true },
    { id: "gemini", label: "Gemini Web", kind: "web", url: "https://gemini.google.com/app", timeoutMs: 600000, retries: 1, skills: [], enabled: true },
  ];
  return {
    workspaceRoot: join(app.getPath("documents"), "HongMyungbo"),
    webTabs: [
      { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
      { id: "claude", label: "Claude", url: "https://claude.ai/new" },
      { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
    ],
    harnesses,
    providers,
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

const providerKinds: ProviderKind[] = ["cli", "web", "browser", "custom"];
const providerEfforts: ProviderEffort[] = ["low", "medium", "high", "xhigh"];

function normalizeProvider(value: unknown, fallback: ProviderConfig): ProviderConfig {
  if (!value || typeof value !== "object") return fallback;
  const input = value as Partial<ProviderConfig>;
  const kind = providerKinds.includes(input.kind as ProviderKind) ? input.kind as ProviderKind : fallback.kind;
  const effort = providerEfforts.includes(input.effort as ProviderEffort) ? input.effort as ProviderEffort : fallback.effort;
  const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) ? Math.min(Math.max(Math.round(input.timeoutMs), 1000), 3600000) : fallback.timeoutMs;
  const retries = typeof input.retries === "number" && Number.isFinite(input.retries) ? Math.min(Math.max(Math.round(input.retries), 0), 5) : fallback.retries;
  const skills = Array.isArray(input.skills) ? input.skills.filter((skill): skill is string => typeof skill === "string").map((skill) => skill.trim()).filter(Boolean).slice(0, 50) : fallback.skills;
  return {
    ...fallback,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim().slice(0, 80) : fallback.label,
    kind,
    command: typeof input.command === "string" ? input.command.trim() || undefined : fallback.command,
    url: typeof input.url === "string" ? input.url.trim() || undefined : fallback.url,
    model: typeof input.model === "string" ? input.model.trim() || undefined : fallback.model,
    effort,
    timeoutMs,
    retries,
    skills,
    browserProfileId: typeof input.browserProfileId === "string" ? input.browserProfileId.trim() || undefined : fallback.browserProfileId,
    enabled: typeof input.enabled === "boolean" ? input.enabled : fallback.enabled,
  };
}

function withHarnessDefaults(settings: Settings): Settings {
  const defaults = defaultSettings();
  const harnesses: HarnessConfig[] = settings.harnesses.map((harness) => ({
    ...harness,
    addDirFlag: harness.addDirFlag ?? defaults.harnesses.find((item) => item.id === harness.id)?.addDirFlag,
  }));
  const loadedProviders = Array.isArray(settings.providers) ? settings.providers : [];
  const providers = defaults.providers.map((fallback) => normalizeProvider(loadedProviders.find((item) => item?.id === fallback.id), fallback));
  for (const item of loadedProviders) {
    if (!item || defaults.providers.some((provider) => provider.id === item.id)) continue;
    const normalized = normalizeProvider(item, {
      id: typeof item.id === "string" ? item.id.trim().slice(0, 80) : "custom",
      label: typeof item.label === "string" ? item.label : "Custom provider",
      kind: "custom",
      timeoutMs: 600000,
      retries: 0,
      skills: [],
      enabled: true,
    });
    if (normalized.id && !providers.some((provider) => provider.id === normalized.id)) providers.push(normalized);
  }
  return { ...settings, harnesses, providers };
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
