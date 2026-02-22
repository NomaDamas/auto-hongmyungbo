# Frontend (Next.js)

The frontend provides the full draft-to-publish user flow.

## Features

- Draft input and multi-platform generation
- Per-platform style transfer using reference posts
- Result navigation modes:
  - Default: platform tabs with one focused card (no horizontal scrolling required)
  - Compare mode: side-by-side multi-column layout
- Card-level accept/reject/edit workflow
- Version history with undo/redo
- Voice-to-text refine input
- OAuth-based social login and account connection
- Scheduled publish trigger
- Publish logs and per-platform thread view
- Long preview readability without entering Edit:
  - Read more / Collapse in Preview
  - Full view modal with Copy action

## Data/Auth Guidance

Use Supabase directly in the frontend for:

- User identity/session handling
- Product data CRUD
- File storage

Use FastAPI for AI generation and publish orchestration APIs.

## Run

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

## Environment Variables

- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- `NEXT_PUBLIC_HMB_IMAGE_URL=` (optional)

## Docker

```bash
cd frontend
docker build -t hmb-frontend .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000 hmb-frontend
```
