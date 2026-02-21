# collector

Event collection and aggregation API server.

## Run

```bash
cd apps/collector
npm install
npm run dev
```

## Deploy

```bash
docker build -t hmb-collector .
docker run --rm -p 8090:8090 -e PORT=8090 hmb-collector
```

## Endpoints

- `POST /api/events`
- `GET /api/summary`
- `GET /health`
