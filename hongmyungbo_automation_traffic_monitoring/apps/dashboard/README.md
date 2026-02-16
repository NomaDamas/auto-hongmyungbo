# dashboard

collector API를 조회해 트래픽/수익 KPI를 표시하는 UI 서버입니다.

## 실행

```bash
cd apps/dashboard
npm install
COLLECTOR_URL=http://localhost:8090 npm run dev
```

접속: `http://localhost:8091`

## 배포

```bash
docker build -t hmb-dashboard .
docker run --rm -p 8091:8091 -e PORT=8091 -e COLLECTOR_URL=https://<collector-domain> hmb-dashboard
```
