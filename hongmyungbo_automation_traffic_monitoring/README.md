# hongmyungbo_automation_traffic_monitoring

Standalone Node.js monorepo for event collection and KPI/revenue dashboarding.

## Packages

- `apps/collector`: receives events and computes summary metrics
- `apps/dashboard`: renders traffic and revenue dashboard UI
- `packages/shared`: shared metric/revenue logic

## Local Run

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

## Docker Compose

```bash
cd hongmyungbo_automation_traffic_monitoring
docker compose up --build
```

## Deployment

1. Deploy `apps/collector` (Railway/Render/Fly.io)
2. Deploy `apps/dashboard` (Railway/Render/Vercel Node runtime)
3. Set `COLLECTOR_URL` in dashboard runtime env
