# WORKLOG

프로젝트 작업 이력을 날짜별로 누적 관리합니다.

## 운영 규칙

- 날짜 기준으로 섹션 추가 (`YYYY-MM-DD`)
- `Done / In Progress / Next` 3블록 유지
- 기능 변경 시 관련 파일 경로를 함께 기록
- 배포/푸시 시 커밋 해시를 남김

## 2026-02-15

### Done

- 백엔드 의존성 관리 방식 전환: `requirements.txt` -> `uv` (`backend/pyproject.toml`, `backend/uv.lock`)
- `.env` 자동 로딩 추가 (`backend/app/main.py`)
- OAuth 실제 토큰 교환/저장 연결 (LinkedIn/X/Instagram/Reddit)
- 플랫폼별 실제 publish API 호출 연결
- 프론트 리디자인: 홍보형 헤더, `홍명보 파이팅` 카피
- 모델 선택 UI/로직 추가 (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`)
- 플랫폼 카드 개선
  - Preview UI
  - 버전 히스토리(가로 슬라이드)
  - Undo/Redo
  - Edit 로딩 오버레이
- 모노레포 운영 스크립트 추가
  - `scripts/init_monorepo_github.sh`
  - `scripts/push_split_repos.sh`
- 문서 정리
  - `README.md`
  - `docs/MONOREPO_GITHUB.md`
  - `docs/PUBLISH_ENV_CHECKLIST.md`
- 트래픽/수익 모니터링 추가
  - 이벤트 수집 API: `POST /api/analytics/events`
  - 집계/추정 API: `GET /api/analytics/summary`
  - 프론트 모니터 패널(가정값: CPM/FillRate/Slots)
- 광고 모듈 기본 비활성 토글 추가 (`NEXT_PUBLIC_ENABLE_ADS=false`)
- 별도 최상위 모노레포 스캐폴딩 생성
  - `apps/collector`, `apps/dashboard`, `packages/shared`

### In Progress

- OAuth 오류 케이스별 UX 개선 (현재는 alert/백엔드 로그 중심)

### Next

- OAuth 실패 원인별 상세 안내 UI 추가 (redirect mismatch, scope 부족 등)
- publish 결과를 카드 단위로 화면에 더 명확하게 표시
- 이미지/브랜드 자산을 실제 홍명보 감독 사진 소스로 교체 (`NEXT_PUBLIC_HMB_IMAGE_URL`)

### Commits

- `b211769` Use uv for backend deps and load backend/.env automatically
- `2d188bf` Add frontend lockfile and sync uv lock
- `a286887` Add model selector, version history UI, previews, and redesign
