# dashboard

UI server that visualizes collector metrics and revenue estimates.

## Run

```bash
cd apps/dashboard
npm install
COLLECTOR_URL=http://localhost:8090 npm run dev
```

Open `http://localhost:8091`.

## Docker

```bash
docker build -t hmb-dashboard .
docker run --rm -p 8091:8091 -e PORT=8091 -e COLLECTOR_URL=https://<collector-domain> hmb-dashboard
```
