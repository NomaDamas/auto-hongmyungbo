# 🤖 Auto-HongMyungbo ⚽

> Write one source draft, refine each platform's post by stating your intent, and publish now or on a schedule through Aside.
> The AI you already use does the writing — ChatGPT, Claude, Gemini (web) or Claude Code, Codex, omp (CLI). This app only **connects** them (a multiplexer).

![Auto-HongMyungbo](docs/images/ddalcak_myungbo.png)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg?style=flat-square)](LICENSE)

## Layout

```
┌ Sidebar ───────┐┌──────────── Editor (tabs, drag to split) ────────────┐┌ AI dock ─────────────┐
│ Promotion      ││ [Source] [SNS] [Community] [Blog]                    ││ ● Web  ChatGPT Claude │
│ ▾ Launch       ││ ┌───────────────────┬─────────────────────────┐      ││ ● CLI  Claude Code …  │
│   · Launch ●   ││ │ Source            │ LinkedIn·X·Threads·…    │      ││  (Chrome-style tab    │
│   · v2 ⏰11/16 ││ │ 📁 Linked project │ Preview  Publish ▾  ⋯   │      ││   groups)             │
│ ▸ Hiring       ││ │                   │ [media strip]           │      ││                       │
│ Uncategorized  ││ └───────────────────┴─────────────────────────┘      ││                       │
│ ⚙ Aside ●      ││ [ → Say what you want for LinkedIn…   ↑ ] [Propagate]  ││                       │
└────────────────┘└──────────────────────────────────────────────────────┘└───────────────────────┘
```

| Feature | What it does |
|---|---|
| **Promotion folders (sidebar)** | Folders up to 2 levels deep. Each is a real folder (`~/Documents/HongMyungbo/<folder>/<post>/`). Drag a post to move it. Each post shows a status dot (draft / changes pending / scheduled / posted). |
| **Tabs + split** | Four tabs: Source / SNS / Community / Blog. Drag a tab to the left or right edge to snap into a 50/50 split. Inside a tab, pick the platform (e.g. LinkedIn · X · Threads · Instagram · Facebook). |
| **Intent** | **The doc you're viewing is the target.** Write one line and press ↵; it goes to the active AI, and the result comes back into that doc as a diff. "Propagate" pushes the source to every platform. |
| **⋯ Advanced** | Presets (humanize / shorten / stronger hook / tone / translate / fit length), brief, auto-send, version history, copy, grab reply / grab selection. |
| **Preview** | A modal that mocks each platform's real post (LinkedIn "…see more", X 280-char limit, Instagram carousel, Reddit title, blog layout, and so on). ⌘P. |
| **Media** | Drop or pick images and videos per doc. Checked against each platform's limits (number of images and videos, whether they can be mixed, whether media is required). Aside uploads them. |
| **Publish / schedule** | Publish now, or schedule by date and time. Platforms with a built-in scheduler get scheduled by Aside in that scheduler; the rest are published by Aside at that time while the app is running. Both go through Aside MCP (`aside mcp` → `exec`). |
| **Comments** | Each platform tab has a **Post \| Comment** toggle. The comment is a separate doc (`<platform>.comment.md`) and works with the same diff, intent, and history. Mode "first comment on my post" posts automatically right after the post publishes. Mode "reply to another post" replies at the target URL. ⋯ → draft comments for all platforms in one go, draft a reply to a comment, comment on all platforms. |
| **Auto-embed** | When you write directly in ChatGPT/Claude/Gemini, the new reply shows up as an approval card below the editor. Approve it to bring it in as a diff; with section markers it's split across platforms. If the source is empty, it suggests importing the reply as the source. File changes from harnesses also arrive as diffs. |
| **Link a project** | Pick a code or project folder. Harnesses start with `--add-dir` so they can read the code. Links (git remote, homepage, README) and a summary go into the prompt. |
| **AI dock** | Embedded web (ChatGPT/Claude/Gemini, persistent login) plus harness terminals. Chrome-style tab groups: rename, change color, collapse, drag to move. |
| **Aside connection** | Aside account, browser profile, and login status per platform. Log in through the Aside browser itself (password autofill, 2FA), or import from another browser. |
| **Setup wizard** | First run: install Aside.app (bundled dmg, signature verified) → install Aside CLI → `aside login` → check platform logins → detect harnesses. |

### Platforms

| Tab | Platform |
|---|---|
| SNS | LinkedIn, X, Threads, Instagram, Facebook, Bluesky, Mastodon |
| Community | Reddit, Hacker News, Product Hunt, DEV, Naver Cafe, OKKY |
| Blog | Naver Blog, Tistory, Brunch, velog, Medium, Substack, Hashnode, WordPress |

Per-platform character limits, media rules, writing guides, and Aside publish hints live in `src/shared/platforms.ts`.

## Install & run

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
npm install        # includes the node-pty native build
npm run dev
```

Package a dmg (includes the Aside.app dmg; non-commercial):

```bash
npm run dist       # fetch:aside → build → electron-builder --mac
```

The first-run wizard installs the bundled Aside.app into `/Applications`, then runs the official CLI install script and `aside login`.

## Security model (Aside)

- Aside owns all login credentials (cookies, passwords, 2FA). This app never reads `~/.aside/cli/auth.json` or any cookies.
- Aside is called only through the official CLI and MCP, via `execFile`/stdio without a shell. Only fixed URLs and file paths go into REPL scripts.
- Login status is judged only by whether a logged-in-only page in Aside redirects.

## Project folder contract

```
<folder>/<post>/
  master.md  linkedin.md  x.md  naver_blog.md …   # text (title platforms: first line "# Title")
  media/                                          # attached images/videos
  project.json                                    # metadata (platforms, media, publish/schedule, linked project, brief)
  AGENTS.md  CLAUDE.md                            # rules for harnesses (including the linked project section)
  .history/<timestamp>/                           # versions before each accepted change
```

## Shortcuts

| Key | Action |
|---|---|
| ⌘K | Command palette |
| ⌘L | Focus intent input |
| ⌘↵ | Propagate source |
| ⌘P | Preview the current doc |
| ⌘⇧↵ / ⌘⇧⌫ | Accept / reject all for the current doc |
| ⌘B / ⌘J | Toggle sidebar / AI dock |
| ⌘1–4 | Switch tab panel |

## Stack

Electron · React 19 · electron-vite · Tailwind 4 · dockview · CodeMirror 6 + merge · xterm.js + node-pty · react-resizable-panels · cmdk · zustand · react-day-picker · date-fns · @modelcontextprotocol/sdk · chokidar · twitter-text · sonner · Geist

## License

AGPL-3.0
