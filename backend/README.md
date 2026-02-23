# Backend (Legacy Reference)

This folder contains the previous FastAPI implementation.

Current open-source local runtime no longer requires this backend.  
The app now runs with Next.js API routes in:

- `frontend/src/app/api/*`

## Current Recommended Run Path

From repo root:

```bash
./scripts/setup_local.sh
./scripts/start_local.sh
```

The active local flow is:

- Next.js frontend + Next.js server routes
- Local JSON persistence via `STORE_PATH`
- No separate Python server required
