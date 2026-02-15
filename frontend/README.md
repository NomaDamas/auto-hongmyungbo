# Frontend (Next.js)

## Run

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

## 주요 UX

- Modern SNS style UI (light/dark 대응)
- Platform Results 가로 캐러셀 + drag-to-scroll
- Accept 시 왼쪽 Queue로 이동, Queue 클릭 시 Restore
- 카드 버전 히스토리 + Undo/Redo
- Edit/Voice Edit + 수정 로딩 오버레이
- 플랫폼별 스타일 Context 설정 패널
- 모델 선택 (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`)

## Env

- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- 선택: `NEXT_PUBLIC_HMB_IMAGE_URL=<image-url>`
