# Auto-HongMyungbo (Open Source Local Edition)

![Auto-HongMyungbo Preview](docs/images/ddalcak_myungbo.png)

하나의 초안(Draft)으로 여러 SNS용 글을 만들고, 수정하고, 순차 발행까지 할 수 있는 로컬 실행 도구입니다.

## 목차

- [1. 이 프로젝트가 하는 일](#1-이-프로젝트가-하는-일)
- [2. 정말 쉬운 설치 (처음 사용자용)](#2-정말-쉬운-설치-처음-사용자용)
- [3. 첫 실행](#3-첫-실행)
- [4. 실제 사용 방법 (처음부터 끝까지)](#4-실제-사용-방법-처음부터-끝까지)
- [5. 핵심 기능 빠르게 이해하기](#5-핵심-기능-빠르게-이해하기)
- [6. 로그인/발행 동작 방식](#6-로그인발행-동작-방식)
- [7. 자주 나는 오류와 해결](#7-자주-나는-오류와-해결)
- [8. 프로젝트 구조](#8-프로젝트-구조)

## 1. 이 프로젝트가 하는 일

- Next.js 하나로 UI + API가 같이 실행됩니다.
- 외부 DB 없이 로컬 파일(`local_store.json`)에 상태를 저장합니다.
- 기본 발행 방식은 브라우저 자동화(Playwright)입니다.
- 지원 흐름:
  - Draft 작성
  - 플랫폼별 생성
  - Preview/Edit
  - Queue 관리
  - 순차 발행 (`Post Next Platform`, `Post All (Beta)`)

## 2. 정말 쉬운 설치 (처음 사용자용)

### 2-1. 준비물

- macOS / Linux / Windows(WSL 권장)
- Git
- Node.js 20 이상
- 터미널
- LLM API Key 1개 이상
  - OpenAI 또는 OpenRouter (필수 수준)
  - Anthropic / Grok / Gemini (선택)

API 키 발급 가이드는 `docs/API_KEYS.md` 참고

### 2-2. 설치 명령

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
./scripts/setup_local_easy.sh
```

### 2-3. 환경변수 파일 만들기

`frontend/.env` 또는 `frontend/.env.local` 파일 생성:

```env
# 최소 1개는 필요
OPENROUTER_API_KEY=your_key_here
# 또는
OPENAI_API_KEY=your_key_here

# 선택
ANTHROPIC_API_KEY=your_key_here
GROK_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

Instagram 자동 업로드까지 쓰고 싶다면:

```env
INSTAGRAM_MEDIA_PATH=docs/images/sample.jpg
```

## 3. 첫 실행

```bash
./scripts/start_local.sh
```

브라우저에서 열기:

- `http://localhost:3000`

종료:

- 서버 실행 터미널에서 `Ctrl + C`

## 4. 실제 사용 방법 (처음부터 끝까지)

### Step 1) Draft 작성

왼쪽 `Draft` 박스에 초안을 붙여넣습니다.

### Step 2) 옵션 설정

`Options`에서 아래를 설정합니다.

- Provider
- Model
- API Keys
- Thinking / Temperature / Token 등

### Step 3) (선택) Draft 강화

- `Draft Idea Booster`: 아이디어 구조화
- `Aggro Pingpong`: 강한 훅 아이디어
- `Phrase Booster`: 특정 문구를 더 강하게
  - Draft에서 문구를 드래그하면 `Phrase Booster` 버튼이 뜸
  - 클릭하면 채팅형 패널에서 표현 강화 가능

### Step 4) 플랫폼별 생성

`Generate N Platforms` 클릭

- 생성 중 버튼 hover 시 `Cancel`이 나타나고 취소할 수 있음

### Step 5) 결과 검토

오른쪽 `Platform Results`에서:

- Preview로 읽기
- Edit로 수정
- Accept / Reject

Accept하면 Queue로 이동합니다.

### Step 6) 로그인

각 플랫폼의 `Browser Login` 버튼으로 1회 로그인합니다.

- Connected가 떠도 발행 전에 재검증(preflight)됩니다.

### Step 7) 발행

- `Post Next Platform`: 가이드형, 한 플랫폼씩
- `Post All (Beta)`: Queue를 순차 자동 발행
- Queue 카드별 `Publish now`: 개별 발행

실패 시:

- 해당 플랫폼에서 멈추고 재시도/수동 전환 가능

## 5. 핵심 기능 빠르게 이해하기

### Preview vs Edit

- Preview: 읽기 중심
- Edit: 직접 수정

### Compare mode

- OFF(기본): 한 플랫폼 집중 보기
- ON: 여러 플랫폼 비교 보기

### Saved Drafts

- 자동 저장된 초안 이력 복원 가능
- 삭제하면 로컬 히스토리에서도 제거됨

### Theme (Dark/Light)

- 화면 우하단 해/달 버튼으로 전환
- 선택값은 브라우저에 저장됨

## 6. 로그인/발행 동작 방식

- 로그인 상태는 실제 브라우저 세션 기준으로 판단합니다.
- 발행 전 로그인 preflight 체크가 들어갑니다.
- 수동 발행 플랫폼(예: Reddit 등)은 창/탭 이탈까지 감지해 stuck 상태를 줄였습니다.
- 실패 시 Queue 유지, 성공 시 Queue에서 제거됩니다.

## 7. 자주 나는 오류와 해결

### 1) `OpenAI/OpenRouter not configured`

- `frontend/.env` 확인
- 서버 재시작: `./scripts/start_local.sh`

### 2) `Playwright not installed`

```bash
./scripts/setup_local_easy.sh
```

### 3) `LLM request failed: unsupported parameter/value`

- 일부 최신 모델은 sampling 파라미터 제한이 있습니다.
- 현재 코드는 자동 fallback 재시도를 포함합니다.
- 계속 실패하면 다른 모델로 바꿔서 테스트하세요.

### 4) 로그인은 Connected인데 발행 실패

- 해당 플랫폼 `Disconnect` 후 `Browser Login` 재실행
- 플랫폼 사이트 UI 변경으로 자동화가 실패할 수 있음 (수동 완료 가능)

### 5) Queue가 안 비워짐

- 발행 로그 상태 확인 후 새로고침 1회

## 8. 프로젝트 구조

```text
.
├── frontend/
│   ├── src/app/api/      # Next.js API routes
│   ├── src/components/   # UI components
│   ├── src/lib/          # client helpers/types
│   └── src/server/       # LLM + store + automation logic
├── scripts/              # setup/run scripts
└── docs/                 # docs + images
```
