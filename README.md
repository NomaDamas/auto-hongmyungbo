# AI 기반 소셜 미디어 크로스 포스팅 에이전트 (Prototype)

하나의 Draft를 입력하면 Reddit/LinkedIn/X/Instagram/Blog 형식으로 병렬 생성하고,
카드 단위 Review(Accept/Reject/Edit), Voice Refinement(STT), DB 저장, Publish Queue까지 수행하는 프로토타입입니다.

## Project Structure

```text
.
├── backend
│   ├── app
│   │   ├── main.py
│   │   └── store.py
│   ├── pyproject.toml
│   └── .env.example
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

## 1) Backend Run (FastAPI)

```bash
cd backend
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

## 2) Frontend Run (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## 실행 메뉴얼 (다시 실행 포함)

1. `uv` 설치 (최초 1회)
```bash
brew install uv
```

2. 백엔드 의존성 동기화 + 실행
```bash
cd backend
uv sync
cp .env.example .env   # 최초 1회
# backend/.env 값 입력 (OPENAI_API_KEY, OAuth 관련 값)
uv run uvicorn app.main:app --reload --port 8000
```

3. 프론트 의존성 설치 + 실행
```bash
cd frontend
cp .env.local.example .env.local   # 최초 1회
npm install                         # 최초 1회
npm run dev
```

4. 접속
- `http://localhost:3000`

5. 사용 순서
1. Draft 입력 후 `5개 플랫폼 버전 생성`
2. 카드 `Accept/Reject/Edit`
3. 상단 OAuth 연결 버튼 클릭 (LinkedIn/X/Instagram/Reddit)
4. `Accepted 카드 발행` 클릭
5. 필요 시 `GET /api/jobs/{job_id}`로 발행 상태 확인

6. 다음 실행 때(재실행)
- 백엔드:
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
- 프론트:
```bash
cd frontend
npm run dev
```

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

## Style Modes

- Mode A (auto): reference posts 분석 결과(`extractedTone`)를 플랫폼 스타일로 적용
- Mode B (manual): 플랫폼별 `customInstructions`를 Few-shot/지시문 컨텍스트로 적용

## Notes

- OpenAI API 키가 필요합니다.
- SQLite(`backend/app.db`)로 Draft/Card/Job을 저장합니다.
- Publish는 큐 워커가 처리하며 LinkedIn/X/Reddit/Instagram/Blog API를 직접 호출합니다.
- 토큰/필수 설정값이 없으면 `missing_token` 또는 `config_error` 결과를 반환합니다.
- OAuth connect/callback은 LinkedIn/X/Instagram/Reddit의 authorization_code 토큰 교환을 수행합니다.
- Twitter는 PKCE(S256)를 사용하며 state/verifier는 DB에 저장됩니다.

## Ops Docs

- Publish env 체크리스트: `docs/PUBLISH_ENV_CHECKLIST.md`
- 모노레포/분리 푸시 가이드: `docs/MONOREPO_GITHUB.md`
- 모노레포 최초 푸시 스크립트: `scripts/init_monorepo_github.sh`
- frontend/backend 분리 푸시 스크립트: `scripts/push_split_repos.sh`
