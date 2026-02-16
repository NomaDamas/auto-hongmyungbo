# hongmyungbo_automation_traffic_monitoring

트래픽 이벤트 수집과 광고 수익 추정을 위한 독립 모노레포입니다.

## 구조

```text
hongmyungbo_automation_traffic_monitoring
├── apps
│   ├── collector
│   │   ├── data/events.json
│   │   └── index.js
│   └── dashboard
│       ├── public/index.html
│       └── server.js
├── packages
│   └── shared
│       └── src/index.js
├── package.json
└── pnpm-workspace.yaml
```

## 실행

```bash
cd hongmyungbo_automation_traffic_monitoring
pnpm install
pnpm dev
```

- collector: `http://localhost:8090`
- dashboard: `http://localhost:8091`

## API

- `POST /api/events`
- `GET /api/summary?days=14&cpm=1.8&ctr=0.012&cpc=0.18&fillRate=0.65&slotsPerPage=2`

## 배포

1. collector -> Railway/Render/Fly.io
2. dashboard -> Railway/Render/Vercel(Node 런타임)
3. collector URL을 dashboard의 `COLLECTOR_URL`로 연결

## Docker Compose (로컬/서버)

```bash
cd hongmyungbo_automation_traffic_monitoring
docker compose up --build
```

- collector: `http://localhost:8090`
- dashboard: `http://localhost:8091`

## 단독 Docker 배포

```bash
# collector
cd apps/collector
docker build -t hmb-collector .
docker run --rm -p 8090:8090 -e PORT=8090 hmb-collector

# dashboard
cd ../dashboard
docker build -t hmb-dashboard .
docker run --rm -p 8091:8091 -e PORT=8091 -e COLLECTOR_URL=http://host.docker.internal:8090 hmb-dashboard
```

## GitHub

원격 저장소:
- `https://github.com/minsing-jin/hongmyungbo_automation_traffic_monitoring.git`
