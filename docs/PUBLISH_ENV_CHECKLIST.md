# Publish Environment Checklist

Use this checklist to test OAuth connect + publish in the current Next.js-only runtime.

Set values in `frontend/.env` or `frontend/.env.local`.

## 1) Common

- `OPENAI_API_KEY` or `OPENROUTER_API_KEY`

## 2) LinkedIn

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_AUTHOR_URN` (example: `urn:li:person:xxxx`)
- Redirect URI: `http://localhost:3000/api/oauth/linkedin/callback`

## 3) X

- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET` (if confidential client)
- Redirect URI: `http://localhost:3000/api/oauth/twitter/callback`

## 4) Reddit

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT` (unique value recommended)
- `REDDIT_SUBREDDIT` (target subreddit)
- Redirect URI: `http://localhost:3000/api/oauth/reddit/callback`

## 5) Instagram

- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `INSTAGRAM_IG_USER_ID` (Business/Creator account)
- `INSTAGRAM_IMAGE_URL` (public image URL for posting)
- Redirect URI: `http://localhost:3000/api/oauth/instagram/callback`

## 6) Blog (optional)

- `BLOG_PUBLISH_URL` (custom blog API or webhook)
- `BLOG_PUBLISH_TOKEN` (if required)

## 7) Test Flow

1. Start app: `./scripts/start_local.sh`
2. Click OAuth connect button in UI (LinkedIn/X/Reddit/Instagram)
3. Generate Draft cards and `Accept` target cards
4. Click publish for accepted cards
5. Check result in `/api/jobs/{jobId}` and UI logs
