# Auto-HongMyungbo (Open Source Local Edition)

![Auto-HongMyungbo Preview](docs/images/ddalcak_myungbo.png)

Generate multi-platform social drafts from one input, refine them, and publish with a local-first workflow.

## Index

- [1. What This Project Is](#1-what-this-project-is)
- [2. Who This Is For](#2-who-this-is-for)
- [3. 5-Minute Setup](#3-5-minute-setup)
- [4. First Run (Non-Technical Step-by-Step)](#4-first-run-non-technical-step-by-step)
- [5. Daily Usage Flow](#5-daily-usage-flow)
- [6. Platform Login & Publish Behavior](#6-platform-login--publish-behavior)
- [7. Instagram Special Flow](#7-instagram-special-flow)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Project Structure](#9-project-structure)

## 1. What This Project Is

- Single runtime: Next.js UI + API routes
- Local storage file: `local_store.json` (no external DB required)
- Default publishing mode: browser automation

## 2. Who This Is For

- Creators who want to write once and adapt for multiple SNS platforms
- Non-technical users who need easy local usage
- Developers who want an OSS baseline before hosted/SaaS separation

## 3. 5-Minute Setup

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
./scripts/setup_local_easy.sh
```

Create `frontend/.env` or `frontend/.env.local`:

```env
OPENROUTER_API_KEY=your_key_here
# or
OPENAI_API_KEY=your_key_here
```

Run:

```bash
./scripts/start_local.sh
```

Open: `http://localhost:3000`

API key help: `docs/API_KEYS.md`

Optional (for Instagram auto-upload in browser automation):

```env
INSTAGRAM_MEDIA_PATH=docs/images/sample.jpg
```

## 4. First Run (Non-Technical Step-by-Step)

1. Open `http://localhost:3000`.
2. Paste your draft in the Draft box.
3. Click `Options` and set API key/provider/model once.
4. Click `Platform Writing Style` only if you want per-platform style/language tuning.
5. Click `Generate N Platforms`.

## 5. Daily Usage Flow

1. Write or paste draft.
2. (Optional) Click `Refine Draft` to organize logic and improve the draft.
3. Review platform cards in Preview.
4. Accept cards you want to publish (accepted cards move to Queue).
5. Click `Queue Publish`.

Keyboard shortcuts:

- `Cmd/Ctrl + Enter`: Generate
- `Cmd/Ctrl + Shift + Enter`: Refine Draft

## 6. Platform Login & Publish Behavior

- Each platform button shows:
  - `Browser Login`: not connected
  - `Disconnect`: connected (click to clear session; login required again)
- Login state is verified by real browser-session checks, not just cached UI state.
- Failed publish attempts keep browser windows open so you can finish manually.

## 7. Instagram Special Flow

Instagram text-only direct auto-publish is limited by platform flow (media-first upload).

Current UX:

1. When you click `Queue Publish`, Instagram title/body is copied to your clipboard automatically.
2. Instagram create window opens.
3. If `INSTAGRAM_MEDIA_PATH` is set, app attempts auto-upload + caption + share.
4. If not set (or UI changed), upload media and paste copied text manually.

This gives a fast “ready-to-post” flow without extra copy/paste hunting.

## 8. Troubleshooting

- `OpenAI/OpenRouter not configured`
  - Check `frontend/.env` and restart with `./scripts/start_local.sh`
- `Playwright not installed`
  - Run `./scripts/setup_local_easy.sh` again
- Login says connected but publish fails
  - Click `Disconnect` for that platform, then `Browser Login` again
- Queue item not clearing
  - Refresh once; success logs are used to flush queue fallback

## 9. Project Structure

```text
.
├── frontend/                # Next.js app (UI + API routes)
│   ├── src/app/api/         # Server routes
│   └── src/server/          # LLM + store + browser automation helpers
├── scripts/                 # Local setup/run scripts
└── docs/
    └── images/              # README assets
```

---

To stop local server: press `Ctrl + C` in the terminal running `./scripts/start_local.sh`.
