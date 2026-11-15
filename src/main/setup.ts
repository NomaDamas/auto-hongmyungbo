import { BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, open, readdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir, tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import type { SetupStatus } from "@shared/types";
import { asideBin } from "./aside";
import { getSettings } from "./settings";

const ASIDE_VERSION = "1.0.1022.1";
const ASIDE_BUNDLE_ID = "at.studio.AsideBrowser";
/** Apple Developer Team of At Your Side Inc. (from the shipped Aside.app). */
const ASIDE_TEAM_ID = "8CPD4K4TBB";

/** Refuse to install anything that is not Aside.app with a valid signature from Aside's team. */
async function verifyAsideSignature(appPath: string): Promise<void> {
  await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", appPath], 120000);
  const { stderr } = await run("/usr/bin/codesign", ["-dv", appPath], 15000);
  const team = /^TeamIdentifier=(\S+)$/m.exec(stderr)?.[1];
  const bundle = /^Identifier=(\S+)$/m.exec(stderr)?.[1];
  if (team !== ASIDE_TEAM_ID || bundle !== ASIDE_BUNDLE_ID) throw new Error(`Aside 서명이 일치하지 않습니다 (team=${team}, id=${bundle}).`);
}

function progress(step: string, pct?: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send("setup:progress", { step, pct });
  }
}

function run(file: string, args: string[], timeoutMs = 15000): Promise<{ stdout: string; stderr: string }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ stdout: string; stderr: string }>();
  execFile(file, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) reject(Object.assign(error, { stdout, stderr }));
    else resolve({ stdout, stderr });
  });
  return promise;
}

async function executableOnLoginPath(command: string): Promise<boolean> {
  const executable = command.trim().split(/\s+/, 1)[0];
  if (!executable) return false;
  const shell = process.env.SHELL || userInfo().shell || "/bin/zsh";
  return run(shell, ["-l", "-c", 'command -v "$1"', "hmb-setup", executable], 5000).then(
    (result) => Boolean(result.stdout.trim()),
    () => false,
  );
}

export async function setupStatus(): Promise<SetupStatus> {
  const settings = await getSettings();
  const bin = await asideBin();
  const appPaths = ["/Applications/Aside.app", join(homedir(), "Applications/Aside.app")];
  const appChecks = await Promise.all(appPaths.map((path) => access(path, constants.F_OK).then(() => true, () => false)));
  let asideSignedIn = false;
  if (bin) {
    try {
      const { stdout } = await run(bin, ["account", "status", "--json"]);
      const parsed = JSON.parse(stdout) as unknown;
      if (parsed && typeof parsed === "object" && "account" in parsed) {
        const account = parsed.account;
        asideSignedIn = Boolean(
          account && typeof account === "object" && "authStatus" in account && account.authStatus === "active",
        );
      }
    } catch {
      asideSignedIn = false;
    }
  }
  const harnessEntries = await Promise.all(
    settings.harnesses.map(async (harness) => [harness.id, await executableOnLoginPath(harness.command)] as const),
  );
  return {
    asideApp: appChecks.some(Boolean),
    asideCli: Boolean(bin),
    asideSignedIn,
    harnesses: Object.fromEntries(harnessEntries),
  };
}

async function bundledDmg(): Promise<string | null> {
  const dir = join(process.resourcesPath, "vendor");
  const name = (await readdir(dir).catch(() => [] as string[])).find((file) => /^Aside-.*\.dmg$/i.test(file));
  return name ? join(dir, name) : null;
}

async function downloadDmg(destination: string): Promise<void> {
  const architecture = process.arch === "arm64" ? "arm64" : "x64";
  const url = `https://releases.aside.com/dev-updater/Aside-${ASIDE_VERSION}-${architecture}.dmg`;
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Aside 다운로드 실패: HTTP ${response.status}`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const output = await open(destination, "w");
  let received = 0;
  progress("download", 0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await output.writeFile(value);
      received += value.byteLength;
      progress("download", total ? Math.min(99, Math.round((received / total) * 100)) : undefined);
    }
  } finally {
    await output.close();
  }
  progress("download", 100);
}

export async function installAsideApp(): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), "hmb-aside-"));
  const mountPoint = join(temp, "mount");
  let mounted = false;
  try {
    let dmg = await bundledDmg();
    if (!dmg) {
      dmg = join(temp, "Aside.dmg");
      await downloadDmg(dmg);
    }
    await mkdir(mountPoint, { recursive: true });
    progress("mount");
    await run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-readonly", "-mountpoint", mountPoint, dmg], 120000);
    mounted = true;
    progress("verify");
    await verifyAsideSignature(join(mountPoint, "Aside.app"));
    progress("install");
    try {
      await run("/usr/bin/ditto", [join(mountPoint, "Aside.app"), "/Applications/Aside.app"], 120000);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const message = String(error);
      if (code !== "EACCES" && !/EACCES|permission denied|not permitted/i.test(message)) throw error;
      const userApplications = join(homedir(), "Applications");
      await mkdir(userApplications, { recursive: true });
      await run("/usr/bin/ditto", [join(mountPoint, "Aside.app"), join(userApplications, "Aside.app")], 120000);
    }
    progress("install", 100);
    await run("/usr/bin/hdiutil", ["detach", mountPoint], 30000);
    mounted = false;
    progress("launch");
    await run("/usr/bin/open", ["-b", ASIDE_BUNDLE_ID], 15000);
  } finally {
    if (mounted) await run("/usr/bin/hdiutil", ["detach", mountPoint], 30000).catch(() => undefined);
    await rm(temp, { recursive: true, force: true }).catch(() => undefined);
  }
}
