# Backend (FastAPI)

## Run (uv)

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

- `POST /api/generate` (model 선택 가능)
- `POST /api/refine` (model 선택 가능)
- `POST /api/style/extract` (model 선택 가능)
- `POST /api/stt`
- `GET /api/drafts/{draft_id}/cards`
- `POST /api/cards/{card_id}/status`
- `POST /api/publish`
- `GET /api/jobs/{job_id}`
- `GET /api/oauth/{platform}/connect`
- `GET /api/oauth/{platform}/callback`
- `GET /health`

## Publish Config

실제 발행용 필수 값:

- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_AUTHOR_URN`
- X: `TWITTER_CLIENT_ID` (+ 필요 시 `TWITTER_CLIENT_SECRET`)
- Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_SUBREDDIT`, `REDDIT_USER_AGENT`
- Instagram: `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`, `INSTAGRAM_IG_USER_ID`, `INSTAGRAM_IMAGE_URL`

## OAuth 점검 순서

1. Redirect URI가 정확히 일치하는지 확인
2. Client ID/Secret이 `.env`와 콘솔 설정에 일치하는지 확인
3. 플랫폼 앱 권한(scope) 활성화 여부 확인
4. 실패 시 백엔드 로그의 token exchange 에러 payload 확인
