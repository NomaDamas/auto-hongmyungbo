# Auto-HongMyungbo (Open Source Local Edition)

![Auto-HongMyungbo Preview](docs/images/ddalcak_myungbo.png)

Generate platform-specific social post drafts from one input and review them in a built-in preview UI.

This repo is optimized for **easy local usage**.  
If you can run two commands, you can use it.

## Architecture (Current)

- Single runtime: **Next.js (frontend + server routes)**
- No standalone FastAPI server required for local OSS usage
- Local persistence file: `local_store.json` (configurable with `STORE_PATH`)

## What You Need

- macOS/Linux (or WSL on Windows)
- Node.js LTS + npm
- LLM API key (OpenRouter recommended)

## 5-Minute Quick Start

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
./scripts/setup_local.sh
```

Edit `frontend/.env` (or `frontend/.env.local`) and set (OpenRouter default):

```env
OPENROUTER_API_KEY=your_key_here
```

Need help with key issuance/billing?

- `docs/API_KEYS.md`

Run:

```bash
./scripts/start_local.sh
```

Open: `http://localhost:3000`

## Run (Manual)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Runtime Options (No `.env` required)

In `Options`, you can configure at runtime:

- Provider (`OpenAI` / `OpenRouter`)
- Model (preset or custom model ID)
- Thinking mode + reasoning effort
- Temperature / Top-p / Max output tokens
- API keys (stored locally in your browser)

## What Works Out of the Box

- Draft -> multi-platform generation
- Optional Draft Refiner panel (structured brief, missing questions, angles, polished draft)
- Platform-specific preview and editing
- Accept/Reject queue flow
- Refine (text + voice input)
- Local JSON persistence (no external DB required)

## Optional Features (Can Be Added Later)

- Social login / OAuth publish integrations
- Scheduled publishing configs

You can use the app locally without setting all OAuth keys.

## Project Structure

```text
.
├── frontend/   # Next.js UI + API routes
│   └── src/app/api/  # server routes
│   └── src/server/   # local store + llm server helpers
├── scripts/    # one-command local setup/run
└── docs/
    └── images/ # README screenshots/assets
```

## Stop Running Services

Press `Ctrl + C` in the terminal where `./scripts/start_local.sh` is running.

## README Images

Put screenshots and visual assets in:

- `docs/images/`

Example markdown:

```md
![Dashboard Preview](docs/images/dashboard-preview.png)
```
