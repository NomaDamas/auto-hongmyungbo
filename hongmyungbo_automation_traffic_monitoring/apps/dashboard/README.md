# dashboard

UI server that reads collector API data and displays traffic/revenue KPI metrics.

## Run

```bash
cd apps/dashboard
npm install
COLLECTOR_URL=http://localhost:8090 npm run dev
```

Open: `http://localhost:8091`

## Deploy

```bash
docker build -t hmb-dashboard .
docker run --rm -p 8091:8091 -e PORT=8091 -e COLLECTOR_URL=https://<collector-domain> hmb-dashboard
```
