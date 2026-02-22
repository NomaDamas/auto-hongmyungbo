# collector

HTTP API that stores traffic events and computes aggregate metrics.

## Run

```bash
cd apps/collector
npm install
npm run dev
```

## Endpoints

- `POST /api/events`
- `GET /api/summary`
- `GET /health`

## Docker

```bash
docker build -t hmb-collector .
docker run --rm -p 8090:8090 -e PORT=8090 hmb-collector
```
