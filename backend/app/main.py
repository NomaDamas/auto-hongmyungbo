import asyncio
import base64
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from app import store

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Platform(str, Enum):
    reddit = "reddit"
    linkedin = "linkedin"
    twitter = "twitter"
    instagram = "instagram"
    blog = "blog"


PLATFORM_PROMPTS: Dict[Platform, str] = {
    Platform.reddit: (
        "You are a Reddit post strategist. Output JSON with keys: title, body, suggestions. "
        "Tone: community-friendly and discussion-driven. Include 2-4 open-ended questions in body. "
        "Avoid sounding overly promotional."
    ),
    Platform.linkedin: (
        "You are a LinkedIn ghostwriter. Output JSON with keys: title, body, suggestions. "
        "Tone: professional, insight-driven, practical. Use short paragraphs with line breaks. "
        "Include a clear business takeaway and one CTA for comments."
    ),
    Platform.twitter: (
        "You are an X (Twitter) copywriter. Output JSON with keys: title, body, suggestions. "
        "Create either a strong single post or a short thread with numbered lines. "
        "Prefer concise hooks, strong first line, and clarity under platform constraints."
    ),
    Platform.instagram: (
        "You are an Instagram caption writer. Output JSON with keys: title, body, suggestions. "
        "Tone: emotional and visual. Include emojis naturally, storytelling cadence, and a final hashtag block. "
        "Keep hashtags relevant (8-15)."
    ),
    Platform.blog: (
        "You are a blog editor focused on SEO and structure. Output JSON with keys: title, body, suggestions. "
        "Write in Markdown with clear headings, intro, key sections, and conclusion. "
        "Include keywords naturally and avoid keyword stuffing."
    ),
}


class StyleMode(str, Enum):
    auto = "auto"
    manual = "manual"


class PlatformStyle(BaseModel):
    mode: StyleMode = StyleMode.manual
    customInstructions: Optional[str] = None
    extractedTone: Optional[str] = None
    referencePosts: List[str] = Field(default_factory=list)


class UserProfile(BaseModel):
    styles: Dict[Platform, PlatformStyle] = Field(default_factory=dict)


class GenerateRequest(BaseModel):
    draft: str
    userProfile: Optional[UserProfile] = None
    model: Optional[str] = None
    platforms: Optional[List[Platform]] = None
    language: Optional[str] = None


class GeneratedCard(BaseModel):
    id: Optional[int] = None
    platform: Platform
    title: str
    body: str
    suggestions: List[str]
    status: str = "draft"


class GenerateResponse(BaseModel):
    draftId: int
    cards: List[GeneratedCard]


class RefineRequest(BaseModel):
    cardId: Optional[int] = None
    platform: Platform
    originalDraft: str
    currentContent: str
    feedback: str
    userProfile: Optional[UserProfile] = None
    model: Optional[str] = None
    language: Optional[str] = None


class CardStatusRequest(BaseModel):
    status: str


class StyleExtractRequest(BaseModel):
    platform: Platform
    referencePosts: List[str]
    model: Optional[str] = None


class StyleExtractResponse(BaseModel):
    extractedTone: str
    systemInstructions: str


class STTResponse(BaseModel):
    text: str


class PublishRequest(BaseModel):
    draftId: int
    cardIds: Optional[List[int]] = None
    acceptedOnly: bool = True


class PublishResponse(BaseModel):
    jobId: int
    status: str


class JobResponse(BaseModel):
    id: int
    type: str
    status: str
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    error: Optional[str]


class OAuthConnectResponse(BaseModel):
    authUrl: str
    state: str


app = FastAPI(title="Cross Posting Agent API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
DEFAULT_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe")

PUBLISH_WORKER_TASK: Optional[asyncio.Task] = None


def build_style_block(platform: Platform, profile: Optional[UserProfile]) -> str:
    if not profile or platform not in profile.styles:
        return "No additional style constraints."

    pstyle = profile.styles[platform]
    if pstyle.mode == StyleMode.auto:
        return (
            "Apply this extracted tone and manner from high-performing posts: "
            f"{pstyle.extractedTone or 'Professional and clear'}"
        )

    if pstyle.customInstructions:
        return f"Follow these custom instructions strictly: {pstyle.customInstructions}"

    return "No additional style constraints."


def card_from_store(data: Dict[str, Any]) -> GeneratedCard:
    return GeneratedCard(
        id=data.get("id"),
        platform=Platform(data["platform"]),
        title=data["title"],
        body=data["body"],
        suggestions=data.get("suggestions", []),
        status=data.get("status", "draft"),
    )


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _pkce_pair() -> tuple[str, str]:
    verifier = _b64url(secrets.token_bytes(48))
    challenge = _b64url(hashlib.sha256(verifier.encode("utf-8")).digest())
    return verifier, challenge


def _expires_at_from_seconds(expires_in: Optional[int]) -> Optional[str]:
    if not expires_in:
        return None
    return (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()


async def generate_for_platform(
    platform: Platform,
    draft: str,
    profile: Optional[UserProfile],
    model: Optional[str],
    language: Optional[str],
) -> GeneratedCard:
    system_prompt = PLATFORM_PROMPTS[platform]
    style_block = build_style_block(platform, profile)

    user_prompt = (
        "Transform the following draft for the target platform.\n"
        f"Target platform: {platform.value}\n"
        f"Output language: {language or 'Same as input'}\n"
        f"Draft:\n{draft}\n\n"
        f"Style constraints:\n{style_block}\n\n"
        "Return strict JSON with shape: "
        '{"title":"...","body":"...","suggestions":["..."]}'
    )

    completion = await client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        response_format={"type": "json_object"},
        temperature=0.7,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    payload = json.loads(completion.choices[0].message.content or "{}")
    return GeneratedCard(
        platform=platform,
        title=payload.get("title", f"{platform.value.title()} Draft"),
        body=payload.get("body", ""),
        suggestions=payload.get("suggestions", ["Shorten opening line", "Clarify CTA"]),
    )


def _clip(value: str, max_len: int) -> str:
    return value if len(value) <= max_len else value[: max_len - 1] + "…"


def _resolve_access_token(platform: str) -> Optional[str]:
    db_token = store.get_oauth_token(platform)
    if db_token and db_token.get("access_token"):
        return str(db_token["access_token"])
    env_token = os.getenv(f"{platform.upper()}_ACCESS_TOKEN", "")
    return env_token or None


async def _publish_linkedin(http: httpx.AsyncClient, title: str, body: str, token: str) -> Dict[str, Any]:
    author_urn = os.getenv("LINKEDIN_AUTHOR_URN", "")
    if not author_urn:
        return {"ok": False, "platform": "linkedin", "mode": "config_error", "message": "Missing LINKEDIN_AUTHOR_URN"}

    payload = {
        "author": author_urn,
        "commentary": f"{title}\n\n{body}",
        "visibility": "PUBLIC",
        "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False,
    }
    resp = await http.post(
        "https://api.linkedin.com/rest/posts",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": os.getenv("LINKEDIN_VERSION", "202502"),
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
    )
    data = resp.json() if resp.text else {}
    if resp.status_code >= 300:
        return {"ok": False, "platform": "linkedin", "mode": "live", "status": resp.status_code, "error": data}
    post_urn = resp.headers.get("x-restli-id") or data.get("id")
    return {"ok": True, "platform": "linkedin", "mode": "live", "postId": post_urn}


async def _publish_twitter(http: httpx.AsyncClient, body: str, token: str) -> Dict[str, Any]:
    text = _clip(body.strip(), 280)
    resp = await http.post(
        "https://api.twitter.com/2/tweets",
        json={"text": text},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    data = resp.json() if resp.text else {}
    if resp.status_code >= 300:
        return {"ok": False, "platform": "twitter", "mode": "live", "status": resp.status_code, "error": data}
    post_id = (data.get("data") or {}).get("id")
    return {"ok": True, "platform": "twitter", "mode": "live", "postId": post_id, "url": f"https://x.com/i/web/status/{post_id}"}


async def _publish_reddit(http: httpx.AsyncClient, title: str, body: str, token: str) -> Dict[str, Any]:
    subreddit = os.getenv("REDDIT_SUBREDDIT", "")
    if not subreddit:
        return {"ok": False, "platform": "reddit", "mode": "config_error", "message": "Missing REDDIT_SUBREDDIT"}

    form = {
        "sr": subreddit,
        "kind": "self",
        "title": _clip(title, 300),
        "text": body,
        "resubmit": "true",
        "api_type": "json",
    }
    resp = await http.post(
        "https://oauth.reddit.com/api/submit",
        data=form,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": os.getenv("REDDIT_USER_AGENT", "cross-posting-agent/0.2"),
        },
    )
    data = resp.json() if resp.text else {}
    errors = (((data.get("json") or {}).get("errors")) or [])
    if resp.status_code >= 300 or errors:
        return {"ok": False, "platform": "reddit", "mode": "live", "status": resp.status_code, "error": data}
    return {"ok": True, "platform": "reddit", "mode": "live", "postId": secrets.token_hex(8), "subreddit": subreddit}


async def _publish_instagram(http: httpx.AsyncClient, body: str, token: str) -> Dict[str, Any]:
    ig_user_id = os.getenv("INSTAGRAM_IG_USER_ID", "")
    image_url = os.getenv("INSTAGRAM_IMAGE_URL", "")
    if not ig_user_id or not image_url:
        return {
            "ok": False,
            "platform": "instagram",
            "mode": "config_error",
            "message": "Missing INSTAGRAM_IG_USER_ID or INSTAGRAM_IMAGE_URL",
        }

    create_resp = await http.post(
        f"https://graph.facebook.com/v22.0/{ig_user_id}/media",
        data={"image_url": image_url, "caption": body, "access_token": token},
    )
    create_data = create_resp.json() if create_resp.text else {}
    creation_id = create_data.get("id")
    if create_resp.status_code >= 300 or not creation_id:
        return {"ok": False, "platform": "instagram", "mode": "live", "status": create_resp.status_code, "error": create_data}

    publish_resp = await http.post(
        f"https://graph.facebook.com/v22.0/{ig_user_id}/media_publish",
        data={"creation_id": creation_id, "access_token": token},
    )
    publish_data = publish_resp.json() if publish_resp.text else {}
    if publish_resp.status_code >= 300:
        return {"ok": False, "platform": "instagram", "mode": "live", "status": publish_resp.status_code, "error": publish_data}
    media_id = publish_data.get("id")
    return {"ok": True, "platform": "instagram", "mode": "live", "postId": media_id}


async def _publish_blog(http: httpx.AsyncClient, title: str, body: str) -> Dict[str, Any]:
    endpoint = os.getenv("BLOG_PUBLISH_URL", "")
    token = os.getenv("BLOG_PUBLISH_TOKEN", "")
    slug = "-".join(title.lower().split()[:6]) or "post"
    if not endpoint:
        return {
            "ok": True,
            "platform": "blog",
            "mode": "simulated",
            "postId": f"blog_{secrets.token_hex(6)}",
            "url": f"https://your-blog.local/posts/{slug}",
        }

    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = await http.post(endpoint, json={"title": title, "markdown": body, "slug": slug}, headers=headers)
    data = resp.json() if resp.text else {}
    if resp.status_code >= 300:
        return {"ok": False, "platform": "blog", "mode": "live", "status": resp.status_code, "error": data}
    return {
        "ok": True,
        "platform": "blog",
        "mode": "live",
        "postId": data.get("id") or secrets.token_hex(8),
        "url": data.get("url"),
    }


async def publish_to_platform(platform: str, title: str, body: str) -> Dict[str, Any]:
    token = _resolve_access_token(platform)
    async with httpx.AsyncClient(timeout=20.0) as http:
        if platform == "linkedin":
            if not token:
                return {"ok": False, "platform": "linkedin", "mode": "missing_token", "message": "Connect OAuth first"}
            return await _publish_linkedin(http, title, body, token)
        if platform == "twitter":
            if not token:
                return {"ok": False, "platform": "twitter", "mode": "missing_token", "message": "Connect OAuth first"}
            return await _publish_twitter(http, body, token)
        if platform == "reddit":
            if not token:
                return {"ok": False, "platform": "reddit", "mode": "missing_token", "message": "Connect OAuth first"}
            return await _publish_reddit(http, title, body, token)
        if platform == "instagram":
            if not token:
                return {"ok": False, "platform": "instagram", "mode": "missing_token", "message": "Connect OAuth first"}
            return await _publish_instagram(http, body, token)
        if platform == "blog":
            return await _publish_blog(http, title, body)
    return {"ok": False, "platform": platform, "mode": "unsupported", "message": "Unsupported platform"}


async def publish_worker() -> None:
    while True:
        job = store.get_next_queued_job()
        if not job:
            await asyncio.sleep(0.5)
            continue

        try:
            payload = job["payload"]
            cards = store.list_cards_for_draft(payload["draftId"])

            card_ids = set(payload.get("cardIds") or [])
            accepted_only = bool(payload.get("acceptedOnly", True))
            selected = []
            for c in cards:
                if card_ids and c["id"] not in card_ids:
                    continue
                if accepted_only and c["status"] != "accepted":
                    continue
                selected.append(c)

            results = []
            for card in selected:
                result = await publish_to_platform(card["platform"], card["title"], card["body"])
                results.append(result)

            store.finish_job(job["id"], {"published": results, "count": len(results)})
        except Exception as exc:  # noqa: BLE001
            store.fail_job(job["id"], str(exc))


@app.on_event("startup")
async def startup_event() -> None:
    global PUBLISH_WORKER_TASK
    store.init_db()
    if PUBLISH_WORKER_TASK is None:
        PUBLISH_WORKER_TASK = asyncio.create_task(publish_worker())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global PUBLISH_WORKER_TASK
    if PUBLISH_WORKER_TASK:
        PUBLISH_WORKER_TASK.cancel()
        PUBLISH_WORKER_TASK = None


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_content(req: GenerateRequest) -> GenerateResponse:
    if not req.draft.strip():
        raise HTTPException(status_code=400, detail="Draft cannot be empty")

    selected_platforms = req.platforms or list(Platform)
    if not selected_platforms:
        raise HTTPException(status_code=400, detail="At least one platform must be selected")

    tasks = [generate_for_platform(platform, req.draft, req.userProfile, req.model, req.language) for platform in selected_platforms]
    cards = await asyncio.gather(*tasks)

    draft_id = store.create_draft(req.draft)
    persisted: List[GeneratedCard] = []
    for card in cards:
        card_id = store.create_card(
            draft_id=draft_id,
            platform=card.platform.value,
            title=card.title,
            body=card.body,
            suggestions=card.suggestions,
            status=card.status,
        )
        persisted.append(card.model_copy(update={"id": card_id}))

    return GenerateResponse(draftId=draft_id, cards=persisted)


@app.get("/api/drafts/{draft_id}/cards", response_model=List[GeneratedCard])
async def get_cards(draft_id: int) -> List[GeneratedCard]:
    cards = store.list_cards_for_draft(draft_id)
    return [card_from_store(c) for c in cards]


@app.post("/api/cards/{card_id}/status", response_model=GeneratedCard)
async def update_card_status(card_id: int, req: CardStatusRequest) -> GeneratedCard:
    if req.status not in {"draft", "accepted", "rejected"}:
        raise HTTPException(status_code=400, detail="status must be draft|accepted|rejected")

    card = store.get_card(card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    store.update_card_status(card_id, req.status)
    card = store.get_card(card_id)
    return card_from_store(card or {})


@app.post("/api/refine", response_model=GeneratedCard)
async def refine_content(req: RefineRequest) -> GeneratedCard:
    system_prompt = PLATFORM_PROMPTS[req.platform]
    style_block = build_style_block(req.platform, req.userProfile)

    user_prompt = (
        "You are refining an already generated post while preserving platform fit.\n"
        f"Platform: {req.platform.value}\n"
        f"Output language: {req.language or 'Same as input'}\n"
        f"Original user draft:\n{req.originalDraft}\n\n"
        f"Current generated content:\n{req.currentContent}\n\n"
        f"User feedback to apply:\n{req.feedback}\n\n"
        f"Style constraints:\n{style_block}\n\n"
        "Return strict JSON with shape: "
        '{"title":"...","body":"...","suggestions":["..."]}'
    )

    completion = await client.chat.completions.create(
        model=req.model or DEFAULT_MODEL,
        response_format={"type": "json_object"},
        temperature=0.7,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    payload = json.loads(completion.choices[0].message.content or "{}")
    updated = GeneratedCard(
        id=req.cardId,
        platform=req.platform,
        title=payload.get("title", f"{req.platform.value.title()} Draft"),
        body=payload.get("body", ""),
        suggestions=payload.get("suggestions", ["Try a stronger hook", "Reduce repetition"]),
        status="draft",
    )

    if req.cardId is not None:
        card = store.get_card(req.cardId)
        if card:
            store.update_card_content(
                req.cardId,
                title=updated.title,
                body=updated.body,
                suggestions=updated.suggestions,
                status="draft",
            )
            persisted = store.get_card(req.cardId)
            if persisted:
                return card_from_store(persisted)

    return updated


@app.post("/api/style/extract", response_model=StyleExtractResponse)
async def extract_style(req: StyleExtractRequest) -> StyleExtractResponse:
    if not req.referencePosts:
        raise HTTPException(status_code=400, detail="referencePosts is required")

    prompt = (
        f"Analyze the following high-performing {req.platform.value} posts and extract tone/style instructions.\n"
        "Return JSON with keys: extractedTone, systemInstructions.\n\n"
        + "\n---\n".join(req.referencePosts)
    )

    completion = await client.chat.completions.create(
        model=req.model or DEFAULT_MODEL,
        response_format={"type": "json_object"},
        temperature=0.3,
        messages=[
            {"role": "system", "content": "You are an expert writing-style analyst."},
            {"role": "user", "content": prompt},
        ],
    )

    payload = json.loads(completion.choices[0].message.content or "{}")
    extracted = payload.get("extractedTone", "Clear, concise, practical")
    instructions = payload.get("systemInstructions", "Use concise insight-first structure.")

    store.upsert_style_profile(
        platform=req.platform.value,
        mode="auto",
        custom_instructions=None,
        extracted_tone=extracted,
        reference_posts=req.referencePosts,
    )

    return StyleExtractResponse(extractedTone=extracted, systemInstructions=instructions)


@app.post("/api/stt", response_model=STTResponse)
async def transcribe_voice(file: UploadFile = File(...)) -> STTResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    audio_bytes = await file.read()
    transcription = await client.audio.transcriptions.create(
        model=DEFAULT_STT_MODEL,
        file=(file.filename, audio_bytes, file.content_type or "audio/webm"),
    )

    text = getattr(transcription, "text", "").strip()
    if not text:
        raise HTTPException(status_code=500, detail="Failed to transcribe audio")

    return STTResponse(text=text)


@app.post("/api/publish", response_model=PublishResponse)
async def enqueue_publish(req: PublishRequest) -> PublishResponse:
    job_id = store.create_job(
        "publish",
        {
            "draftId": req.draftId,
            "cardIds": req.cardIds or [],
            "acceptedOnly": req.acceptedOnly,
        },
    )
    return PublishResponse(jobId=job_id, status="queued")


@app.get("/api/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: int) -> JobResponse:
    job = store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(
        id=job["id"],
        type=job["type"],
        status=job["status"],
        payload=job["payload"],
        result=job["result"],
        error=job.get("error"),
    )


@app.get("/api/oauth/{platform}/connect", response_model=OAuthConnectResponse)
async def oauth_connect(platform: Platform, redirectUri: str = Query(..., min_length=1)) -> OAuthConnectResponse:
    state = secrets.token_urlsafe(24)
    params: Dict[str, str] = {}
    base = ""
    code_verifier: Optional[str] = None

    if platform == Platform.linkedin:
        client_id = os.getenv("LINKEDIN_CLIENT_ID", "")
        base = "https://www.linkedin.com/oauth/v2/authorization"
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirectUri,
            "scope": "openid profile w_member_social email",
            "state": state,
        }
    elif platform == Platform.twitter:
        client_id = os.getenv("TWITTER_CLIENT_ID", "")
        base = "https://twitter.com/i/oauth2/authorize"
        code_verifier, code_challenge = _pkce_pair()
        params = {
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": redirectUri,
            "scope": "tweet.read tweet.write users.read offline.access",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
    elif platform == Platform.instagram:
        client_id = os.getenv("INSTAGRAM_CLIENT_ID", "")
        base = "https://api.instagram.com/oauth/authorize"
        params = {
            "client_id": client_id,
            "redirect_uri": redirectUri,
            "scope": "instagram_business_basic,instagram_business_content_publish",
            "response_type": "code",
            "state": state,
        }
    elif platform == Platform.reddit:
        client_id = os.getenv("REDDIT_CLIENT_ID", "")
        base = "https://www.reddit.com/api/v1/authorize"
        params = {
            "client_id": client_id,
            "response_type": "code",
            "state": state,
            "redirect_uri": redirectUri,
            "duration": "permanent",
            "scope": "identity submit",
        }
    else:
        raise HTTPException(status_code=400, detail="OAuth not required for blog")

    if not client_id:
        raise HTTPException(status_code=400, detail=f"Missing {platform.value.upper()}_CLIENT_ID")

    store.create_oauth_state(state, platform.value, redirectUri, code_verifier)
    auth_url = f"{base}?{urlencode(params)}"
    return OAuthConnectResponse(authUrl=auth_url, state=state)


@app.get("/api/oauth/{platform}/callback")
async def oauth_callback(
    platform: Platform,
    code: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
) -> Dict[str, str]:
    state_row = store.pop_oauth_state(state)
    if not state_row:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    if state_row["platform"] != platform.value:
        raise HTTPException(status_code=400, detail="OAuth state/platform mismatch")

    redirect_uri = state_row["redirect_uri"]
    token_payload: Dict[str, Any]

    async with httpx.AsyncClient(timeout=20.0) as http:
        if platform == Platform.linkedin:
            client_id = os.getenv("LINKEDIN_CLIENT_ID", "")
            client_secret = os.getenv("LINKEDIN_CLIENT_SECRET", "")
            if not client_id or not client_secret:
                raise HTTPException(status_code=400, detail="Missing LinkedIn OAuth credentials")

            resp = await http.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_payload = resp.json()
        elif platform == Platform.twitter:
            client_id = os.getenv("TWITTER_CLIENT_ID", "")
            if not client_id:
                raise HTTPException(status_code=400, detail="Missing Twitter OAuth credentials")

            data: Dict[str, str] = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "code_verifier": state_row.get("code_verifier") or "",
            }
            headers = {"Content-Type": "application/x-www-form-urlencoded"}

            # Confidential clients can also provide client secret.
            twitter_secret = os.getenv("TWITTER_CLIENT_SECRET", "")
            if twitter_secret:
                basic = base64.b64encode(f"{client_id}:{twitter_secret}".encode("utf-8")).decode("utf-8")
                headers["Authorization"] = f"Basic {basic}"
                data.pop("client_id", None)

            resp = await http.post("https://api.twitter.com/2/oauth2/token", data=data, headers=headers)
            token_payload = resp.json()
        elif platform == Platform.instagram:
            client_id = os.getenv("INSTAGRAM_CLIENT_ID", "")
            client_secret = os.getenv("INSTAGRAM_CLIENT_SECRET", "")
            if not client_id or not client_secret:
                raise HTTPException(status_code=400, detail="Missing Instagram OAuth credentials")

            resp = await http.post(
                "https://api.instagram.com/oauth/access_token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_payload = resp.json()
        elif platform == Platform.reddit:
            client_id = os.getenv("REDDIT_CLIENT_ID", "")
            client_secret = os.getenv("REDDIT_CLIENT_SECRET", "")
            if not client_id or not client_secret:
                raise HTTPException(status_code=400, detail="Missing Reddit OAuth credentials")

            basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
            resp = await http.post(
                "https://www.reddit.com/api/v1/access_token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={
                    "Authorization": f"Basic {basic}",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": os.getenv("REDDIT_USER_AGENT", "cross-posting-agent/0.2"),
                },
            )
            token_payload = resp.json()
        else:
            raise HTTPException(status_code=400, detail="OAuth callback not supported for blog")

    if "error" in token_payload or not token_payload.get("access_token"):
        raise HTTPException(status_code=400, detail=f"OAuth token exchange failed: {token_payload}")

    access_token = token_payload.get("access_token", "")
    refresh_token = token_payload.get("refresh_token")
    expires_at = _expires_at_from_seconds(token_payload.get("expires_in"))

    store.upsert_oauth_token(platform.value, access_token, refresh_token, expires_at)
    os.environ[f"{platform.value.upper()}_ACCESS_TOKEN"] = access_token

    return {"status": "connected", "platform": platform.value, "state": state}
