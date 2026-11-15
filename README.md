# 🤖 Auto-HongMyungbo ⚽

> Write once, then shape each platform's post side by side. The AI runs in an embedded ChatGPT, Claude, or Gemini web tab, or in a terminal harness. Every change it makes appears as a diff you can accept or reject. Publishing goes through Aside.

![Auto-HongMyungbo](docs/images/ddalcak_myungbo.png)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg?style=flat-square)](LICENSE)

## Why

When you rework a post for LinkedIn, X, Threads, and Reddit inside one chat window, every version piles up in a single scrolling thread. You read it top to bottom and copy each version out by hand. Auto-HongMyungbo is the **UI/UX layer only**:

- **Writing**: done by the AI you already use (ChatGPT, Claude, or Gemini on the web, or Claude Code, Codex, or omp in a terminal), embedded in the app.
- **Editing**: the source draft and each platform post sit in **side-by-side columns**. Edit them directly.
- **AI changes**: shown inline as a **diff**. Accept or reject each chunk, or tweak it by hand.
- **Publishing**: handled by the [Aside](https://aside.com) browser agent, using your logged-in accounts.

There is no LLM API key and no backend.

## Layout

```
┌─ ← Title · [Propagate source] · Auto-send ───────────── [in][X][@][r] publish · [Aside ●] ⌘K ⚙ ┐
│ 4 columns have changes [LinkedIn][X][Threads][Reddit]           [Accept all] [Reject all]       │
│ Source │ LinkedIn  │ X        │ Threads │ Reddit ║ [ChatGPT][Claude][Gemini] │ [Claude Code][Codex][omp] │
│        │ +added    │ ⚠ source │         │        ║                                                       │
│        │ −deleted  │  changed │         │        ║  Embedded web (persistent login) / terminal (project cwd) │
├────────┴───────────┴──────────┴─────────┴────────╢                                                       │
│ Apply to: (Source)(LinkedIn)(X)(Threads)(Reddit)(All platforms)   Brief ●   ║  [Grab selection] [Grab reply]  │
│ [ Say what you want…                                    ↑ ] [Propagate source] ║                            │
│ Humanize · Shorter · Stronger hook · Casual · Professional · EN · KO   → ChatGPT  ║                        │
└──────────────────────────────────────────────────╨───────────────────────────────────────────────────────┘
```

Auto-HongMyungbo is a **multiplexer**: it connects your writing intent to whatever AI you already use, and each AI's reply back into the right column. It does no generation itself.

| Feature | What it does |
|---|---|
| **Intent bar** | Pick target columns with chips (click = only this column, ⇧/⌘-click = add or remove; clicking a column also targets it), write the intent in one line, and press ↵. It goes to the active dock tab. With multiple targets, each column gets its own result as a diff. ↑ recalls recent intents, ⌘L focuses the input. |
| **Brief** | A standing intent for this post: audience, tone, things to always keep. It is automatically prepended to every request. Stored in `project.json`. |
| **Propagate source** | Sends the source to every platform in one request (⌘↵). Empty columns are written fresh. Columns with content are updated, keeping your own edits where the source didn't change. When the source changes, the "Source changed" badge on a column propagates to that column only. |
| **Bulk review** | When two or more columns have changes, a review bar appears at the top: Accept all / Reject all, or review chunk by chunk in each column. |
| **Diff review** | An AI reply or a harness file edit shows up in its column as a unified diff. Accept or reject per chunk. Unresolved changes can't be published. |
| **Embedded AI web** | ChatGPT, Claude, and Gemini share one persistent login session. Prompts are typed and sent automatically. Replies keep their markdown structure (lists, headings) and are routed into each column. If that fails, use Grab reply / Grab selection. |
| **Harness terminals** | Claude Code, Codex, and omp run in your login shell with the project folder as the working directory. File changes are turned into diffs. |
| **Aside connection** | The Aside button opens a panel showing the Aside account, a browser profile picker, and per-platform login status. Login status is checked by opening a logged-in-only page in Aside and seeing whether it redirects. Logging in also happens in the Aside browser (password autofill, 2FA). Publishing is blocked when not logged in. |
| **Aside publishing** | Each platform button runs `aside [--profile] "<publish task>"` in a dock terminal. Aside always stops before the final Post button to confirm. |
| **Character limits** | X is counted with weighted `twitter-text` (Korean counts double). Reddit shows the title separately. Over the limit, a Fit to limit button appears. |
| **Version history** | The previous version is saved automatically every time you accept a change. Restoring also goes through a diff. |
| **Humanizing (Korean/English)** | Harnesses use the [im-not-ai](https://github.com/epoko77-ai/im-not-ai) and [humanizer](https://github.com/blader/humanizer) skills. Web chats get a condensed version of those rules. |

### Aside security model

Aside owns every login credential: cookies, passwords, and 2FA stay inside the Aside browser profile. This app:
- Calls only the official CLI (`aside account status`, `aside host profiles`, `aside repl`) via `execFile` with no shell.
- Never reads `~/.aside/cli/auth.json`, cookies, or passwords. Of the status data, it passes only name, email, and profile labels to the UI.
- Puts only fixed login and check URLs into REPL scripts. User text is never interpolated into code.

## Install & run

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
npm install        # node-pty native build included (postinstall)
npm run dev
```

Requirements: macOS (Linux and Windows are untested), Node 20+, and Xcode CLT for the node-pty build.

Optional:

```bash
# Publishing
curl -fsSL https://releases.aside.com/install.sh | bash && aside login

# Humanize skills (for harnesses)
/plugin marketplace add epoko77-ai/im-not-ai && /plugin install humanize-korean@im-not-ai   # Claude Code
npx skills add blader/humanizer --global --agent '*'
```

## Project folder contract

Each post is a single folder. Default location: `~/Documents/HongMyungbo/<date>-<title>/`.

```
master.md  linkedin.md  x.md  threads.md  reddit.md   # the text (Reddit: first line "# Title")
project.json                                           # metadata (staleness, publish status)
AGENTS.md  CLAUDE.md                                   # rules for harnesses
.history/<timestamp>/                                  # versions saved before each accepted change
```

The folder is plain markdown, so you can also edit it in another editor or from a harness outside the app. The app picks up those changes and shows them as diffs.

## Shortcuts

| Key | Action |
|---|---|
| ⌘K | Command palette (free-form intents, presets, tab switching, Aside connection) |
| ⌘L | Focus the intent input |
| ⌘↵ | Propagate source → all platforms |
| ⌘⇧↵ / ⌘⇧⌫ | Accept all / reject all changes in the current column |
| ⌘↵ / ⌘⌫ (inside a diff) | Accept / reject the chunk under the cursor |
| ⌘1–5 / ⌘0 | Show one column / show all columns |
| ⌘J | Toggle the AI dock |
| ⌘, | Settings (web tabs, harness commands, platforms, workspace folder) |

## Stack

Electron · React 19 · Vite (electron-vite) · Tailwind 4 · CodeMirror 6 + `@codemirror/merge` · xterm.js + node-pty · react-resizable-panels · cmdk · zustand · chokidar · twitter-text · sonner

## Structure

```
src/main/        Electron main: settings, project folders + file watcher, pty, webview session, Aside CLI bridge (aside.ts)
src/preload/     IPC bridge (window.api)
src/shared/      types, platform rules, AGENTS.md template
src/renderer/    UI: columns (DocColumn/DocEditor), IntentBar, ReviewBar, AsidePanel, dock (Dock/Terminal), palette, publish tray
  lib/prompts.ts      Intent and propagate prompts (web vs. harness), humanize rules, section parsing
  lib/web-bridge.ts   Composer/send/reply DOM adapters for ChatGPT, Claude, and Gemini, plus reply → markdown conversion
  lib/dispatch.ts     runIntent / runPropagate: send to the active dock tab → collect the reply → create per-column diff proposals
```

When a site redesign breaks the web adapters, edit the selector lists in `ADAPTERS` in `web-bridge.ts`. Until then, Grab reply / Grab selection still work.

## License

AGPL-3.0
