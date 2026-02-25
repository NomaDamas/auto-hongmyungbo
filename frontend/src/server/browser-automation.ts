import fs from "node:fs";
import path from "node:path";
import type { Platform } from "@/lib/types";
import type { PublishResult } from "@/server/publishers";

const PROFILE_ROOT = process.env.BROWSER_AUTOMATION_PROFILE_DIR || path.join(process.cwd(), ".browser-profiles");
const activeLoginSessions = new Set<Platform>();

type PW = {
  chromium: {
    launchPersistentContext: (userDataDir: string, options: Record<string, unknown>) => Promise<any>;
  };
};

function requirePlaywrightHint() {
  return "Playwright is not installed. Run: cd frontend && npm i playwright && npx playwright install chromium";
}

async function loadPlaywright(): Promise<PW> {
  try {
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
    const mod = (await dynamicImport("playwright")) as PW;
    return mod;
  } catch {
    throw new Error(requirePlaywrightHint());
  }
}

function userDataDir(platform: Platform): string {
  const dir = path.join(PROFILE_ROOT, platform);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function composeText(title: string, body: string): string {
  return [title, body].filter(Boolean).join("\n\n").trim();
}

function loginUrl(platform: Platform): string {
  if (platform === "twitter") return "https://x.com/login";
  if (platform === "linkedin") return "https://www.linkedin.com/login";
  if (platform === "reddit") return "https://www.reddit.com/login/";
  if (platform === "instagram") return "https://www.instagram.com/accounts/login/";
  if (platform === "threads") return "https://www.threads.net/login";
  if (platform === "youtube") return "https://accounts.google.com/signin/v2/identifier?service=youtube";
  if (platform === "tiktok") return "https://www.tiktok.com/login";
  return "about:blank";
}

export async function openBrowserLoginSession(input: { platform: Platform; waitMs?: number }): Promise<{ ok: boolean; message: string }> {
  if (activeLoginSessions.has(input.platform)) {
    return { ok: false, message: `Login session is already running for ${input.platform}. Close the existing window first.` };
  }
  activeLoginSessions.add(input.platform);
  const pw = await loadPlaywright();
  try {
    const context = await pw.chromium.launchPersistentContext(userDataDir(input.platform), {
      headless: false,
      viewport: { width: 1280, height: 900 },
    });
    let closed = false;
    context.once("close", () => {
      closed = true;
    });
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(loginUrl(input.platform), { waitUntil: "domcontentloaded" });
    const waitMs = Math.max(15_000, Math.min(300_000, input.waitMs ?? 90_000));

    // End session as soon as user closes the login window, or when timeout hits.
    await Promise.race([
      new Promise<void>((resolve) => {
        context.once("close", () => resolve());
      }),
      new Promise<void>((resolve) => {
        page.once("close", () => resolve());
      }),
      new Promise<void>((resolve) => {
        setTimeout(resolve, waitMs);
      }),
    ]);

    if (!closed) {
      await context.close();
    }
    return { ok: true, message: `Login window session finished for ${input.platform}.` };
  } finally {
    activeLoginSessions.delete(input.platform);
  }
}

async function publishTwitter(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://x.com/compose/post", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const editor = page.locator('div[role="textbox"][data-testid="tweetTextarea_0"]');
  if (!(await editor.count())) return { ok: false, error: "X compose box not found. Login may be required." };
  await editor.first().fill(text);
  const btn = page.locator('[data-testid="tweetButtonInline"]');
  if (!(await btn.count())) return { ok: false, error: "X publish button not found." };
  await btn.first().click();
  return { ok: true };
}

async function publishLinkedIn(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const startBtn = page.locator('button:has-text("Start a post"), button:has-text("Create a post")');
  if (!(await startBtn.count())) return { ok: false, error: "LinkedIn post composer not found. Login may be required." };
  await startBtn.first().click();
  await page.waitForTimeout(1200);
  const editor = page.locator('[contenteditable="true"]');
  if (!(await editor.count())) return { ok: false, error: "LinkedIn editor not found." };
  await editor.first().fill(text);
  const postBtn = page.locator('button:has-text("Post")');
  if (!(await postBtn.count())) return { ok: false, error: "LinkedIn Post button not found." };
  await postBtn.last().click();
  return { ok: true };
}

async function publishReddit(page: any, title: string, body: string): Promise<PublishResult> {
  const sr = process.env.REDDIT_SUBREDDIT || "";
  if (!sr) return { ok: false, error: "REDDIT_SUBREDDIT is required for browser automation." };
  await page.goto(`https://www.reddit.com/r/${sr}/submit`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const titleInput = page.locator('textarea[name="title"], textarea[placeholder*="Title"]');
  if (!(await titleInput.count())) return { ok: false, error: "Reddit title input not found. Login may be required." };
  await titleInput.first().fill(title || "Post");
  const bodyInput = page.locator('div[role="textbox"], textarea[name="text"]');
  if (await bodyInput.count()) {
    await bodyInput.first().fill(body || title);
  }
  const postBtn = page.locator('button:has-text("Post"), button:has-text("Submit")');
  if (!(await postBtn.count())) return { ok: false, error: "Reddit Post button not found." };
  await postBtn.first().click();
  return { ok: true };
}

async function publishThreads(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.threads.net/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const start = page.locator('button:has-text("Start a thread"), a:has-text("Start a thread")');
  if (await start.count()) await start.first().click();
  const editor = page.locator('div[contenteditable="true"], textarea');
  if (!(await editor.count())) return { ok: false, error: "Threads editor not found. Login may be required." };
  await editor.first().fill(text);
  const postBtn = page.locator('button:has-text("Post"), button:has-text("Share")');
  if (!(await postBtn.count())) return { ok: false, error: "Threads Post button not found." };
  await postBtn.first().click();
  return { ok: true };
}

async function publishInstagram(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { ok: false, error: "Instagram browser auto-post requires media upload flow and is not yet implemented." };
}

async function publishYouTube(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://studio.youtube.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { ok: false, error: "YouTube browser auto-post requires Community/Upload flow and is not yet implemented." };
}

async function publishTikTok(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.tiktok.com/upload", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { ok: false, error: "TikTok browser auto-post requires video upload flow and is not yet implemented." };
}

export async function publishByBrowser(input: { platform: Platform; title: string; body: string }): Promise<PublishResult> {
  const pw = await loadPlaywright();
  const context = await pw.chromium.launchPersistentContext(userDataDir(input.platform), {
    headless: String(process.env.BROWSER_AUTOMATION_HEADLESS || "").toLowerCase() === "true",
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const text = composeText(input.title, input.body);
  try {
    if (input.platform === "twitter") return await publishTwitter(page, text);
    if (input.platform === "linkedin") return await publishLinkedIn(page, text);
    if (input.platform === "reddit") return await publishReddit(page, input.title, input.body);
    if (input.platform === "threads") return await publishThreads(page, text);
    if (input.platform === "instagram") return await publishInstagram(page, text);
    if (input.platform === "youtube") return await publishYouTube(page, text);
    if (input.platform === "tiktok") return await publishTikTok(page, text);
    return { ok: false, error: `Unsupported platform: ${input.platform}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await context.close();
  }
}
