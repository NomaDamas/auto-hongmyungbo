# AI 기반 소셜 미디어 크로스 포스팅 에이전트 (Prototype)
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/5e88f6c0-8d65-4488-a36e-a1dbd0903685" />


하나의 Draft를 입력하면 Reddit/LinkedIn/X/Instagram/Blog 형식으로 병렬 생성하고,
카드 단위 Review(Accept/Reject/Edit), Voice Refinement(STT), 버전 히스토리(Undo/Redo), DB 저장, Publish Queue까지 수행하는 프로토타입입니다.

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
    │   ├── app
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── components
    │   │   └── platform-card.tsx
    │   └── lib
    │       ├── api.ts
    │       └── types.ts
    ├── package.json
    └── .env.local.example
```

## Quick Start

### 1) Backend (FastAPI + uv)

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

### 3) 접속

- `http://localhost:3000`

## 광고(AdSense) 모듈 (기본 OFF)

광고 코드는 모듈로 포함되어 있고 기본값은 비활성입니다.  
추후 수익화를 시작할 때만 아래 값을 설정해 활성화하세요.

```bash
NEXT_PUBLIC_ENABLE_ADS=true
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=1234567890
NEXT_PUBLIC_ADSENSE_SLOT_FOOTER=0987654321
```

- 기본 비활성: `NEXT_PUBLIC_ENABLE_ADS=false` 또는 미설정
- 실제 광고 수익화는 AdSense 승인 도메인에서만 가능합니다.

## 실행 메뉴얼 (재실행 포함)

1. `uv` 설치 (최초 1회)
```bash
brew install uv
```

2. 백엔드 재실행
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

3. 프론트 재실행
```bash
cd frontend
npm run dev
```

## 사용 순서

1. Draft 입력 후 `5개 플랫폼 버전 생성`
2. 카드 `Accept/Reject/Edit` (수정 중 로딩 표시)
3. OAuth 연결 버튼 클릭 (LinkedIn/X/Instagram/Reddit)
4. 카드 버전 히스토리(가로 슬라이드) 확인
5. Undo/Redo로 버전 복원/재적용
6. 필요 시 예약 시간 설정 후 `Accepted 카드 발행` 클릭
7. 필요 시 `GET /api/jobs/{job_id}`로 발행 상태 확인

## Core APIs

- `POST /api/generate`: 5개 플랫폼 병렬 생성
- `GET /api/drafts/{draft_id}/cards`: 저장된 카드 조회
- `POST /api/cards/{card_id}/status`: Accept/Reject 상태 저장
- `POST /api/refine`: 카드 단위 수정 재생성
- `POST /api/style/extract`: 고성과 글에서 톤/지침 추출 (Mode A)
- `POST /api/stt`: 음성 파일 -> 텍스트 변환
- `POST /api/publish`: 발행 작업 큐 등록
- `GET /api/jobs/{job_id}`: 큐 상태 조회
- `GET /api/publish/logs`: 로그인 사용자 발행 로그
- `GET /api/threads`: 플랫폼별 발행 스레드
- `POST /api/analytics/events`: 사용자 트래픽 이벤트 수집
- `GET /api/analytics/summary`: 기간별 트래픽/예상 광고수익 집계
- `GET /api/auth/me`: 현재 로그인 사용자
- `POST /api/auth/logout`: 로그아웃
- `GET /api/auth/{provider}/connect`: 간편 로그인 연결
- `GET /api/auth/{provider}/callback`: 간편 로그인 콜백
- `GET /api/oauth/{platform}/connect`: OAuth 연결 URL 생성
- `GET /api/oauth/{platform}/callback`: OAuth 콜백 + access token 저장

## Traffic & Revenue Monitor

- 프론트에서 `page_view / generate / refine / accept / reject / publish` 이벤트를 백엔드로 전송합니다.
- 대시보드에서 아래 가정값으로 예상 광고수익을 즉시 계산합니다.
  - `CPM`
  - `CTR`
  - `CPC`
  - `Fill Rate`
  - `Ad Slots / Page`

## Frontend UX

- 모델 선택: `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`
- 플랫폼 카드 Preview UI
- 카드별 버전 히스토리 칩 (가로 슬라이드)
- Undo/Redo (이전 버전 복원/재적용)
- Edit 재입력 + Voice Edit
- 캠페인형 리디자인 헤더 (`홍명보 파이팅`)
- 히어로 이미지 교체: `NEXT_PUBLIC_HMB_IMAGE_URL`

## Notes

- OpenAI API 키가 필요합니다.
- `backend/.env`를 사용합니다. (루트 `.env` 아님)
- SQLite(`backend/app.db`)로 Draft/Card/Job을 저장합니다.
- Publish는 큐 워커가 처리하며 LinkedIn/X/Reddit/Instagram/Blog API를 직접 호출합니다.
- 토큰/필수 설정값이 없으면 `missing_token` 또는 `config_error` 결과를 반환합니다.
- OAuth connect/callback은 LinkedIn/X/Instagram/Reddit의 authorization_code 토큰 교환을 수행합니다.
- Twitter는 PKCE(S256)를 사용하며 state/verifier는 DB에 저장됩니다.

## Ops Docs

- Publish env 체크리스트: `docs/PUBLISH_ENV_CHECKLIST.md`
- 모노레포/분리 푸시 가이드: `docs/MONOREPO_GITHUB.md`
- 작업 로그(지속 관리): `docs/WORKLOG.md`
- 모노레포 최초 푸시 스크립트: `scripts/init_monorepo_github.sh`
- frontend/backend 분리 푸시 스크립트: `scripts/push_split_repos.sh`

## 배포 가이드 (권장)

### 1) Frontend 배포 (Vercel)

1. `auto_hongmyungbo_frontend` repo를 Vercel에 연결
2. Build Command: `npm run build`
3. Env 설정:
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>`
   - `NEXT_PUBLIC_ENABLE_ADS=false` (기본)
   - `NEXT_PUBLIC_ADSENSE_CLIENT` (선택)
   - `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR` (선택)
   - `NEXT_PUBLIC_ADSENSE_SLOT_FOOTER` (선택)

### 2) Backend 배포 (Railway 또는 Render)

1. `auto_hongmyungbo_backend` repo를 서비스에 연결
2. Start Command:
   - `uv sync && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Env 설정:
   - `OPENAI_API_KEY`
   - OAuth / Publish 관련 환경변수 (`backend/.env.example` 참고)
4. CORS:
   - `ALLOWED_ORIGIN=https://<frontend-domain>`
   - 또는 `ALLOWED_ORIGINS`에 다중 도메인 지정

### 3) Traffic Monitoring 배포

1. `hongmyungbo_automation_traffic_monitoring`를 별도 서비스로 배포
2. collector: `apps/collector`, dashboard: `apps/dashboard`
3. dashboard env:
   - `COLLECTOR_URL=https://<collector-domain>`

### 4) 배포 후 점검

1. 생성/수정/발행 API 동작 확인
2. OAuth callback URL을 배포 도메인으로 재등록
3. AdSense 도메인 승인 및 광고 노출 확인
