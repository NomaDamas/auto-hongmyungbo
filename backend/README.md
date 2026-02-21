# Backend (FastAPI)

FastAPI is the orchestration layer for AI generation, publishing jobs, OAuth callbacks, and secure secret handling.

## Role in the Stack

- Use Supabase for user auth and product data persistence.
- Use this backend for operations that must stay server-side:
  - OpenAI calls with secret keys
  - Social platform OAuth token exchange
  - Scheduled/queued publishing workflows
  - Centralized analytics aggregation endpoints

Local SQLite in this service is intended for development/prototype mode.

## Run

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

## Re-run

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `POST /api/generate`
- `POST /api/refine`
- `POST /api/style/extract`
- `POST /api/stt`
- `GET /api/drafts/{draft_id}/cards`
- `POST /api/cards/{card_id}/status`
- `POST /api/publish`
- `GET /api/jobs/{job_id}`
- `GET /api/publish/logs`
- `GET /api/threads`
- `POST /api/analytics/events`
- `GET /api/analytics/summary`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/{provider}/connect` (`google|kakao|naver`)
- `GET /api/auth/{provider}/callback`
- `GET /api/oauth/{platform}/connect`
- `GET /api/oauth/{platform}/callback`
- `GET /health`

## Publish Config

Required for real publishing:

- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_AUTHOR_URN`
- X: `TWITTER_CLIENT_ID` (and `TWITTER_CLIENT_SECRET` if required)
- Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_SUBREDDIT`, `REDDIT_USER_AGENT`
- Instagram: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_IG_USER_ID`, `INSTAGRAM_IMAGE_URL`

## Deployment

Start command:

```bash
uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required envs:

- `OPENAI_API_KEY`
- `ALLOWED_ORIGIN=https://<frontend-domain>` or
- `ALLOWED_ORIGINS=https://<frontend-domain>,https://<preview-domain>`
- OAuth / publish variables from `.env.example`

## Docker

```bash
cd backend
docker build -t hmb-backend .
docker run --rm -p 8000:8000 --env-file .env hmb-backend
```
