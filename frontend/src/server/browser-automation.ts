import fs from "node:fs";
import path from "node:path";
import type { DomLlmProvider, Platform } from "@/lib/types";
import type { PublishResult } from "@/server/publishers";

export type LlmClient = {
  provider: DomLlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
};

// Cheapest model per provider for DOM analysis
const DOM_CHEAP_MODELS: Record<DomLlmProvider, string> = {
  openai: "gpt-4o-mini",
  openrouter: "openai/gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  grok: "grok-3-mini-fast",
  gemini: "gemini-2.0-flash",
};

const DOM_BASE_URLS: Record<DomLlmProvider, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com",
  grok: "https://api.x.ai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
};

/**
 * Unified chat function that handles both OpenAI-compatible and Anthropic APIs.
 * Returns the assistant's text content.
 */
async function chatForDom(
  client: LlmClient,
  system: string,
  user: string,
): Promise<string> {
  if (client.provider === "anthropic") {
    // Anthropic Messages API
    const res = await fetch(`${client.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": client.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: client.model,
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`);
    const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    return json.content?.find((b) => b.type === "text")?.text || "{}";
  }

  // OpenAI-compatible API (openai, openrouter, grok, gemini)
  const res = await fetch(`${client.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${client.apiKey}`,
    },
    body: JSON.stringify({
      model: client.model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content || "{}";
}

function parseJsonSafe(raw: string): Record<string, unknown> {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  try {
    return JSON.parse(match ? match[1].trim() : raw.trim());
  } catch {
    return {};
  }
}

export { DOM_CHEAP_MODELS, DOM_BASE_URLS };

const PROFILE_ROOT = process.env.BROWSER_AUTOMATION_PROFILE_DIR || path.join(process.cwd(), ".browser-profiles");
const activeLoginSessions = new Set<Platform>();
const activePublishSessions = new Map<Platform, { context: any; browser: any | null }>();

type PW = {
  chromium: {
    launchPersistentContext: (userDataDir: string, options: Record<string, unknown>) => Promise<any>;
    launch?: (options: Record<string, unknown>) => Promise<any>;
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

function profilePath(platform: Platform): string {
  return path.join(PROFILE_ROOT, platform);
}

function composeText(title: string, body: string): string {
  return [title, body].filter(Boolean).join("\n\n").trim();
}

async function captureScreenshotDataUrl(page: any): Promise<string | undefined> {
  try {
    if (!page) return undefined;
    const shot = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });
    return `data:image/jpeg;base64,${Buffer.from(shot).toString("base64")}`;
  } catch {
    return undefined;
  }
}

function resolveInstagramMediaPath(): string | null {
  const raw = (process.env.INSTAGRAM_MEDIA_PATH || "").trim();
  if (!raw) return null;
  const full = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  if (stat.isFile()) return full;
  if (stat.isDirectory()) {
    const candidates = fs
      .readdirSync(full)
      .filter((name) => /\.(png|jpe?g|webp|mp4)$/i.test(name))
      .map((name) => path.join(full, name));
    return candidates[0] || null;
  }
  return null;
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

function isProfileInUseError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return msg.includes("processsingleton") || msg.includes("singletonlock") || msg.includes("profile is already in use");
}

async function closeActivePublishSession(platform: Platform): Promise<void> {
  const active = activePublishSessions.get(platform);
  if (!active) return;
  try {
    if (active.context) await active.context.close();
  } catch {
    // no-op
  }
  try {
    if (active.browser) await active.browser.close();
  } catch {
    // no-op
  }
  activePublishSessions.delete(platform);
}

async function isBrowserLoginVerified(page: any, platform: Platform): Promise<boolean> {
  const hasAuthCookie = async (url: string, cookieNames: string[]) => {
    try {
      const cookies = (await page.context().cookies(url)) as Array<{ name?: string; value?: string }>;
      return cookies.some((c) => c.name && cookieNames.includes(c.name) && String(c.value || "").length > 0);
    } catch {
      return false;
    }
  };
  const hasAuthCookieAny = async (cookieNames: string[], domainKeywords: string[]) => {
    try {
      const cookies = (await page.context().cookies()) as Array<{ name?: string; value?: string; domain?: string }>;
      return cookies.some(
        (c) =>
          c.name &&
          cookieNames.includes(c.name) &&
          String(c.value || "").length > 0 &&
          domainKeywords.some((d) => String(c.domain || "").includes(d)),
      );
    } catch {
      return false;
    }
  };

  try {
    if (platform === "twitter") {
      await page.goto("https://x.com/compose/post", { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) return false;
      const editor = page.locator('div[role="textbox"][data-testid="tweetTextarea_0"]');
      if ((await editor.count()) > 0) return true;
      return hasAuthCookie("https://x.com", ["auth_token", "ct0"]);
    }
    if (platform === "linkedin") {
      await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) return false;
      const startBtn = page.locator('button:has-text("Start a post"), button:has-text("Create a post")');
      if ((await startBtn.count()) > 0) return true;
      return hasAuthCookie("https://www.linkedin.com", ["li_at", "JSESSIONID"]);
    }
    if (platform === "reddit") {
      await page.goto("https://www.reddit.com/submit", { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) return false;
      const titleInput = page.locator('textarea[name="title"], textarea[placeholder*="Title"]');
      if ((await titleInput.count()) > 0) return true;
      return hasAuthCookie("https://www.reddit.com", ["reddit_session", "token_v2", "session"]);
    }
    if (platform === "instagram") {
      await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });
      if (page.url().includes("/accounts/login")) return false;
      const passwordInput = page.locator('input[name="password"]');
      if ((await passwordInput.count()) === 0) return true;
      return hasAuthCookie("https://www.instagram.com", ["sessionid", "ds_user_id"]);
    }
    if (platform === "threads") {
      await page.goto("https://www.threads.net/", { waitUntil: "domcontentloaded" });
      const loginInput = page.locator('input[name="username"], input[name="password"]');
      if ((await loginInput.count()) > 0) return false;
      const editor = page.locator('div[contenteditable="true"], textarea[placeholder*="thread"], textarea');
      const start = page.locator('button:has-text("Start a thread"), a:has-text("Start a thread")');
      const profileNav = page.locator('a[href*="/@"], a[href*="/profile"], a[href*="/settings"]');
      if ((await editor.count()) > 0 || (await start.count()) > 0 || (await profileNav.count()) > 0) return true;
      if (await hasAuthCookie("https://www.threads.net", ["sessionid", "ds_user_id"])) return true;
      return hasAuthCookieAny(["sessionid", "ds_user_id"], ["threads.net", "instagram.com"]);
    }
    if (platform === "youtube") {
      await page.goto("https://studio.youtube.com/", { waitUntil: "domcontentloaded" });
      if (page.url().includes("accounts.google.com")) return false;
      const avatar = page.locator('button[aria-label*="Account"], ytcp-header');
      if ((await avatar.count()) > 0) return true;
      return hasAuthCookie("https://studio.youtube.com", ["SAPISID", "__Secure-3PSID", "HSID"]);
    }
    if (platform === "tiktok") {
      await page.goto("https://www.tiktok.com/", { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) return false;
      const loginButton = page.locator('button:has-text("Log in"), a:has-text("Log in")');
      if ((await loginButton.count()) === 0) return true;
      return hasAuthCookie("https://www.tiktok.com", ["sessionid", "sessionid_ss", "sid_tt"]);
    }
  } catch {
    return false;
  }
  return false;
}

async function verifyLoginFromSavedProfile(pw: PW, platform: Platform): Promise<boolean> {
  const context = await pw.chromium.launchPersistentContext(userDataDir(platform), {
    headless: true,
    viewport: { width: 1280, height: 900 },
  });
  try {
    const page = context.pages()[0] || (await context.newPage());
    return await isBrowserLoginVerified(page, platform);
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

export async function checkBrowserLoginSession(platform: Platform): Promise<{ connected: boolean }> {
  const dir = profilePath(platform);
  if (!fs.existsSync(dir)) return { connected: false };
  const pw = await loadPlaywright();
  try {
    const connected = await verifyLoginFromSavedProfile(pw, platform);
    return { connected };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    // Another Chromium instance may already own this profile. Treat as connected.
    if (msg.includes("processsingleton") || msg.includes("singletonlock") || msg.includes("profile is already in use")) {
      return { connected: true };
    }
    return { connected: false };
  }
}

export async function clearBrowserLoginSession(platform: Platform): Promise<void> {
  const dir = profilePath(platform);
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

export async function openBrowserLoginSession(input: { platform: Platform; waitMs?: number }): Promise<{ ok: boolean; message: string }> {
  const existing = await checkBrowserLoginSession(input.platform);
  if (existing.connected) {
    return { ok: true, message: `${input.platform} is already connected.` };
  }
  if (activeLoginSessions.has(input.platform)) {
    return { ok: false, message: `Login session is already running for ${input.platform}. Close the existing window first.` };
  }
  activeLoginSessions.add(input.platform);
  const pw = await loadPlaywright();
  try {
    let context: any;
    try {
      context = await pw.chromium.launchPersistentContext(userDataDir(input.platform), {
        headless: false,
        viewport: { width: 1280, height: 900 },
      });
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).toLowerCase();
      if (msg.includes("processsingleton") || msg.includes("singletonlock") || msg.includes("profile is already in use")) {
        const nowConnected = await checkBrowserLoginSession(input.platform);
        if (nowConnected.connected) {
          return { ok: true, message: `${input.platform} profile is already open and connected.` };
        }
        return { ok: false, message: `${input.platform} profile is already in use by another browser window. Close it and retry.` };
      }
      throw e;
    }
    let closed = false;
    context.once("close", () => {
      closed = true;
    });
    const page = context.pages()[0] || (await context.newPage());
    page.once("close", () => {
      closed = true;
    });
    await page.goto(loginUrl(input.platform), { waitUntil: "domcontentloaded" });
    const waitMs = Math.max(15_000, Math.min(300_000, input.waitMs ?? 90_000));

    // End session as soon as user closes either the page or full browser context, or timeout hits.
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
    // Re-verify from saved profile so closing the login window doesn't cause a false failure.
    const verified = await verifyLoginFromSavedProfile(pw, input.platform);
    if (!verified) {
      return { ok: false, message: `Login was not completed for ${input.platform}. Please sign in and try again.` };
    }
    return { ok: true, message: `Login verified for ${input.platform}.` };
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
  const submitUrl = sr ? `https://www.reddit.com/r/${sr}/submit?type=text` : "https://www.reddit.com/submit?type=text";
  // Open submit page even without subreddit so user can continue manually if needed.
  await page.goto(submitUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // New Reddit may redirect or use a different layout. Try multiple selectors.
  const titleFilled = await fillEditable(
    page,
    [
      'div[slot="title"] textarea',
      'textarea[name="title"]',
      'textarea[placeholder*="Title" i]',
      'input[placeholder*="Title" i]',
      'div[contenteditable="true"][aria-label*="title" i]',
    ],
    title || "Post",
  );
  if (!titleFilled) {
    if (!sr) {
      return {
        ok: false,
        error: "Reddit submit opened. Select a subreddit first, then continue posting in the opened window.",
      };
    }
    return { ok: false, error: "Reddit title input not found. Login may be required or UI changed." };
  }

  await page.waitForTimeout(500);

  // Body input (optional — some post types don't have it)
  await fillEditable(
    page,
    [
      'div[slot="text"] div[contenteditable="true"]',
      'div[role="textbox"]',
      'textarea[name="text"]',
      'div[contenteditable="true"][aria-label*="body" i]',
      'div.ql-editor',
      'shreddit-composer div[contenteditable="true"]',
    ],
    body || title,
  );

  await page.waitForTimeout(500);
  const postBtn = page.locator(
    'button[type="submit"], button:has-text("Post"), button:has-text("Submit"), faceplate-tracker[action="submit"] button',
  );
  if (!(await postBtn.count())) return { ok: false, error: "Reddit Post button not found." };
  await postBtn.first().click();
  await page.waitForTimeout(2000);

  // Check for success: URL change to a post page or success indicator
  const url = page.url();
  if (url.match(/\/comments\//)) return { ok: true, url };
  const successHint = page.locator('text=/your post|submitted|post is live/i');
  if ((await successHint.count()) > 0) return { ok: true, url };
  // If we got past the submit page, consider it likely successful
  if (!url.includes("/submit")) return { ok: true, url };
  return { ok: false, error: "Reddit post may not have been submitted. Could not confirm success." };
}

async function fillEditable(page: any, selectors: string[], text: string): Promise<boolean> {
  for (const selector of selectors) {
    const loc = page.locator(selector).filter({ visible: true });
    if (!(await loc.count())) continue;
    const target = loc.first();
    await target.click({ force: true });
    try {
      await target.fill(text);
      return true;
    } catch {
      // Some contenteditable nodes don't support fill(). Fall back to keyboard typing.
      try {
        await page.keyboard.press("Meta+A");
      } catch {
        // no-op
      }
      await page.keyboard.press("Backspace").catch(() => {});
      await page.keyboard.type(text, { delay: 5 });
      return true;
    }
  }
  return false;
}

async function waitForContextClosed(context: any, page: any, timeoutMs: number): Promise<boolean> {
  try {
    await Promise.race([
      new Promise<void>((resolve) => context.once("close", () => resolve())),
      new Promise<void>((resolve) => page?.once?.("close", () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    return false;
  }
  try {
    return Boolean(context.isClosed?.() || page?.isClosed?.());
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Monitor the page for post-success indicators while user is manually posting
// ---------------------------------------------------------------------------

const MANUAL_SUCCESS_PATTERNS: Record<string, { selectors: string[]; urlPattern?: RegExp }> = {
  instagram: {
    selectors: ['text=/post shared|your post has been shared|shared/i', '[aria-label*="Post shared"]'],
    urlPattern: /instagram\.com\/p\//,
  },
  threads: {
    selectors: ['text=/posted|your thread|thread has been/i'],
    urlPattern: /threads\.net\/.*\/post\//,
  },
  youtube: {
    selectors: ['text=/your post is live|posted|community post/i'],
  },
  tiktok: {
    selectors: ['text=/uploaded|your video is being|posted|published/i'],
  },
};

async function askLlmIfPostSucceeded(
  llmClient: LlmClient,
  dom: string,
  platform: string,
  pageUrl: string,
): Promise<boolean> {
  try {
    const raw = await chatForDom(
      llmClient,
      "You analyze HTML DOM snapshots from social media platforms. Determine whether a post/content was successfully published. Return JSON: {\"success\": true/false, \"reason\": \"brief explanation\"}",
      `Platform: ${platform}\nCurrent URL: ${pageUrl}\n\nDoes this page indicate a post was successfully published?\n\nDOM:\n${dom}`,
    );
    const parsed = parseJsonSafe(raw) as { success?: boolean };
    return parsed.success === true;
  } catch {
    return false;
  }
}

async function waitForManualCompletion(
  context: any,
  page: any,
  platform: Platform,
  timeoutMs: number,
  llmClient?: LlmClient,
): Promise<{ closed: boolean; successDetected: boolean }> {
  let successDetected = false;
  let contextClosed = false;
  let lastDom = "";

  const patterns = MANUAL_SUCCESS_PATTERNS[platform];

  const closePromise = new Promise<void>((resolve) => {
    const finish = () => {
      contextClosed = true;
      resolve();
    };
    context.once("close", () => {
      finish();
    });
    page?.once?.("close", () => {
      finish();
    });
    setTimeout(() => {
      finish();
    }, timeoutMs);
  });

  const hasLeftManualFlow = (currentUrl: string): boolean => {
    if (!currentUrl) return false;
    if (
      currentUrl.startsWith("about:blank") ||
      currentUrl.startsWith("about:newtab") ||
      currentUrl.startsWith("chrome://newtab") ||
      currentUrl.startsWith("edge://newtab")
    ) {
      return true;
    }
    // Reddit: if user leaves submit flow (including "Leave site"), stop waiting immediately.
    if (platform === "reddit") {
      return !/https?:\/\/(www\.)?reddit\.com\/(?:r\/[^/]+\/)?submit(?:[/?#]|$)/i.test(currentUrl);
    }
    return false;
  };

  // Poll page for success signals every 2.5s while window is open
  const poll = async () => {
    while (!contextClosed && !successDetected) {
      await new Promise((r) => setTimeout(r, 2500));
      if (contextClosed) break;
      try {
        if (page?.isClosed?.()) {
          contextClosed = true;
          break;
        }
        const currentUrl = page.url();
        if (hasLeftManualFlow(currentUrl)) {
          contextClosed = true;
          break;
        }
        // 1) Hardcoded selector check (fast, free)
        if (patterns) {
          for (const sel of patterns.selectors) {
            if ((await page.locator(sel).count()) > 0) {
              successDetected = true;
              return;
            }
          }
          if (patterns.urlPattern) {
            const url: string = page.url();
            if (patterns.urlPattern.test(url)) {
              successDetected = true;
              return;
            }
          }
        }
        // 2) Snapshot DOM for LLM fallback (taken periodically, used after close)
        const html = await page.content();
        lastDom = extractMinimalDom(html);
      } catch {
        // Page may be navigating or already closed
      }
    }
  };

  const pollPromise = poll();
  await closePromise;
  contextClosed = true;
  await Promise.race([pollPromise, new Promise((r) => setTimeout(r, 600))]);

  // 3) If hardcoded selectors didn't detect success, ask LLM to analyze the last DOM snapshot
  if (!successDetected && llmClient && lastDom) {
    let lastUrl = "";
    try { lastUrl = page.url(); } catch { /* context already closed */ }
    successDetected = await askLlmIfPostSucceeded(llmClient, lastDom, platform, lastUrl);
  }

  return { closed: true, successDetected };
}

async function publishThreads(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.threads.net/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const plusEntry = page.locator(
    'a[href*="/intent/post"], a[href*="/create"], button[aria-label*="New"], button[aria-label*="Create"], button:has-text("+"), a:has-text("+")',
  );
  if (await plusEntry.count()) {
    await plusEntry.first().click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  const start = page.locator('button:has-text("Start a thread"), a:has-text("Start a thread"), button:has-text("New thread")');
  if (await start.count()) {
    await start.first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  const typed = await fillEditable(
    page,
    [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="thread"]',
      'textarea[placeholder*="What"]',
      "textarea",
    ],
    text,
  );
  if (!typed) return { ok: false, error: "Threads editor not found. Login may be required." };
  await page.waitForTimeout(400);
  const postBtn = page.locator('button:has-text("Post"), button:has-text("Share"), [data-testid*="post"], [aria-label*="Post"]');
  if (!(await postBtn.count())) return { ok: false, error: "Threads Post button not found." };
  await postBtn.first().click({ force: true });
  await page.waitForTimeout(2000);
  const successHint = page.locator('text=/posted|shared|your thread/i');
  if ((await successHint.count()) > 0) return { ok: true };
  // Could not confirm post was published — return false so LLM fallback can retry
  return { ok: false, error: "Threads Post button was clicked but success could not be confirmed." };
}

async function publishInstagram(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const mediaPath = resolveInstagramMediaPath();
  const createBtn = page.locator('a[href="/create/select/"], a[href*="/create/"], svg[aria-label="New post"], [aria-label*="New post"]');
  if (await createBtn.count()) await createBtn.first().click().catch(() => {});
  await page.waitForTimeout(1200);

  if (!mediaPath) {
    return {
      ok: false,
      error:
        "Instagram requires media upload. Set INSTAGRAM_MEDIA_PATH in frontend/.env for auto upload, or upload manually in the opened window.",
    };
  }

  const fileInput = page.locator('input[type="file"]');
  if (!(await fileInput.count())) {
    return { ok: false, error: "Instagram media file input not found." };
  }
  await fileInput.first().setInputFiles(mediaPath);
  await page.waitForTimeout(1200);

  const nextBtn = page.locator('button:has-text("Next"), div[role="button"]:has-text("Next")');
  if (await nextBtn.count()) {
    await nextBtn.first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  if (await nextBtn.count()) {
    await nextBtn.first().click().catch(() => {});
    await page.waitForTimeout(800);
  }

  const captionOk = await fillEditable(
    page,
    ['textarea[aria-label*="caption"]', 'textarea[placeholder*="Write a caption"]', 'div[contenteditable="true"]'],
    text,
  );
  if (!captionOk) {
    return { ok: false, error: "Instagram caption input not found after media upload." };
  }

  const shareBtn = page.locator('button:has-text("Share"), div[role="button"]:has-text("Share")');
  if (!(await shareBtn.count())) return { ok: false, error: "Instagram Share button not found." };
  await shareBtn.first().click({ force: true });
  await page.waitForTimeout(1500);
  const successHint = page.locator('text=/shared|your post has been shared|post shared/i');
  if ((await successHint.count()) > 0) return { ok: true };
  return { ok: true };
}

async function publishYouTube(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  const create = page.locator(
    'button[aria-label="Create"], button[aria-label*="Create"], ytd-topbar-menu-button-renderer button, yt-icon-button#create-icon, button:has-text("Create")',
  );
  if (await create.count()) {
    await create.first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }

  const createPost = page.locator(
    'tp-yt-paper-item:has-text("Create post"), ytd-menu-service-item-renderer:has-text("Create post"), a:has-text("Create post"), [role="menuitem"]:has-text("Create post")',
  );
  if (await createPost.count()) {
    await createPost.first().click().catch(() => {});
    await page.waitForTimeout(1600);
  }

  const typed = await fillEditable(
    page,
    [
      'ytd-backstage-post-renderer div[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'ytcp-social-suggestion-input div[contenteditable="true"]',
      'div[contenteditable="true"]',
      "textarea",
    ],
    text,
  );
  if (!typed) {
    return {
      ok: false,
      error: "YouTube Community editor not found. Channel eligibility or UI may block auto-post. Window left open.",
    };
  }

  const postBtn = page.locator(
    'button:has-text("Post"), button:has-text("Publish"), ytcp-button:has-text("Post"), [aria-label*="Post"]',
  );
  if (!(await postBtn.count())) {
    return { ok: false, error: "YouTube Post button not found. Window left open for manual posting." };
  }
  await postBtn.first().click({ force: true });
  await page.waitForTimeout(2000);
  const successHint = page.locator('text=/posted|shared|community post|your post is live/i');
  if ((await successHint.count()) > 0) return { ok: true };
  return { ok: false, error: "YouTube Post button was clicked but success could not be confirmed." };
}

async function publishTikTok(page: any, text: string): Promise<PublishResult> {
  await page.goto("https://www.tiktok.com/upload", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { ok: false, error: "TikTok browser auto-post requires video upload flow and is not yet implemented." };
}

// ---------------------------------------------------------------------------
// LLM DOM Fallback helpers
// ---------------------------------------------------------------------------

function extractMinimalDom(html: string): string {
  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];
  // Strip script, style, svg, noscript tags and their content
  body = body.replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Remove excessively long attribute values (e.g. base64 images)
  body = body.replace(/(\w+)="[^"]{300,}"/g, '$1="…"');
  body = body.replace(/(\w+)='[^']{300,}'/g, "$1='…'");
  // Collapse whitespace
  body = body.replace(/\s{2,}/g, " ");
  return body.slice(0, 15_000);
}

async function askLlmForSelectors(
  llmClient: LlmClient,
  dom: string,
  goal: string,
): Promise<{ editorSelector: string; publishButtonSelector: string; steps?: string[] }> {
  const raw = await chatForDom(
    llmClient,
    "You are a browser automation specialist. Given an HTML DOM snippet, identify CSS selectors for the requested UI elements. Return strict JSON: {\"editorSelector\":\"...\",\"publishButtonSelector\":\"...\",\"steps\":[\"optional preliminary steps\"]}",
    `Goal: ${goal}\n\nDOM:\n${dom}`,
  );
  return parseJsonSafe(raw) as { editorSelector: string; publishButtonSelector: string; steps?: string[] };
}

async function tryLlmFallback(
  page: any,
  llmClient: LlmClient,
  platform: Platform,
  title: string,
  body: string,
): Promise<PublishResult> {
  try {
    const html = await page.content();
    const dom = extractMinimalDom(html);
    const text = [title, body].filter(Boolean).join("\n\n").trim();
    const goal = `Find the text editor and publish/post button for the ${platform} compose page. The user wants to type and submit a post.`;
    const selectors = await askLlmForSelectors(llmClient, dom, goal);

    if (!selectors.editorSelector) {
      return { ok: false, error: "LLM fallback: no editor selector found" };
    }

    // Execute any preliminary steps (e.g. clicking "Start a post")
    if (selectors.steps?.length) {
      for (const step of selectors.steps) {
        try {
          const loc = page.locator(step);
          if (await loc.count()) {
            await loc.first().click({ force: true });
            await page.waitForTimeout(800);
          }
        } catch {
          // Best-effort for preliminary steps
        }
      }
    }

    const typed = await fillEditable(page, [selectors.editorSelector], text);
    if (!typed) {
      return { ok: false, error: "LLM fallback: could not fill editor with identified selector" };
    }

    if (selectors.publishButtonSelector) {
      await page.waitForTimeout(400);
      const btn = page.locator(selectors.publishButtonSelector);
      if (await btn.count()) {
        await btn.first().click({ force: true });
        await page.waitForTimeout(1200);
        return { ok: true };
      }
      return { ok: false, error: "LLM fallback: publish button not clickable" };
    }

    return { ok: false, error: "LLM fallback: no publish button selector" };
  } catch (e) {
    return { ok: false, error: `LLM fallback error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function publishByBrowser(input: { platform: Platform; title: string; body: string; llmClient?: LlmClient }): Promise<PublishResult> {
  const pw = await loadPlaywright();
  await closeActivePublishSession(input.platform);
  let context: any | null = null;
  let page: any | null = null;
  let browser: any | null = null;
  const text = composeText(input.title, input.body);
  let result: PublishResult = { ok: false, error: "publish failed" };
  const manualFirstPlatforms: Platform[] = ["reddit", "instagram", "threads", "youtube", "tiktok"];
  try {
    try {
      context = await pw.chromium.launchPersistentContext(userDataDir(input.platform), {
        headless: String(process.env.BROWSER_AUTOMATION_HEADLESS || "").toLowerCase() === "true",
        viewport: { width: 1280, height: 900 },
      });
      page = context.pages()[0] || (await context.newPage());
      activePublishSessions.set(input.platform, { context, browser: null });
    } catch (e) {
      if (isProfileInUseError(e)) {
        // Fallback: open an isolated non-persistent browser so user can still complete manual posting.
        const chromiumAny = (pw as any).chromium;
        if (typeof chromiumAny.launch === "function") {
          browser = await chromiumAny.launch({
            headless: false,
            args: ["--no-sandbox"],
          });
          context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
          page = await context.newPage();
          activePublishSessions.set(input.platform, { context, browser });
        } else {
          const screenshotDataUrl = await captureScreenshotDataUrl(page);
          return {
            ok: false,
            error: `${input.platform} profile is already in use by another Chromium window. Close that window and retry.`,
            screenshotDataUrl,
          };
        }
      } else {
        throw e;
      }
    }

    if (input.platform === "twitter") result = await publishTwitter(page, text);
    else if (input.platform === "linkedin") result = await publishLinkedIn(page, text);
    else if (input.platform === "reddit") result = await publishReddit(page, input.title, input.body);
    else if (input.platform === "threads") result = await publishThreads(page, text);
    else if (input.platform === "instagram") result = await publishInstagram(page, text);
    else if (input.platform === "youtube") result = await publishYouTube(page, text);
    else if (input.platform === "tiktok") result = await publishTikTok(page, text);
    else result = { ok: false, error: `Unsupported platform: ${input.platform}` };
    if (!result.ok) {
      // Try LLM DOM fallback before falling back to manual window
      if (input.llmClient) {
        const fallbackResult = await tryLlmFallback(page, input.llmClient, input.platform, input.title, input.body);
        if (fallbackResult.ok) {
          result = fallbackResult;
        }
      }
    }
    if (!result.ok) {
      if (manualFirstPlatforms.includes(input.platform)) {
        const { successDetected } = await waitForManualCompletion(context, page, input.platform, 10 * 60 * 1000, input.llmClient);
        const tag = successDetected ? "manual-confirmed" : "manual-unconfirmed";
        const screenshotDataUrl = await captureScreenshotDataUrl(page);
        return {
          ok: true,
          postId: `${tag}-${input.platform}`,
          url: page.url(),
          screenshotDataUrl,
        };
      }
      const screenshotDataUrl = await captureScreenshotDataUrl(page);
      return {
        ok: false,
        error: `${result.error || "publish failed"} Close the opened SNS window to continue the next platform.`,
        screenshotDataUrl,
      };
    }
    if (manualFirstPlatforms.includes(input.platform)) {
      // Automation succeeded but still wait for user to close the window.
      await waitForContextClosed(context, page, 10 * 60 * 1000);
    }
    const screenshotDataUrl = await captureScreenshotDataUrl(page);
    return { ...result, screenshotDataUrl };
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    if (manualFirstPlatforms.includes(input.platform) && context && page) {
      const { successDetected } = await waitForManualCompletion(context, page, input.platform, 10 * 60 * 1000, input.llmClient);
      const tag = successDetected ? "manual-confirmed" : "manual-unconfirmed";
      const screenshotDataUrl = await captureScreenshotDataUrl(page);
      return { ok: true, postId: `${tag}-${input.platform}`, url: page.url(), screenshotDataUrl };
    }
    const screenshotDataUrl = await captureScreenshotDataUrl(page);
    return {
      ok: false,
      error: `${result.error || "publish failed"} Close the opened SNS window to continue the next platform.`,
      screenshotDataUrl,
    };
  } finally {
    // Keep failed publish windows open for manual completion.
    if (context && result.ok && !manualFirstPlatforms.includes(input.platform)) {
      await context.close();
    }
    if (browser && result.ok && !manualFirstPlatforms.includes(input.platform)) {
      await browser.close();
    }
    const active = activePublishSessions.get(input.platform);
    if (active && active.context === context) {
      activePublishSessions.delete(input.platform);
    }
  }
}
