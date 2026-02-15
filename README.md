# AI 기반 소셜 미디어 크로스 포스팅 에이전트 (Prototype)

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
6. `Accepted 카드 발행` 클릭
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
- `GET /api/oauth/{platform}/connect`: OAuth 연결 URL 생성
- `GET /api/oauth/{platform}/callback`: OAuth 콜백 + access token 저장

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
