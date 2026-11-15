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
┌──────────────── ⌘K · Generate all · Auto-send ─────────── Aside publish [in][X][@][r] ┐
│ Source │ LinkedIn  │ X         │ Threads │ Reddit ║ [ChatGPT][Claude][Gemini] │ [Claude Code][Codex][omp] │
│ draft  │ 1204/3000 │ 271/280   │ 480/500 │ title  ║                                                       │
│        │ +added ── │ ⚠ source  │         │        ║   Embedded web (persistent login) / terminal (project cwd)  │
│        │ −deleted  │   changed │         │        ║                                                       │
│        │ [accept][reject]                        ║  [Grab selection] [Grab reply → diff]                 │
│ Humanize · Shorter · Stronger hook · char gauge  ║                                                       │
└──────────────────────────────────────────────────╨───────────────────────────────────────────────────────┘
```

| Feature | What it does |
|---|---|
| **Platform columns** | Source, LinkedIn, X, Threads, Reddit. Resizable. ⌘1–5 shows one column at a time, ⌘0 shows them all. |
| **Diff review** | An AI reply or a harness file edit appears in that column as a unified diff. Accept or reject per chunk, or press ⌘⇧↵ to accept all and ⌘⇧⌫ to reject all. Unresolved changes can't be published. |
| **Selection edits** | Select a passage and click Humanize, Shorter, or Stronger hook (or use ⌘K) to rewrite only that passage. |
| **Embedded AI web** | ChatGPT, Claude, and Gemini share one persistent login session. Prompts are typed in and sent automatically. Replies are parsed and routed to each column as a diff. If parsing fails, use Grab reply or Grab selection. |
| **Harness terminals** | Claude Code, Codex, and omp run in your login shell with the project folder as the working directory. When the harness edits `linkedin.md` and similar files, a file watcher turns the change into a diff. |
| **Character limits** | X uses `twitter-text` weighted counting, where Korean characters count as 2. Reddit shows the title's length separately. Over the limit, a Fit to limit button appears. |
| **Source changed** | If the source draft changes after a platform post was generated from it, the post shows a "Source changed" badge. Click it to request an update for just the changed parts. |
| **Version history** | The previous version is saved automatically every time you accept a change. Restoring a version also goes through a diff. |
| **Aside publishing** | Each platform button runs `aside "<publish task>"` in a terminal tab inside the dock. Aside always stops before the final Post button to confirm with you. |
| **Humanize (Korean/English)** | Inside harnesses, the installed skills are used: [im-not-ai](https://github.com/epoko77-ai/im-not-ai) (Korean) and [humanizer](https://github.com/blader/humanizer) (English). Web chats can't load skills, so a condensed version of those rules is sent with the prompt. |

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
| ⌘K | Command palette (free-form instructions, actions, tab switching) |
| ⌘↵ | Source → generate all platforms |
| ⌘⇧↵ / ⌘⇧⌫ | Accept all / reject all changes in the current column |
| ⌘↵ / ⌘⌫ (inside a diff) | Accept / reject the chunk under the cursor |
| ⌘1–5 / ⌘0 | Show one column / show all columns |
| ⌘J | Toggle the AI dock |
| ⌘, | Settings (web tabs, harness commands, platforms, workspace folder) |

## Stack

Electron · React 19 · Vite (electron-vite) · Tailwind 4 · CodeMirror 6 + `@codemirror/merge` · xterm.js + node-pty · react-resizable-panels · cmdk · zustand · chokidar · twitter-text · sonner

## Structure

```
src/main/        Electron main: settings, project folders + file watcher, pty, webview session
src/preload/     IPC bridge (window.api)
src/shared/      types, platform rules, AGENTS.md template
src/renderer/    UI: columns (DocColumn/DocEditor), dock (Dock/Terminal), palette, publish tray
  lib/prompts.ts      Prompt builders (web vs. harness), humanize rules, section parsing
  lib/web-bridge.ts   Composer, send, and reply DOM adapters for ChatGPT, Claude, and Gemini
  lib/dispatch.ts     Sends to the active dock tab → collects the reply → creates the diff proposal
```

When a site redesign breaks the web adapters, edit the selector lists in `ADAPTERS` in `web-bridge.ts`. Until then, Grab reply / Grab selection still work.

## License

AGPL-3.0
