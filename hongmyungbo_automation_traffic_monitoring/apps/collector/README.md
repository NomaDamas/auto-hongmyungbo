# collector

이벤트 수집 및 집계 API 서버입니다.

## 실행

```bash
cd apps/collector
npm install
npm run dev
```

## 배포

```bash
docker build -t hmb-collector .
docker run --rm -p 8090:8090 -e PORT=8090 hmb-collector
```

## 엔드포인트

- `POST /api/events`
- `GET /api/summary`
- `GET /health`
