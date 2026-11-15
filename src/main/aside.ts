import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import type { AsideLoginState, AsideStatus, PlatformId } from "@shared/types";
import { ALL_PLATFORMS, PLATFORMS } from "@shared/platforms";

/**
 * Bridge to the Aside browser through its official CLI only.
 *
 * Security model: Aside owns every platform login (its own browser profile, Apple
 * Passwords autofill, 2FA). This app never reads ~/.aside/cli/auth.json, cookies, or
 * passwords. It runs `aside` with execFile (no shell), passes only fixed URLs from the
 * PLATFORMS registry into REPL scripts, and forwards a whitelist of non-secret status fields.
 */

/** Final URLs that mean "not signed in" after following redirects (incl. nid.naver.com, tistory auth, HN login, medium signin). */
const LOGGED_OUT = /\/(login|signin|signup|authwall|uas\/login|i\/flow\/login|accounts\/login|checkpoint|nidlogin\.login|auth\/login|m\/signin)\b|[?&]__coig_login=|^https:\/\/nid\.naver\.com\//i;

const ASIDE_BUNDLE_ID = "at.studio.AsideBrowser";

let binCache: string | null = null;

export async function asideBin(): Promise<string | null> {
  if (binCache) return binCache;
  const candidates = [join(homedir(), ".local/bin/aside"), "/opt/homebrew/bin/aside", "/usr/local/bin/aside"];
  for (const c of candidates) {
    if (await access(c, constants.X_OK).then(() => true, () => false)) return (binCache = c);
  }
  // Custom install location: ask the login shell once.
  const shell = process.env.SHELL || userInfo().shell || "/bin/zsh";
  const found = await run(shell, ["-l", "-c", "command -v aside"], { timeoutMs: 5000 }).catch(() => null);
  const path = found?.stdout.trim();
  return path ? (binCache = path) : null;
}

interface RunResult {
  stdout: string;
  stderr: string;
}

function run(file: string, args: string[], opts: { input?: string; timeoutMs: number }): Promise<RunResult> {
  const { promise, resolve, reject } = Promise.withResolvers<RunResult>();
  const child = execFile(file, args, { timeout: opts.timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) reject(Object.assign(err, { stdout, stderr }));
    else resolve({ stdout, stderr });
  });
  if (opts.input !== undefined) {
    child.stdin?.end(opts.input);
  }
  return promise;
}

function profileArgs(profileId?: string): string[] {
  return profileId ? ["--profile", profileId] : [];
}

/** Run a REPL script; `RESULT<json>` on stdout carries the return value. */
async function repl<T>(script: string, profileId: string | undefined, timeoutMs: number): Promise<T> {
  const bin = await asideBin();
  if (!bin) throw new Error("Aside CLI가 설치되어 있지 않습니다.");
  const { stdout } = await run(bin, ["repl", "--json", "--file", "-", ...profileArgs(profileId)], { input: script, timeoutMs });
  const out = JSON.parse(stdout) as { run: { content: { text: string }[]; error: unknown } };
  if (out.run.error) throw new Error(`Aside REPL: ${JSON.stringify(out.run.error)}`);
  const text = out.run.content.map((c) => c.text).join("\n");
  const at = text.lastIndexOf("RESULT");
  if (at < 0) throw new Error("Aside REPL returned no result");
  return JSON.parse(text.slice(at + "RESULT".length)) as T;
}

export async function asideStatus(): Promise<AsideStatus> {
  const bin = await asideBin();
  if (!bin) return { installed: false, signedIn: false, profiles: [] };
  const [acct, prof] = await Promise.all([
    run(bin, ["account", "status", "--json"], { timeoutMs: 15000 }).catch(() => null),
    run(bin, ["host", "profiles", "--json"], { timeoutMs: 15000 }).catch(() => null),
  ]);
  const account = acct ? (JSON.parse(acct.stdout).account as Record<string, unknown> | undefined) : undefined;
  const profiles = prof
    ? ((JSON.parse(prof.stdout).profiles ?? []) as { profileId: string; label: string; connected: boolean }[]).map((p) => ({
        id: p.profileId,
        label: p.label,
        connected: p.connected,
      }))
    : [];
  return {
    installed: true,
    signedIn: account?.authStatus === "active",
    email: typeof account?.email === "string" ? account.email : undefined,
    name: typeof account?.name === "string" ? account.name : undefined,
    profiles,
  };
}

/** Navigate each platform's signed-in-only page in Aside and classify the final URL. Read-only. */
export async function asideCheckLogins(platforms: PlatformId[], profileId?: string): Promise<Partial<Record<PlatformId, AsideLoginState>>> {
  const targets = platforms.filter((p) => ALL_PLATFORMS.includes(p)).map((p) => [p, PLATFORMS[p].probeUrl]);
  const script = `
    const targets = ${JSON.stringify(targets)};
    const out = {};
    for (const [id, url] of targets) {
      let tab = null;
      try {
        tab = await openTab(url);
        await sleep(3500);
        out[id] = tab.url();
      } catch (e) {
        out[id] = "error:" + String(e?.message ?? e);
      } finally {
        if (tab) await closeTab(tab).catch(() => {});
      }
    }
    console.log("RESULT" + JSON.stringify(out));
  `;
  const urls = await repl<Record<string, string>>(script, profileId, 30000 + targets.length * 15000);
  const result: Partial<Record<PlatformId, AsideLoginState>> = {};
  for (const [id, url] of Object.entries(urls)) {
    result[id as PlatformId] = url.startsWith("error:") ? "error" : LOGGED_OUT.test(url) ? "signed-out" : "signed-in";
  }
  return result;
}

/** Open the platform's login page in the Aside browser (tab stays open) and bring Aside to the front. */
export async function asideOpenLogin(platform: PlatformId, profileId?: string): Promise<void> {
  if (!ALL_PLATFORMS.includes(platform)) throw new Error(`unknown platform: ${platform}`);
  await repl(`await openTab(${JSON.stringify(PLATFORMS[platform].loginUrl)}); console.log("RESULT" + "true");`, profileId, 30000);
  await run("/usr/bin/open", ["-b", ASIDE_BUNDLE_ID], { timeoutMs: 5000 }).catch(() => undefined);
}

/**
 * Open Aside's built-in importer (chrome://aside-import-data/). Aside itself migrates
 * logins/cookies from Chrome, Safari, Firefox, Arc into its own profile; we only open the page.
 */
export async function asideOpenImporter(profileId?: string): Promise<void> {
  await repl(`await openTab("chrome://aside-import-data/"); console.log("RESULT" + "true");`, profileId, 30000);
  await run("/usr/bin/open", ["-b", ASIDE_BUNDLE_ID], { timeoutMs: 5000 }).catch(() => undefined);
}
