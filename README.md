# Auto-HongMyungbo (Open Source Local Edition)

<img width="1230" height="444" alt="image" src="https://github.com/user-attachments/assets/a90d5fc5-457a-43c5-ba19-9d7af3c722df" />


[![Watch the demo](https://img.youtube.com/vi/XuE7bIkd2qU/maxresdefault.jpg)](https://youtu.be/XuE7bIkd2qU)


A local tool that turns one draft into multi-platform SNS posts, lets you refine them, and publish in sequence.

## Table of Contents

- [1. What This Project Does](#1-what-this-project-does)
- [2. Easy Setup (First-Time Users)](#2-easy-setup-first-time-users)
- [3. First Run](#3-first-run)
- [4. End-to-End Usage](#4-end-to-end-usage)
- [5. Core Features at a Glance](#5-core-features-at-a-glance)
- [6. How Login and Publish Work](#6-how-login-and-publish-work)
- [7. Common Errors and Fixes](#7-common-errors-and-fixes)
- [8. Project Structure](#8-project-structure)

## 1. What This Project Does

- Runs UI + API together in a single Next.js app.
- Stores state in a local file (`local_store.json`) without an external DB.
- Uses browser automation (Playwright) as the default publishing method.
- Supported flow:
  - Write Draft
  - Generate per platform
  - Preview/Edit
  - Manage Queue
  - Sequential publish (`Post Next Platform`, `Post All (Beta)`)

## 2. Easy Setup (First-Time Users)

### 2-1. Requirements

- macOS / Linux / Windows (WSL recommended)
- Git
- Node.js 20+
- Terminal
- At least one LLM API key:
  - OpenAI or OpenRouter (recommended baseline)
  - Anthropic / Grok / Gemini (optional)

See `docs/API_KEYS.md` for API key setup.

### 2-2. Install

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
./scripts/setup_local_easy.sh
```

### 2-3. Create Environment File

Create `frontend/.env` or `frontend/.env.local`:

```env
# At least one is required
OPENROUTER_API_KEY=your_key_here
# or
OPENAI_API_KEY=your_key_here

# Optional
ANTHROPIC_API_KEY=your_key_here
GROK_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

If you want Instagram auto-upload support:

```env
INSTAGRAM_MEDIA_PATH=docs/images/sample.jpg
```

## 3. First Run

```bash
./scripts/start_local.sh
```

Open in browser:

- `http://localhost:3000`

Stop server:

- `Ctrl + C` in the terminal running the app

## 4. End-to-End Usage

### Step 1) Write Draft

Paste your rough draft into the left `Draft` box.

### Step 2) Configure Options

In `Options`, set:

- Provider
- Model
- API Keys
- Thinking / Temperature / Token settings

### Step 3) Optional Draft Enhancement

- `Draft Idea Booster`: structure your idea
- `Aggro Pingpong`: stronger hook exploration
- `Phrase Booster`: improve selected wording
  - Select text in Draft to show the `Phrase Booster` button
  - Click it to open a chat-style panel for wording improvements

### Step 4) Generate by Platform

Click `Generate N Platforms`.

- While generating, hover the button to reveal `Cancel`.

### Step 5) Review Results

In `Platform Results`:

- Read in Preview
- Edit directly
- Accept / Reject

Accepted cards move to Queue.

### Step 6) Login

Use each platform’s `Browser Login` once.

- Even when `Connected` is shown, preflight login verification runs before publish.

### Step 7) Publish

- `Post Next Platform`: guided one-by-one publishing
- `Post All (Beta)`: sequential publish for all queued cards
- `Publish now` on each queue card: one-off publish

If a publish fails:

- You can retry from that platform or continue manually.

## 5. Core Features at a Glance

### Preview vs Edit

- Preview: reading-focused
- Edit: direct content editing

### Compare Mode

- OFF (default): focused single-platform view
- ON: side-by-side platform comparison

### Saved Drafts

- Restore auto-saved draft history
- Deleting also removes it from local history

### Theme (Dark/Light)

- Toggle with the sun/moon button (bottom-right)
- Preference is saved in browser storage

## 6. How Login and Publish Work

- Login state is determined from real browser session state.
- Preflight login checks run before publish.
- Manual-heavy platforms (for example Reddit) now detect leave/close events to reduce stuck states.
- On success, items are removed from Queue; on failure, they remain for retry.

## 7. Common Errors and Fixes

### 1) `OpenAI/OpenRouter not configured`

- Check `frontend/.env`
- Restart server: `./scripts/start_local.sh`

### 2) `Playwright not installed`

```bash
./scripts/setup_local_easy.sh
```

### 3) `LLM request failed: unsupported parameter/value`

- Some latest models restrict sampling parameters.
- The app includes automatic fallback retries.
- If it still fails, switch model and test again.

### 4) Connected login but publish fails

- Click `Disconnect` for that platform, then run `Browser Login` again
- Platform UI changes can break automation; manual completion is still possible

### 5) Queue does not flush

- Check publish logs/status and refresh once

## 8. Project Structure

```text
.
├── frontend/
│   ├── src/app/api/      # Next.js API routes
│   ├── src/components/   # UI components
│   ├── src/lib/          # Client helpers/types
│   └── src/server/       # LLM + store + automation logic
├── scripts/              # Setup/run scripts
└── docs/                 # Docs + images
```
