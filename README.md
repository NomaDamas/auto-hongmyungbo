# AI Social Cross-Posting Agent (Prototype)

This project turns one draft into multiple platform-ready posts (Reddit, LinkedIn, X, Instagram, Blog), then supports review, refinement, scheduling, and publishing.

## Recommended Stack

- Frontend: Next.js
- Product data and auth: Supabase (Postgres + Auth + Storage)
- AI and publishing orchestration: FastAPI service

Why FastAPI still exists:
- It securely handles OpenAI and social platform secrets.
- It centralizes provider OAuth callbacks and publish jobs.
- It runs async server-side workflows that are not safe to expose in browser code.

If you only need auth/data CRUD, use Supabase directly from the frontend.

## Project Structure

```text
.
├── backend
│   ├── app
│   │   ├── main.py
│   │   └── store.py
│   ├── pyproject.toml
│   └── .env.example
├── docs
│   ├── MONOREPO_GITHUB.md
│   ├── PUBLISH_ENV_CHECKLIST.md
│   └── WORKLOG.md
├── hongmyungbo_automation_traffic_monitoring
│   ├── apps
│   │   ├── collector
│   │   └── dashboard
│   └── packages
│       └── shared
└── frontend
    ├── src
    ├── package.json
    └── .env.local.example
```

## Quick Start

### 1) Backend (FastAPI)

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

### 2) Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open: `http://localhost:3000`

## Core APIs

- `POST /api/generate`: generate cards for selected platforms
- `POST /api/refine`: rewrite one card with feedback
- `POST /api/stt`: speech-to-text input
- `POST /api/publish`: enqueue publishing jobs
- `GET /api/jobs/{job_id}`: check publish job status
- `GET /api/publish/logs`: user publish history
- `GET /api/threads`: platform thread history
- `POST /api/analytics/events`: traffic event ingest
- `GET /api/analytics/summary`: traffic + revenue estimation

## Deployment

### Frontend (Vercel)

- Set `NEXT_PUBLIC_API_URL=https://<backend-domain>`

### Backend (Railway/Render)

- Start command:

```bash
uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- Required envs:
  - `OPENAI_API_KEY`
  - OAuth/publish envs from `backend/.env.example`
  - `ALLOWED_ORIGIN` or `ALLOWED_ORIGINS`

### Traffic Monitoring Monorepo

`hongmyungbo_automation_traffic_monitoring` can be deployed independently for event collection and KPI dashboarding.
