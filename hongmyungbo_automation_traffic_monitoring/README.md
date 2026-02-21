# hongmyungbo_automation_traffic_monitoring

Independent monorepo for traffic event collection and ad revenue estimation.

## Structure

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

## Run

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

## Deployment

1. Deploy collector to Railway/Render/Fly.io
2. Deploy dashboard to Railway/Render/Vercel (Node runtime)
3. Set dashboard `COLLECTOR_URL` to your collector endpoint

## Docker Compose

```bash
cd hongmyungbo_automation_traffic_monitoring
docker compose up --build
```

- collector: `http://localhost:8090`
- dashboard: `http://localhost:8091`

## Standalone Docker

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

- `https://github.com/minsing-jin/hongmyungbo_automation_traffic_monitoring.git`
