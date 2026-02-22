# AI Social Cross-Posting Agent

This repository contains a prototype cross-posting product that generates and publishes platform-specific content from one draft.

## Architecture

- `frontend/` (Next.js): user-facing app for drafting, review, approval, and publish actions
- `backend/` (FastAPI): AI generation, OAuth callbacks, publish queue worker, and external API orchestration
- Traffic monitoring is maintained in a separate repository:
  - `https://github.com/minsing-jin/hongmyungbo_automation_traffic_monitoring.git`

## Stack Decision

- Current local storage: SQLite (`backend/app.db`)
- Planned migration: Supabase/Postgres for product data and auth
- Keep **FastAPI** for server-only workflows:
  - OpenAI calls and secret management
  - Social OAuth token exchange/callback handling
  - Scheduled/queued publishing jobs
  - Unified publishing and OAuth APIs

## Repository Layout

```text
.
├── backend/
├── frontend/
├── hongmyungbo_automation_traffic_monitoring/
├── docs/
└── scripts/
```

## Local Development

### 1) Backend

```bash
cd backend
cp .env.example .env
uv sync
uv run python -m uvicorn app.main:app --reload --port 8000
```

### 2) Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Key API Endpoints

- `POST /api/generate`
- `POST /api/refine`
- `POST /api/publish`
- `GET /api/jobs/{job_id}`
- `GET /api/auth/me`

## Deployment Notes

- Frontend: Vercel (set `NEXT_PUBLIC_API_URL`)
- Backend: Railway/Render (set `DB_PATH`, `OPENAI_API_KEY`, OAuth envs)
- Traffic monitor: deploy from the dedicated repository above
