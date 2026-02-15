# Backend (FastAPI)

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
- `GET /api/drafts/{draft_id}/cards`
- `POST /api/cards/{card_id}/status`
- `POST /api/refine`
- `POST /api/style/extract`
- `POST /api/stt`
- `POST /api/publish`
- `GET /api/jobs/{job_id}`
- `GET /api/oauth/{platform}/connect`
- `GET /api/oauth/{platform}/callback`
- `GET /health`

## Publish Config

Set these in `.env` for real publish:

- `LINKEDIN_AUTHOR_URN`
- `REDDIT_SUBREDDIT`
- `INSTAGRAM_IG_USER_ID`
- `INSTAGRAM_IMAGE_URL`
- `BLOG_PUBLISH_URL` (optional webhook/API)
