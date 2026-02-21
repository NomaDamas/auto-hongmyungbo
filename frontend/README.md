# Frontend (Next.js)

The frontend handles draft input, platform card review, and publishing UX.

## Recommended Data/Auth Setup

Use Supabase from the frontend for:
- User authentication
- User profile and app data storage
- File/image storage if needed

Use FastAPI only for AI generation/publishing operations and provider OAuth flows.

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

## Main UX

- SNS-style responsive UI
- Horizontal platform card track
- Accept/Reject/Edit workflow
- Card version history with Undo/Redo
- Voice-based refine input
- Platform style context panel
- Model selector (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`)
- Output language selector (`auto`, `korean`, `english`, `japanese`)
- OAuth social login (Google/Kakao/Naver)
- Scheduled publish option
- Publish logs and platform threads
- AdSlot component (AdSense, disabled by default)
- Traffic and revenue monitor panel

## Env

- `NEXT_PUBLIC_API_URL=http://localhost:8000`
- `NEXT_PUBLIC_ENABLE_ADS=false`
- `NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-...` (optional)
- `NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=...` (optional)
- `NEXT_PUBLIC_ADSENSE_SLOT_FOOTER=...` (optional)
- `NEXT_PUBLIC_HMB_IMAGE_URL=<image-url>` (optional)

## Deploy (Vercel)

1. Connect the repository
2. Build command: `npm run build`
3. Set env values:
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>`
   - `NEXT_PUBLIC_ENABLE_ADS=false`

## Docker

```bash
cd frontend
docker build -t hmb-frontend .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000 hmb-frontend
```
