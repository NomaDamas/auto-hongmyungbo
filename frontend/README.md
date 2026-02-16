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
- Platform Results 가로 스크롤 카드 트랙
- Accept 시 왼쪽 Queue로 이동, Queue 클릭 시 Restore
- 카드 버전 히스토리 + Undo/Redo
- Preview 더보기/접기 + 필요 시 Preview Edit
- 플랫폼별 스타일 Context 설정 패널
- 모델 선택 (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`)
- 출력 언어 선택 (`auto`, `korean`, `english`, `japanese`)
- 플랫폼 선택 후 선택된 플랫폼만 생성/자동게시 옵션
- AdSlot 컴포넌트 (AdSense, 기본 비활성 모듈)
- Traffic & Revenue Monitor 패널 (이벤트 집계 + 예상 광고수익)

## Env

- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- `NEXT_PUBLIC_ENABLE_ADS=false` (기본, 수익화 시 true)
- `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-...` (선택)
- `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=...` (선택)
- `NEXT_PUBLIC_ADSENSE_SLOT_FOOTER=...` (선택)
- 선택: `NEXT_PUBLIC_HMB_IMAGE_URL=<image-url>`

## 배포 (Vercel)

1. `auto_hongmyungbo_frontend` repo 연결
2. Build Command: `npm run build`
3. Env 변수 입력 후 배포
