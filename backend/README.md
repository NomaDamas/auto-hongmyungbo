# Backend (FastAPI)

For easiest local usage, use the root quick start in `../README.md`:

```bash
./scripts/setup_local.sh
./scripts/start_local.sh
```

This file is for backend-only development.

## Responsibilities

- Generate/refine platform-specific content via OpenAI/OpenRouter
- Apply structured intent constraints and style-sample-based transfer during generation/refinement
- Handle platform OAuth callbacks (`linkedin`, `twitter`, `instagram`, `reddit`)
- Queue and execute publish jobs in the background worker
- Store drafts/cards/jobs/logs/events in a local JSON file store

## Local Store

This backend uses a local JSON store file (`STORE_PATH`, default `./local_store.json`).

- On startup, `store.init_db()` initializes and loads the local store file.
- No external database setup is required.

## Run Locally

```bash
cd backend
cp .env.example .env
uv sync
uv run python -m uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Required Environment Variables

Minimum:

- `STORE_PATH` (optional, default `./local_store.json`)
- `OPENROUTER_API_KEY` (recommended default)
- `OPENAI_API_KEY` (optional, needed for STT/voice refine)
- `FRONTEND_URL`
- `ALLOWED_ORIGIN` or `ALLOWED_ORIGINS`

OAuth/publish values are listed in `.env.example`.

## Main Endpoints

- `POST /api/generate`
- `POST /api/refine`
- `POST /api/style/extract`
- `POST /api/stt`
- `POST /api/publish`
- `GET /api/jobs/{job_id}`
- `GET /api/publish/logs`
- `GET /api/threads`
- `GET /api/oauth/{platform}/connect`
- `GET /api/oauth/{platform}/callback`

## Docker

```bash
cd backend
docker build -t hmb-backend .
docker run --rm -p 8000:8000 --env-file .env hmb-backend
```
