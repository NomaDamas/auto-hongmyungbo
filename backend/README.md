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
- `POST /api/analytics/events`
- `GET /api/analytics/summary`
- `GET /api/oauth/{platform}/connect`
- `GET /api/oauth/{platform}/callback`
- `GET /health`

## Traffic/Revenue Monitor

- 프론트에서 `POST /api/analytics/events`로 사용자 이벤트를 수집합니다.
- `GET /api/analytics/summary`는 기간 내 트래픽 집계 + 예상 광고수익을 반환합니다.
- 수익 추정 파라미터:
  - `days` (기본 14)
  - `cpm` (기본 1.8)
  - `ctr` (기본 0.012)
  - `cpc` (기본 0.18)
  - `fillRate` (기본 0.65, 0~1)
  - `slotsPerPage` (기본 2)

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

## 배포 (Railway/Render)

Start Command:

```bash
uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

필수 환경변수:

- `OPENAI_API_KEY`
- `ALLOWED_ORIGIN=https://<frontend-domain>` 또는
- `ALLOWED_ORIGINS=https://<frontend-domain>,https://<preview-domain>`
- OAuth / Publish 관련 변수 (`.env.example` 참고)

## Docker 배포

```bash
cd backend
docker build -t hmb-backend .
docker run --rm -p 8000:8000 --env-file .env hmb-backend
```
