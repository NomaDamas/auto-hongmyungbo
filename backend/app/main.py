import asyncio
import base64
import hashlib
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, File, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
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


class SocialProvider(str, Enum):
    google = "google"
    kakao = "kakao"
    naver = "naver"


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


class IntentSpec(BaseModel):
    objective: Optional[str] = None
    targetAudience: Optional[str] = None
    coreMessage: Optional[str] = None
    desiredAction: Optional[str] = None
    mustInclude: List[str] = Field(default_factory=list)
    mustAvoid: List[str] = Field(default_factory=list)
    extraNotes: Optional[str] = None


class GenerationConfig(BaseModel):
    thinkingMode: bool = False
    reasoningEffort: str = "medium"
    temperature: Optional[float] = None
    topP: Optional[float] = None
    maxOutputTokens: Optional[int] = None


class GenerateRequest(BaseModel):
    draft: str
    userProfile: Optional[UserProfile] = None
    model: str
    platforms: Optional[List[Platform]] = None
    language: Optional[str] = None
    languageByPlatform: Optional[Dict[Platform, str]] = None
    provider: Optional[str] = None
    intent: Optional[IntentSpec] = None
    styleSample: Optional[str] = None
    generationConfig: Optional[GenerationConfig] = None


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
    model: str
    language: Optional[str] = None
    provider: Optional[str] = None
    intent: Optional[IntentSpec] = None
    styleSample: Optional[str] = None
    generationConfig: Optional[GenerationConfig] = None


class CardStatusRequest(BaseModel):
    status: str


class StyleExtractRequest(BaseModel):
    platform: Platform
    referencePosts: List[str]
    model: str
    provider: Optional[str] = None


class StyleExtractResponse(BaseModel):
    extractedTone: str
    systemInstructions: str


class STTResponse(BaseModel):
    text: str


class PublishRequest(BaseModel):
    draftId: int
    cardIds: Optional[List[int]] = None
    acceptedOnly: bool = True
    scheduledAt: Optional[str] = None


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


class UserInfo(BaseModel):
    id: int
    name: Optional[str] = None
    email: Optional[str] = None
    avatarUrl: Optional[str] = None


class PublishLogItem(BaseModel):
    id: int
    draftId: Optional[int] = None
    cardId: Optional[int] = None
    platform: str
    title: Optional[str] = None
    body: Optional[str] = None
    postId: Optional[str] = None
    postUrl: Optional[str] = None
    status: str
    errorText: Optional[str] = None
    createdAt: str


class PlatformThread(BaseModel):
    platform: str
    items: List[PublishLogItem]


class AnalyticsEventRequest(BaseModel):
    eventType: str = Field(min_length=2, max_length=64)
    sessionId: Optional[str] = Field(default=None, max_length=128)
    platform: Optional[Platform] = None
    path: Optional[str] = Field(default=None, max_length=255)
    referrer: Optional[str] = Field(default=None, max_length=1024)
    meta: Dict[str, Any] = Field(default_factory=dict)


class DailyTrafficPoint(BaseModel):
    day: str
    totalEvents: int
    pageViews: int
    generateCount: int
    refineCount: int
    acceptCount: int
    rejectCount: int
    publishCount: int


class TrafficTotals(BaseModel):
    totalEvents: int
    pageViews: int
    generateCount: int
    refineCount: int
    acceptCount: int
    rejectCount: int
    publishCount: int


class RevenueEstimate(BaseModel):
    impressions: int
    estimatedClicks: int
    cpmBasedRevenue: float
    cpcBasedRevenue: float
    estimatedRevenue: float
    avgDailyRevenue: float
    projectedMonthlyRevenue: float
    assumptions: Dict[str, float]


class AnalyticsSummaryResponse(BaseModel):
    windowDays: int
    totals: TrafficTotals
    daily: List[DailyTrafficPoint]
    revenueEstimate: RevenueEstimate


def _parse_allowed_origins() -> List[str]:
    raw = os.getenv("ALLOWED_ORIGINS")
    if raw:
        origins = [part.strip() for part in raw.split(",") if part.strip()]
        if origins:
            return origins
    return [os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")]


app = FastAPI(title="Cross Posting Agent API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

openai_client: Optional[AsyncOpenAI] = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
openrouter_client: Optional[AsyncOpenAI] = (
    AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
    if OPENROUTER_API_KEY
    else None
)

# STT always uses OpenAI directly (OpenRouter doesn't support audio)
stt_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
DEFAULT_STT_MODEL = os.getenv("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe")

PUBLISH_WORKER_TASK: Optional[asyncio.Task] = None
SESSION_COOKIE_NAME = "hmb_session"
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _read_runtime_api_keys(request: Request) -> tuple[Optional[str], Optional[str]]:
    openai_key = (request.headers.get("x-openai-api-key") or "").strip() or None
    openrouter_key = (request.headers.get("x-openrouter-api-key") or "").strip() or None
    return openai_key, openrouter_key


def _resolve_text_client(request: Request, provider: Optional[str], model: str) -> AsyncOpenAI:
    header_openai_key, header_openrouter_key = _read_runtime_api_keys(request)
    runtime_openai = AsyncOpenAI(api_key=header_openai_key) if header_openai_key else None
    runtime_openrouter = (
        AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=header_openrouter_key) if header_openrouter_key else None
    )
    resolved_openai = runtime_openai or openai_client
    resolved_openrouter = runtime_openrouter or openrouter_client

    selected = (provider or "").strip().lower()
    if selected == "openrouter":
        if not resolved_openrouter:
            raise HTTPException(status_code=400, detail="OpenRouter provider is not configured")
        return resolved_openrouter
    if selected == "openai":
        if not resolved_openai:
            raise HTTPException(status_code=400, detail="OpenAI provider is not configured")
        return resolved_openai

    # Auto selection fallback.
    if "/" in (model or "") and resolved_openrouter:
        return resolved_openrouter
    if resolved_openrouter:
        return resolved_openrouter
    if resolved_openai:
        return resolved_openai
    raise HTTPException(status_code=500, detail="No text generation provider is configured")


def _resolve_stt_client(request: Request) -> Optional[AsyncOpenAI]:
    runtime_openai_key = (request.headers.get("x-openai-api-key") or "").strip()
    if runtime_openai_key:
        return AsyncOpenAI(api_key=runtime_openai_key)
    return stt_client


def _supports_reasoning_effort(model: str) -> bool:
    lowered = (model or "").lower()
    return lowered.startswith("gpt-5") or lowered.startswith("o1") or lowered.startswith("o3") or lowered.startswith("o4")


def _generation_kwargs(model: str, generation_config: Optional[GenerationConfig], default_temperature: float) -> Dict[str, Any]:
    cfg = generation_config or GenerationConfig()
    kwargs: Dict[str, Any] = {
        "temperature": default_temperature if cfg.temperature is None else max(0.0, min(2.0, float(cfg.temperature))),
    }
    if cfg.topP is not None:
        kwargs["top_p"] = max(0.0, min(1.0, float(cfg.topP)))
    if cfg.maxOutputTokens is not None:
        kwargs["max_tokens"] = max(128, int(cfg.maxOutputTokens))
    if cfg.thinkingMode and _supports_reasoning_effort(model):
        effort = (cfg.reasoningEffort or "medium").lower()
        if effort not in {"minimal", "low", "medium", "high"}:
            effort = "medium"
        kwargs["reasoning_effort"] = effort
    return kwargs


def _trim_for_prompt(text: str, limit: int = 900) -> str:
    s = text.strip()
    if len(s) <= limit:
        return s
    return s[: limit - 1] + "…"


def build_style_block(platform: Platform, profile: Optional[UserProfile]) -> str:
    if not profile or platform not in profile.styles:
        return "No additional style constraints."

    pstyle = profile.styles[platform]
    constraints: List[str] = []

    if pstyle.mode == StyleMode.auto:
        constraints.append(
            "Apply this extracted tone and manner from high-performing posts: "
            f"{pstyle.extractedTone or 'Professional and clear'}"
        )

    if pstyle.customInstructions:
        constraints.append(f"Follow these custom instructions strictly: {_trim_for_prompt(pstyle.customInstructions, 700)}")

    if pstyle.referencePosts:
        samples = [_trim_for_prompt(post, 380) for post in pstyle.referencePosts if post.strip()][:3]
        if samples:
            joined = "\n---\n".join(samples)
            constraints.append(f"Reference style samples:\n{joined}")

    return "\n\n".join(constraints) if constraints else "No additional style constraints."


def build_intent_block(intent: Optional[IntentSpec]) -> str:
    if not intent:
        return "No explicit intent constraints."

    lines: List[str] = []
    if intent.objective and intent.objective.strip():
        lines.append(f"- Objective: {_trim_for_prompt(intent.objective, 220)}")
    if intent.targetAudience and intent.targetAudience.strip():
        lines.append(f"- Target audience: {_trim_for_prompt(intent.targetAudience, 220)}")
    if intent.coreMessage and intent.coreMessage.strip():
        lines.append(f"- Core message: {_trim_for_prompt(intent.coreMessage, 260)}")
    if intent.desiredAction and intent.desiredAction.strip():
        lines.append(f"- Desired reader action: {_trim_for_prompt(intent.desiredAction, 220)}")
    if intent.mustInclude:
        lines.append("- Must include: " + "; ".join(_trim_for_prompt(x, 120) for x in intent.mustInclude[:8] if x.strip()))
    if intent.mustAvoid:
        lines.append("- Must avoid: " + "; ".join(_trim_for_prompt(x, 120) for x in intent.mustAvoid[:8] if x.strip()))
    if intent.extraNotes and intent.extraNotes.strip():
        lines.append(f"- Extra notes: {_trim_for_prompt(intent.extraNotes, 260)}")

    return "\n".join(lines) if lines else "No explicit intent constraints."


async def derive_style_blueprint(
    style_sample: Optional[str],
    model: str,
    selected_client: AsyncOpenAI,
    generation_config: Optional[GenerationConfig] = None,
) -> str:
    sample = (style_sample or "").strip()
    if not sample:
        return ""

    prompt = (
        "Analyze the writing sample and output strict JSON with keys: "
        "voice, rhythm, vocabulary, rhetorical_patterns, do_rules, dont_rules.\n"
        "Each key should be concise and practical for style transfer."
        f"\n\nSample:\n{_trim_for_prompt(sample, 2200)}"
    )
    try:
        completion = await selected_client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            **_generation_kwargs(model, generation_config, default_temperature=0.2),
            messages=[
                {"role": "system", "content": "You are a writing-style reverse engineer."},
                {"role": "user", "content": prompt},
            ],
        )
        parsed = _parse_llm_json(completion.choices[0].message.content)
        rules = [
            f"- Voice: {parsed.get('voice', 'N/A')}",
            f"- Rhythm: {parsed.get('rhythm', 'N/A')}",
            f"- Vocabulary: {parsed.get('vocabulary', 'N/A')}",
            f"- Rhetorical patterns: {parsed.get('rhetorical_patterns', 'N/A')}",
            f"- Do rules: {parsed.get('do_rules', 'N/A')}",
            f"- Don't rules: {parsed.get('dont_rules', 'N/A')}",
        ]
        return "\n".join(rules)
    except Exception:
        # Fall back to the raw sample when extraction fails.
        return f"- Use this style sample as a hard reference:\n{_trim_for_prompt(sample, 1400)}"


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


def _get_current_user(request: Request, required: bool = False) -> Optional[Dict[str, Any]]:
    token = request.cookies.get(SESSION_COOKIE_NAME, "")
    if not token:
        if required:
            raise HTTPException(status_code=401, detail="Login required")
        return None
    user = store.get_user_by_session(token)
    if not user and required:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return user


def _normalize_frontend_redirect() -> str:
    return FRONTEND_URL.rstrip("/")


async def generate_for_platform(
    platform: Platform,
    draft: str,
    profile: Optional[UserProfile],
    model: str,
    language: Optional[str],
    selected_client: AsyncOpenAI,
    intent_block: str,
    style_blueprint: str,
    style_sample: Optional[str],
    generation_config: Optional[GenerationConfig] = None,
) -> GeneratedCard:
    system_prompt = PLATFORM_PROMPTS[platform]
    style_block = build_style_block(platform, profile)
    style_sample_text = _trim_for_prompt(style_sample or "", 1400)

    user_prompt = (
        "Transform the following draft for the target platform.\n"
        f"Target platform: {platform.value}\n"
        f"Output language: {language or 'Same as input'}\n"
        f"Draft:\n{draft}\n\n"
        f"Intent constraints:\n{intent_block}\n\n"
        f"Style constraints:\n{style_block}\n\n"
        f"Style blueprint:\n{style_blueprint or 'N/A'}\n\n"
        f"Raw style sample:\n{style_sample_text or 'N/A'}\n\n"
        "Priority order:\n"
        "1) Preserve user intent and core message exactly.\n"
        "2) Transfer writing style faithfully (voice, rhythm, rhetorical structure).\n"
        "3) Fit platform-native best practices.\n\n"
        "When intent and style conflict, preserve intent first while keeping the closest possible style.\n"
        "Return strict JSON with shape: "
        '{"title":"...","body":"...","suggestions":["..."]}'
    )

    completion = await selected_client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        **_generation_kwargs(model, generation_config, default_temperature=0.7),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    payload = _parse_llm_json(completion.choices[0].message.content)
    return GeneratedCard(
        platform=platform,
        title=payload.get("title", f"{platform.value.title()} Draft"),
        body=payload.get("body", ""),
        suggestions=payload.get("suggestions", ["Shorten opening line", "Clarify CTA"]),
    )


def _parse_llm_json(raw: str | None) -> dict:
    text = (raw or "").strip()
    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    m = re.search(r"```(?:json)?\s*\n?(.*?)```", text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    return json.loads(text) if text else {}


def _clip(value: str, max_len: int) -> str:
    return value if len(value) <= max_len else value[: max_len - 1] + "…"


def _resolve_access_token(platform: str, user_id: Optional[int] = None) -> Optional[str]:
    if user_id is not None:
        user_token = store.get_user_oauth_token(user_id, platform)
        if user_token and user_token.get("access_token"):
            return str(user_token["access_token"])
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


async def publish_to_platform(platform: str, title: str, body: str, user_id: Optional[int] = None) -> Dict[str, Any]:
    token = _resolve_access_token(platform, user_id=user_id)
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
            user_id = job.get("user_id")
            draft_id = payload.get("draftId")
            for card in selected:
                result = await publish_to_platform(card["platform"], card["title"], card["body"], user_id=user_id)
                results.append(result)
                store.create_publish_log(
                    user_id=user_id,
                    draft_id=draft_id,
                    card_id=card.get("id"),
                    platform=card["platform"],
                    title=card.get("title"),
                    body=card.get("body"),
                    result=result,
                )

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


@app.get("/api/provider")
async def get_provider_info() -> Dict[str, Any]:
    available: List[str] = []
    if openai_client:
        available.append("openai")
    if openrouter_client:
        available.append("openrouter")
    if not available:
        available = ["openai"]

    default_provider = "openrouter" if openrouter_client else "openai"
    default_model = "openai/gpt-4o-mini" if default_provider == "openrouter" else "gpt-4o-mini"
    return {
        "provider": default_provider,
        "defaultModel": default_model,
        "availableProviders": available,
    }


@app.post("/api/generate", response_model=GenerateResponse)
async def generate_content(req: GenerateRequest, request: Request) -> GenerateResponse:
    if not req.draft.strip():
        raise HTTPException(status_code=400, detail="Draft cannot be empty")

    selected_platforms = req.platforms or list(Platform)
    if not selected_platforms:
        raise HTTPException(status_code=400, detail="At least one platform must be selected")

    selected_client = _resolve_text_client(request, req.provider, req.model)
    intent_block = build_intent_block(req.intent)
    style_blueprint = await derive_style_blueprint(req.styleSample, req.model, selected_client, req.generationConfig)
    tasks = [
        generate_for_platform(
            platform,
            req.draft,
            req.userProfile,
            req.model,
            (req.languageByPlatform or {}).get(platform) or req.language,
            selected_client,
            intent_block,
            style_blueprint,
            req.styleSample,
            req.generationConfig,
        )
        for platform in selected_platforms
    ]
    cards = await asyncio.gather(*tasks)

    user = _get_current_user(request, required=False)
    draft_id = store.create_draft(req.draft, user_id=(int(user["id"]) if user else None))
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
async def refine_content(req: RefineRequest, request: Request) -> GeneratedCard:
    selected_client = _resolve_text_client(request, req.provider, req.model)
    system_prompt = PLATFORM_PROMPTS[req.platform]
    style_block = build_style_block(req.platform, req.userProfile)
    intent_block = build_intent_block(req.intent)
    style_blueprint = await derive_style_blueprint(req.styleSample, req.model, selected_client, req.generationConfig)

    user_prompt = (
        "You are refining an already generated post while preserving platform fit.\n"
        f"Platform: {req.platform.value}\n"
        f"Output language: {req.language or 'Same as input'}\n"
        f"Original user draft:\n{req.originalDraft}\n\n"
        f"Current generated content:\n{req.currentContent}\n\n"
        f"User feedback to apply:\n{req.feedback}\n\n"
        f"Intent constraints:\n{intent_block}\n\n"
        f"Style constraints:\n{style_block}\n\n"
        f"Style blueprint:\n{style_blueprint or 'N/A'}\n\n"
        f"Raw style sample:\n{_trim_for_prompt(req.styleSample or '', 1400) or 'N/A'}\n\n"
        "Refine priority order:\n"
        "1) Preserve intent and feedback requirements.\n"
        "2) Keep style highly consistent with the provided sample/blueprint.\n"
        "3) Keep platform-native readability and constraints.\n\n"
        "Return strict JSON with shape: "
        '{"title":"...","body":"...","suggestions":["..."]}'
    )

    completion = await selected_client.chat.completions.create(
        model=req.model,
        response_format={"type": "json_object"},
        **_generation_kwargs(req.model, req.generationConfig, default_temperature=0.7),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    payload = _parse_llm_json(completion.choices[0].message.content)
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
async def extract_style(req: StyleExtractRequest, request: Request) -> StyleExtractResponse:
    if not req.referencePosts:
        raise HTTPException(status_code=400, detail="referencePosts is required")

    prompt = (
        f"Analyze the following high-performing {req.platform.value} posts and extract tone/style instructions.\n"
        "Return JSON with keys: extractedTone, systemInstructions.\n\n"
        + "\n---\n".join(req.referencePosts)
    )

    selected_client = _resolve_text_client(request, req.provider, req.model)
    completion = await selected_client.chat.completions.create(
        model=req.model,
        response_format={"type": "json_object"},
        **_generation_kwargs(req.model, None, default_temperature=0.3),
        messages=[
            {"role": "system", "content": "You are an expert writing-style analyst."},
            {"role": "user", "content": prompt},
        ],
    )

    payload = _parse_llm_json(completion.choices[0].message.content)
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
async def transcribe_voice(request: Request, file: UploadFile = File(...)) -> STTResponse:
    resolved_stt_client = _resolve_stt_client(request)
    if not resolved_stt_client:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY is required for STT")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    audio_bytes = await file.read()
    transcription = await resolved_stt_client.audio.transcriptions.create(
        model=DEFAULT_STT_MODEL,
        file=(file.filename, audio_bytes, file.content_type or "audio/webm"),
    )

    text = getattr(transcription, "text", "").strip()
    if not text:
        raise HTTPException(status_code=500, detail="Failed to transcribe audio")

    return STTResponse(text=text)


@app.post("/api/publish", response_model=PublishResponse)
async def enqueue_publish(req: PublishRequest, request: Request) -> PublishResponse:
    user = _get_current_user(request, required=False)
    scheduled_at = req.scheduledAt.strip() if req.scheduledAt else None
    job_id, status = store.create_job(
        "publish",
        {
            "draftId": req.draftId,
            "cardIds": req.cardIds or [],
            "acceptedOnly": req.acceptedOnly,
        },
        user_id=(int(user["id"]) if user else None),
        run_at=scheduled_at,
    )
    return PublishResponse(jobId=job_id, status=status)


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


@app.post("/api/analytics/events")
async def track_event(req: AnalyticsEventRequest, request: Request) -> Dict[str, Any]:
    event_type = req.eventType.strip().lower().replace(" ", "_")
    if not event_type:
        raise HTTPException(status_code=400, detail="eventType is required")

    user = _get_current_user(request, required=False)
    meta = dict(req.meta or {})
    if user:
        meta["userId"] = int(user["id"])

    event_id = store.create_traffic_event(
        event_type=event_type,
        session_id=(req.sessionId or "").strip() or None,
        platform=req.platform.value if req.platform else None,
        path=(req.path or "").strip() or None,
        user_agent=request.headers.get("user-agent"),
        referrer=(req.referrer or request.headers.get("referer") or "").strip() or None,
        meta=meta,
    )
    return {"ok": True, "eventId": event_id}


@app.get("/api/analytics/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    days: int = Query(14, ge=1, le=90),
    cpm: float = Query(1.8, ge=0),
    ctr: float = Query(0.012, ge=0, le=1),
    cpc: float = Query(0.18, ge=0),
    fillRate: float = Query(0.65, ge=0, le=1),
    slotsPerPage: int = Query(2, ge=1, le=10),
) -> AnalyticsSummaryResponse:
    summary = store.get_traffic_summary(days)
    totals = summary["totals"]
    daily = summary["daily"]

    impressions = int(round(float(totals["pageViews"]) * float(slotsPerPage) * float(fillRate)))
    estimated_clicks = int(round(float(impressions) * float(ctr)))
    cpm_based_revenue = round((impressions / 1000.0) * float(cpm), 4)
    cpc_based_revenue = round(float(estimated_clicks) * float(cpc), 4)
    estimated_revenue = round(max(cpm_based_revenue, cpc_based_revenue), 4)
    avg_daily = round(estimated_revenue / float(days), 4)
    projected_monthly = round(avg_daily * 30.0, 4)

    return AnalyticsSummaryResponse(
        windowDays=days,
        totals=TrafficTotals(**totals),
        daily=[DailyTrafficPoint(**row) for row in daily],
        revenueEstimate=RevenueEstimate(
            impressions=impressions,
            estimatedClicks=estimated_clicks,
            cpmBasedRevenue=cpm_based_revenue,
            cpcBasedRevenue=cpc_based_revenue,
            estimatedRevenue=estimated_revenue,
            avgDailyRevenue=avg_daily,
            projectedMonthlyRevenue=projected_monthly,
            assumptions={
                "cpm": float(cpm),
                "ctr": float(ctr),
                "cpc": float(cpc),
                "fillRate": float(fillRate),
                "slotsPerPage": float(slotsPerPage),
            },
        ),
    )


@app.get("/api/publish/logs", response_model=List[PublishLogItem])
async def get_publish_logs(request: Request, limit: int = Query(100, ge=1, le=500)) -> List[PublishLogItem]:
    user = _get_current_user(request, required=False)
    if not user:
        return []
    rows = store.list_publish_logs(int(user["id"]), limit=limit)
    return [
        PublishLogItem(
            id=row["id"],
            draftId=row.get("draft_id"),
            cardId=row.get("card_id"),
            platform=row["platform"],
            title=row.get("title"),
            body=row.get("body"),
            postId=row.get("post_id"),
            postUrl=row.get("post_url"),
            status=row.get("status", "unknown"),
            errorText=row.get("error_text"),
            createdAt=row.get("created_at", ""),
        )
        for row in rows
    ]


@app.get("/api/threads", response_model=List[PlatformThread])
async def get_threads(request: Request, limitPerPlatform: int = Query(20, ge=1, le=100)) -> List[PlatformThread]:
    user = _get_current_user(request, required=False)
    if not user:
        return []
    grouped = store.list_threads_by_platform(int(user["id"]), limit_per_platform=limitPerPlatform)
    result: List[PlatformThread] = []
    for platform, items in grouped.items():
        result.append(
            PlatformThread(
                platform=platform,
                items=[
                    PublishLogItem(
                        id=row["id"],
                        draftId=row.get("draft_id"),
                        cardId=row.get("card_id"),
                        platform=row["platform"],
                        title=row.get("title"),
                        body=row.get("body"),
                        postId=row.get("post_id"),
                        postUrl=row.get("post_url"),
                        status=row.get("status", "unknown"),
                        errorText=row.get("error_text"),
                        createdAt=row.get("created_at", ""),
                    )
                    for row in items
                ],
            )
        )
    return result


@app.get("/api/auth/me", response_model=Optional[UserInfo])
async def auth_me(request: Request) -> Optional[UserInfo]:
    user = _get_current_user(request, required=False)
    if not user:
        return None
    return UserInfo(
        id=int(user["id"]),
        name=user.get("name"),
        email=user.get("email"),
        avatarUrl=user.get("avatar_url"),
    )


@app.post("/api/auth/logout")
async def auth_logout(request: Request, response: Response) -> Dict[str, bool]:
    token = request.cookies.get(SESSION_COOKIE_NAME, "")
    if token:
        store.delete_user_session(token)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/api/auth/{provider}/connect", response_model=OAuthConnectResponse)
async def social_connect(provider: SocialProvider, redirectUri: str = Query(..., min_length=1)) -> OAuthConnectResponse:
    state = secrets.token_urlsafe(24)
    store.create_social_auth_state(state, provider.value, redirectUri)

    if provider == SocialProvider.google:
        client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        if not client_id:
            raise HTTPException(status_code=400, detail="Missing GOOGLE_CLIENT_ID")
        url = (
            "https://accounts.google.com/o/oauth2/v2/auth?"
            + urlencode(
                {
                    "client_id": client_id,
                    "redirect_uri": redirectUri,
                    "response_type": "code",
                    "scope": "openid email profile",
                    "state": state,
                    "access_type": "offline",
                    "prompt": "consent",
                }
            )
        )
        return OAuthConnectResponse(authUrl=url, state=state)

    if provider == SocialProvider.kakao:
        client_id = os.getenv("KAKAO_CLIENT_ID", "")
        if not client_id:
            raise HTTPException(status_code=400, detail="Missing KAKAO_CLIENT_ID")
        url = (
            "https://kauth.kakao.com/oauth/authorize?"
            + urlencode(
                {
                    "client_id": client_id,
                    "redirect_uri": redirectUri,
                    "response_type": "code",
                    "state": state,
                    "scope": "profile_nickname profile_image account_email",
                }
            )
        )
        return OAuthConnectResponse(authUrl=url, state=state)

    client_id = os.getenv("NAVER_CLIENT_ID", "")
    if not client_id:
        raise HTTPException(status_code=400, detail="Missing NAVER_CLIENT_ID")
    url = (
        "https://nid.naver.com/oauth2.0/authorize?"
        + urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirectUri,
                "response_type": "code",
                "state": state,
            }
        )
    )
    return OAuthConnectResponse(authUrl=url, state=state)


@app.get("/api/auth/{provider}/callback")
async def social_callback(
    provider: SocialProvider,
    code: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
) -> RedirectResponse:
    state_row = store.pop_social_auth_state(state)
    if not state_row:
        raise HTTPException(status_code=400, detail="Invalid or expired social auth state")
    if state_row["provider"] != provider.value:
        raise HTTPException(status_code=400, detail="Social auth state/provider mismatch")

    redirect_uri = state_row["redirect_uri"]
    provider_user_id = ""
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None

    async with httpx.AsyncClient(timeout=20.0) as http:
        if provider == SocialProvider.google:
            client_id = os.getenv("GOOGLE_CLIENT_ID", "")
            client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
            token_resp = await http.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail=f"Google token exchange failed: {token_data}")

            user_resp = await http.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json()
            provider_user_id = str(user_data.get("id") or "")
            name = user_data.get("name")
            email = user_data.get("email")
            avatar_url = user_data.get("picture")

        elif provider == SocialProvider.kakao:
            client_id = os.getenv("KAKAO_CLIENT_ID", "")
            client_secret = os.getenv("KAKAO_CLIENT_SECRET", "")
            token_resp = await http.post(
                "https://kauth.kakao.com/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail=f"Kakao token exchange failed: {token_data}")

            user_resp = await http.get(
                "https://kapi.kakao.com/v2/user/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json()
            provider_user_id = str(user_data.get("id") or "")
            account = user_data.get("kakao_account") or {}
            profile = account.get("profile") or {}
            name = profile.get("nickname")
            email = account.get("email")
            avatar_url = profile.get("profile_image_url")

        else:
            client_id = os.getenv("NAVER_CLIENT_ID", "")
            client_secret = os.getenv("NAVER_CLIENT_SECRET", "")
            token_resp = await http.post(
                "https://nid.naver.com/oauth2.0/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "state": state,
                },
            )
            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail=f"Naver token exchange failed: {token_data}")

            user_resp = await http.get(
                "https://openapi.naver.com/v1/nid/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_resp.json()
            resp = user_data.get("response") or {}
            provider_user_id = str(resp.get("id") or "")
            name = resp.get("name") or resp.get("nickname")
            email = resp.get("email")
            avatar_url = resp.get("profile_image")

    if not provider_user_id:
        raise HTTPException(status_code=400, detail="Failed to resolve provider user id")

    user = store.create_or_get_user_by_identity(
        provider=provider.value,
        provider_user_id=provider_user_id,
        name=name,
        email=email,
        avatar_url=avatar_url,
    )
    session_token = store.create_user_session(int(user["id"]), ttl_days=SESSION_TTL_DAYS)

    res = RedirectResponse(url=f"{_normalize_frontend_redirect()}/?auth=success")
    res.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        samesite=os.getenv("COOKIE_SAMESITE", "lax"),
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        path="/",
    )
    return res


@app.get("/api/oauth/{platform}/connect", response_model=OAuthConnectResponse)
async def oauth_connect(platform: Platform, request: Request, redirectUri: str = Query(..., min_length=1)) -> OAuthConnectResponse:
    _get_current_user(request, required=False)
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
    request: Request,
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
    user = _get_current_user(request, required=False)
    if user:
        store.upsert_user_oauth_token(int(user["id"]), platform.value, access_token, refresh_token, expires_at)
    os.environ[f"{platform.value.upper()}_ACCESS_TOKEN"] = access_token

    return {"status": "connected", "platform": platform.value, "state": state}
