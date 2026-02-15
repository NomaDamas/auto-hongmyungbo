# Publish Environment Checklist

이 문서대로 `backend/.env`를 채우면 OAuth 연결 + 실제 게시 테스트를 진행할 수 있습니다.

## 1) 공통

- `OPENAI_API_KEY`
- `ALLOWED_ORIGIN=http://localhost:3000`
- `DB_PATH=./app.db`

## 2) LinkedIn

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_AUTHOR_URN` (예: `urn:li:person:xxxx`)
- Redirect URI 등록: `http://localhost:8000/api/oauth/linkedin/callback`

## 3) X (Twitter)

- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET` (confidential client인 경우)
- Redirect URI 등록: `http://localhost:8000/api/oauth/twitter/callback`

## 4) Reddit

- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT` (고유 값 권장)
- `REDDIT_SUBREDDIT` (실제 게시 대상)
- Redirect URI 등록: `http://localhost:8000/api/oauth/reddit/callback`

## 5) Instagram

- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `INSTAGRAM_IG_USER_ID` (Business/Creator 계정)
- `INSTAGRAM_IMAGE_URL` (게시용 공개 이미지 URL)
- Redirect URI 등록: `http://localhost:8000/api/oauth/instagram/callback`

## 6) Blog (선택)

- `BLOG_PUBLISH_URL` (자체 블로그 API 또는 webhook)
- `BLOG_PUBLISH_TOKEN` (필요 시)

## 7) 테스트 순서

1. 백엔드/프론트 실행
2. UI에서 OAuth 연결 버튼(LinkedIn/X/Reddit/Instagram) 클릭
3. Draft 생성 후 카드 `Accept`
4. `Accepted 카드 발행` 클릭
5. `GET /api/jobs/{job_id}` 결과에서 플랫폼별 성공/실패 확인
