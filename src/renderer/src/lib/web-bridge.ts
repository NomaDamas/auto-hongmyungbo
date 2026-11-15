import type { WebviewTag } from "electron";

/**
 * DOM adapters for embedded AI chat sites. Selectors are lists; first match wins,
 * so site redesigns degrade to the generic contenteditable/textarea fallback, and
 * the user can always fall back to "선택 가져오기" or the clipboard.
 */
interface Adapter {
  match: RegExp;
  composer: string[];
  send: string[];
  reply: string[];
  busy: string[];
}

const ADAPTERS: Adapter[] = [
  {
    match: /chatgpt\.com|chat\.openai\.com/,
    composer: ["#prompt-textarea", "div.ProseMirror[contenteditable=true]", 'textarea[name="prompt"]'],
    send: ["button[data-testid=send-button]", "#composer-submit-button", 'button[aria-label*="Send prompt"]'],
    reply: ['[data-message-author-role="assistant"] .markdown', '[data-message-author-role="assistant"]'],
    busy: ['button[data-testid="stop-button"]'],
  },
  {
    match: /claude\.ai/,
    composer: ['div.ProseMirror[contenteditable="true"]', 'div[contenteditable="true"]'],
    send: ['button[aria-label="Send message"]', 'button[aria-label*="Send"]'],
    reply: [".font-claude-response", '[data-testid="assistant-message"]', ".font-claude-message"],
    busy: ['button[aria-label="Stop response"]', '[data-is-streaming="true"]'],
  },
  {
    match: /gemini\.google\.com/,
    composer: ["rich-textarea .ql-editor", 'div[contenteditable="true"]'],
    send: ["button.send-button", 'button[aria-label*="Send"]'],
    reply: ["model-response message-content .markdown", "model-response message-content", "model-response"],
    busy: ["button.send-button.stop", 'button[aria-label*="Stop"]'],
  },
];

const GENERIC: Adapter = {
  match: /./,
  composer: ['div[contenteditable="true"]', "textarea"],
  send: ['button[type="submit"]', 'button[aria-label*="Send"]', 'button[aria-label*="send"]'],
  reply: ["main article:last-of-type", "main"],
  busy: [],
};

const views = new Map<string, WebviewTag>();

export function registerWebview(id: string, el: WebviewTag | null): void {
  if (el) views.set(id, el);
  else views.delete(id);
}

/** Site adapter, with generic composer/send selectors appended as a last resort. Reply/busy stay site-specific to avoid grabbing the whole page. */
function adapterFor(view: WebviewTag): Adapter {
  const url = view.getURL();
  const a = ADAPTERS.find((x) => x.match.test(url));
  if (!a) return GENERIC;
  return { ...a, composer: [...a.composer, ...GENERIC.composer], send: [...a.send, ...GENERIC.send] };
}

function view(id: string): WebviewTag {
  const v = views.get(id);
  if (!v) throw new Error("웹 탭이 아직 로드되지 않았습니다.");
  return v;
}

/** Runs in the page. Selectors are JSON-embedded so no user text is ever spliced into code. */
function run<T>(v: WebviewTag, body: string, args: unknown): Promise<T> {
  return v.executeJavaScript(`(() => { const args = ${JSON.stringify(args)}; ${body} })()`) as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

// Hidden duplicates (mobile/desktop composers) are skipped; offsetParent is null for display:none subtrees.
const FIND = `const find = (sels) => { for (const s of sels) { const all = [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null || e.getClientRects().length); if (all.length) return all; } return null; };`;

/** Last prompt probe per tab, so "응답 가져오기" can locate the turn after our prompt on unknown DOMs. */
const probes = new Map<string, string>();

/** A distinctive single line of the prompt (chat UIs render it verbatim in the user turn). */
function probeOf(prompt: string): string {
  const lines = prompt.split("\n").map((l) => l.trim()).filter((l) => l.length >= 12 && !/^["'`]{3}$/.test(l));
  return (lines.sort((x, y) => y.length - x.length)[0] ?? prompt.trim()).slice(0, 60);
}

/**
 * Site selectors first. Fallback for DOMs without stable hooks (e.g. logged-out ChatGPT):
 * find the deepest element showing our prompt probe, climb until a following sibling has text;
 * that sibling is the assistant turn.
 */
async function lastReply(v: WebviewTag, a: Adapter, probe?: string): Promise<{ text: string; count: number; busy: boolean }> {
  return run(
    v,
    `${FIND}
     const busy = !!find(args.busy);
     const r = find(args.reply);
     if (r) return { text: r[r.length - 1].innerText.trim(), count: r.length, busy };
     if (!args.probe) return { text: "", count: 0, busy };
     const inComposer = (e) => e.closest("form, textarea, [contenteditable=true]") || args.composer.some((s) => e.closest(s));
     const hits = [...document.body.querySelectorAll("*")].filter((e) => e.children.length < 50 && !inComposer(e) && e.innerText && e.innerText.includes(args.probe));
     const user = hits.filter((e) => !hits.some((o) => o !== e && e.contains(o))).pop();
     // Prose text of a node: drop buttons/menus/sr-only labels (Copy, Edit, Share...) from a clone.
     const prose = (el) => {
       const c = el.cloneNode(true);
       c.querySelectorAll("button, [role=button], [role=menu], svg, .sr-only, [aria-hidden=true]").forEach((n) => n.remove());
       document.body.appendChild(c); c.style.cssText = "position:fixed;left:-99999px;top:0;width:600px";
       const t = c.innerText.trim(); c.remove(); return t;
     };
     for (let x = user; x && x !== document.body; x = x.parentElement) {
       for (let s = x.nextElementSibling; s; s = s.nextElementSibling) {
         if (s.contains(user)) continue;
         const t = prose(s);
         if (t.length > 1) return { text: t, count: 1, busy };
       }
     }
     return { text: "", count: 0, busy };`,
    { reply: a.reply, busy: a.busy, probe, composer: a.composer },
  );
}

/** Put `text` into the chat composer and (optionally) submit. Returns a snapshot used to detect the next reply. */
export async function sendToWeb(id: string, text: string, submit: boolean): Promise<{ count: number; text: string }> {
  const v = view(id);
  const a = adapterFor(v);
  const probe = probeOf(text);
  probes.set(id, probe);
  const before = await lastReply(v, a, probe);
  // execCommand("insertText") fires real beforeinput/input events, so React/ProseMirror/Quill composers
  // register the text even when the window lacks OS focus. Text travels as JSON data, never as code.
  const read = `const val = (el) => (el.tagName === "TEXTAREA" ? el.value : el.innerText).trim();`;
  const inserted = await run<number>(
    v,
    `${FIND} ${read}
     const c = find(args.composer);
     if (!c) return -1;
     const el = c[c.length - 1];
     el.focus();
     if (el.tagName === "TEXTAREA") { el.select(); } else { document.getSelection().selectAllChildren(el); }
     document.execCommand("insertText", false, args.text);
     return val(el).length;`,
    { composer: a.composer, text },
  );
  if (inserted < 0) throw new Error("입력창을 찾지 못했습니다. 로그인 상태를 확인하세요.");
  if (inserted === 0) {
    v.focus();
    await v.insertText(text);
    const after = await run<number>(v, `${FIND} ${read} const c = find(args.composer); return c ? val(c[c.length - 1]).length : 0;`, { composer: a.composer });
    if (after === 0) throw new Error("입력창에 텍스트를 넣지 못했습니다. 웹 탭을 한 번 클릭한 뒤 다시 시도하세요.");
  }
  if (submit) {
    await sleep(400);
    const clicked = await run<boolean>(
      v,
      `${FIND}
       const b = find(args.send);
       if (!b) return false;
       const btn = b[b.length - 1];
       if (btn.disabled) return false;
       btn.click();
       return true;`,
      { send: a.send },
    );
    if (!clicked) {
      v.sendInputEvent({ type: "keyDown", keyCode: "Return" });
      v.sendInputEvent({ type: "char", keyCode: "\r" });
      v.sendInputEvent({ type: "keyUp", keyCode: "Return" });
    }
  }
  return { count: before.count, text: before.text };
}

/**
 * Resolve with the new assistant reply once it stops changing.
 * Aborts via the signal (user cancels or sends a new prompt).
 */
export async function waitForReply(id: string, before: { count: number; text: string }, signal: AbortSignal): Promise<string> {
  const v = view(id);
  const a = adapterFor(v);
  const probe = probes.get(id);
  let last = "";
  let stableSince = 0;
  const deadline = Date.now() + 10 * 60_000;
  while (!signal.aborted && Date.now() < deadline) {
    await sleep(800);
    const now = await lastReply(v, a, probe).catch(() => null);
    if (!now) continue;
    const isNew = now.count > before.count || (now.text && now.text !== before.text);
    if (!isNew || !now.text) continue;
    if (now.text !== last || now.busy) {
      last = now.text;
      stableSince = Date.now();
      continue;
    }
    if (Date.now() - stableSince > 1800) return now.text;
  }
  throw new DOMException("cancelled", "AbortError");
}

export async function grabLatestReply(id: string): Promise<string> {
  const v = view(id);
  return (await lastReply(v, adapterFor(v), probes.get(id))).text;
}

export async function grabSelection(id: string): Promise<string> {
  return run<string>(view(id), `return (document.getSelection()?.toString() ?? "").trim();`, null);
}

export function webControls(id: string): WebviewTag | undefined {
  return views.get(id);
}
