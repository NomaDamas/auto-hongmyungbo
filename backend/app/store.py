import json
import os
import secrets
import threading
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

STORE_PATH = os.getenv("STORE_PATH", "./local_store.json")

_lock = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    text = ts.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _default_state() -> Dict[str, Any]:
    return {
        "users": [],
        "auth_identities": [],
        "user_sessions": [],
        "social_auth_states": [],
        "drafts": [],
        "cards": [],
        "style_profiles": {},
        "oauth_tokens": {},
        "user_oauth_tokens": {},
        "oauth_states": [],
        "jobs": [],
        "publish_logs": [],
        "traffic_events": [],
        "counters": {},
    }


_state: Dict[str, Any] = _default_state()


def _next_id(key: str) -> int:
    current = int(_state["counters"].get(key, 0)) + 1
    _state["counters"][key] = current
    return current


def _save_locked() -> None:
    path = STORE_PATH
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(_state, f, ensure_ascii=False, indent=2)


def init_db() -> None:
    global _state
    with _lock:
        if not os.path.exists(STORE_PATH):
            _state = _default_state()
            _save_locked()
            return
        try:
            with open(STORE_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            base = _default_state()
            for k in base.keys():
                if k in loaded:
                    base[k] = loaded[k]
            _state = base
        except Exception:
            _state = _default_state()
            _save_locked()


def create_or_get_user_by_identity(
    provider: str,
    provider_user_id: str,
    name: Optional[str],
    email: Optional[str],
    avatar_url: Optional[str],
) -> Dict[str, Any]:
    with _lock:
        identity = next(
            (x for x in _state["auth_identities"] if x["provider"] == provider and x["provider_user_id"] == provider_user_id),
            None,
        )
        if identity:
            user = next((u for u in _state["users"] if u["id"] == identity["user_id"]), None)
            if not user:
                raise RuntimeError("auth identity points to missing user")
            user["name"] = name
            user["email"] = email
            user["avatar_url"] = avatar_url
            user["updated_at"] = _utc_now()
            _save_locked()
            return deepcopy(user)

        now = _utc_now()
        user = {
            "id": _next_id("users"),
            "name": name,
            "email": email,
            "avatar_url": avatar_url,
            "created_at": now,
            "updated_at": now,
        }
        _state["users"].append(user)
        _state["auth_identities"].append(
            {
                "id": _next_id("auth_identities"),
                "user_id": user["id"],
                "provider": provider,
                "provider_user_id": provider_user_id,
                "created_at": now,
                "updated_at": now,
            }
        )
        _save_locked()
        return deepcopy(user)


def create_user_session(user_id: int, ttl_days: int = 30) -> str:
    token = secrets.token_urlsafe(48)
    with _lock:
        _state["user_sessions"].append(
            {
                "id": _next_id("user_sessions"),
                "user_id": user_id,
                "session_token": token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat(),
                "created_at": _utc_now(),
            }
        )
        _save_locked()
    return token


def get_user_by_session(token: str) -> Optional[Dict[str, Any]]:
    with _lock:
        sess = next((s for s in _state["user_sessions"] if s["session_token"] == token), None)
        if not sess:
            return None
        expires = _parse_iso(sess.get("expires_at"))
        if expires and expires < datetime.now(timezone.utc):
            _state["user_sessions"] = [s for s in _state["user_sessions"] if s["session_token"] != token]
            _save_locked()
            return None
        user = next((u for u in _state["users"] if u["id"] == sess["user_id"]), None)
        if not user:
            return None
        return {
            "id": user["id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "avatar_url": user.get("avatar_url"),
            "created_at": user.get("created_at"),
            "updated_at": user.get("updated_at"),
        }


def delete_user_session(token: str) -> None:
    with _lock:
        _state["user_sessions"] = [s for s in _state["user_sessions"] if s["session_token"] != token]
        _save_locked()


def create_social_auth_state(state: str, provider: str, redirect_uri: str) -> None:
    with _lock:
        _state["social_auth_states"] = [s for s in _state["social_auth_states"] if s["state"] != state]
        _state["social_auth_states"].append(
            {
                "id": _next_id("social_auth_states"),
                "state": state,
                "provider": provider,
                "redirect_uri": redirect_uri,
                "created_at": _utc_now(),
            }
        )
        _save_locked()


def pop_social_auth_state(state: str) -> Optional[Dict[str, Any]]:
    with _lock:
        for i, row in enumerate(_state["social_auth_states"]):
            if row["state"] == state:
                popped = _state["social_auth_states"].pop(i)
                _save_locked()
                return deepcopy(popped)
    return None


def create_draft(raw_text: str, user_id: Optional[int] = None) -> int:
    with _lock:
        row = {
            "id": _next_id("drafts"),
            "raw_text": raw_text,
            "user_id": user_id,
            "created_at": _utc_now(),
        }
        _state["drafts"].append(row)
        _save_locked()
        return int(row["id"])


def create_card(
    draft_id: int,
    platform: str,
    title: str,
    body: str,
    suggestions: List[str],
    status: str = "draft",
) -> int:
    with _lock:
        now = _utc_now()
        row = {
            "id": _next_id("cards"),
            "draft_id": draft_id,
            "platform": platform,
            "title": title,
            "body": body,
            "suggestions": list(suggestions),
            "status": status,
            "version": 1,
            "created_at": now,
            "updated_at": now,
        }
        _state["cards"].append(row)
        _save_locked()
        return int(row["id"])


def get_card(card_id: int) -> Optional[Dict[str, Any]]:
    with _lock:
        row = next((c for c in _state["cards"] if c["id"] == card_id), None)
        return deepcopy(row) if row else None


def list_cards_for_draft(draft_id: int) -> List[Dict[str, Any]]:
    with _lock:
        rows = [deepcopy(c) for c in _state["cards"] if c["draft_id"] == draft_id]
    rows.sort(key=lambda x: x["id"])
    return rows


def update_card_status(card_id: int, status: str) -> None:
    with _lock:
        for c in _state["cards"]:
            if c["id"] == card_id:
                c["status"] = status
                c["updated_at"] = _utc_now()
                break
        _save_locked()


def update_card_content(card_id: int, title: str, body: str, suggestions: List[str], status: str = "draft") -> None:
    with _lock:
        for c in _state["cards"]:
            if c["id"] == card_id:
                c["title"] = title
                c["body"] = body
                c["suggestions"] = list(suggestions)
                c["status"] = status
                c["version"] = int(c.get("version", 1)) + 1
                c["updated_at"] = _utc_now()
                break
        _save_locked()


def upsert_style_profile(
    platform: str,
    mode: str,
    custom_instructions: Optional[str],
    extracted_tone: Optional[str],
    reference_posts: List[str],
) -> None:
    with _lock:
        _state["style_profiles"][platform] = {
            "platform": platform,
            "mode": mode,
            "custom_instructions": custom_instructions,
            "extracted_tone": extracted_tone,
            "reference_posts": list(reference_posts),
            "updated_at": _utc_now(),
        }
        _save_locked()


def upsert_oauth_token(platform: str, access_token: str, refresh_token: Optional[str], expires_at: Optional[str]) -> None:
    with _lock:
        _state["oauth_tokens"][platform] = {
            "platform": platform,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "updated_at": _utc_now(),
        }
        _save_locked()


def get_oauth_token(platform: str) -> Optional[Dict[str, Any]]:
    with _lock:
        row = _state["oauth_tokens"].get(platform)
        return deepcopy(row) if row else None


def upsert_user_oauth_token(
    user_id: int,
    platform: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_at: Optional[str],
) -> None:
    with _lock:
        key = f"{user_id}:{platform}"
        _state["user_oauth_tokens"][key] = {
            "user_id": user_id,
            "platform": platform,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "updated_at": _utc_now(),
        }
        _save_locked()


def get_user_oauth_token(user_id: int, platform: str) -> Optional[Dict[str, Any]]:
    with _lock:
        row = _state["user_oauth_tokens"].get(f"{user_id}:{platform}")
        return deepcopy(row) if row else None


def create_oauth_state(state: str, platform: str, redirect_uri: str, code_verifier: Optional[str]) -> None:
    with _lock:
        _state["oauth_states"] = [s for s in _state["oauth_states"] if s["state"] != state]
        _state["oauth_states"].append(
            {
                "id": _next_id("oauth_states"),
                "state": state,
                "platform": platform,
                "redirect_uri": redirect_uri,
                "code_verifier": code_verifier,
                "created_at": _utc_now(),
            }
        )
        _save_locked()


def pop_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    with _lock:
        for i, row in enumerate(_state["oauth_states"]):
            if row["state"] == state:
                popped = _state["oauth_states"].pop(i)
                _save_locked()
                return deepcopy(popped)
    return None


def create_job(job_type: str, payload: Dict[str, Any], user_id: Optional[int] = None, run_at: Optional[str] = None) -> tuple[int, str]:
    with _lock:
        now = _utc_now()
        status = "scheduled" if run_at else "queued"
        row = {
            "id": _next_id("jobs"),
            "type": job_type,
            "status": status,
            "payload": deepcopy(payload),
            "result": None,
            "error": None,
            "user_id": user_id,
            "run_at": run_at,
            "created_at": now,
            "updated_at": now,
        }
        _state["jobs"].append(row)
        _save_locked()
        return int(row["id"]), status


def get_next_queued_job() -> Optional[Dict[str, Any]]:
    with _lock:
        now = datetime.now(timezone.utc)

        def eligible(job: Dict[str, Any]) -> bool:
            if job["status"] == "queued":
                return True
            if job["status"] == "scheduled":
                run_at = _parse_iso(job.get("run_at"))
                return bool(run_at and run_at <= now)
            return False

        candidates = [j for j in _state["jobs"] if eligible(j)]
        if not candidates:
            return None

        def sort_key(job: Dict[str, Any]) -> tuple[datetime, int]:
            run_at = _parse_iso(job.get("run_at"))
            created = _parse_iso(job.get("created_at")) or now
            return (run_at or created, int(job["id"]))

        picked = min(candidates, key=sort_key)
        picked["status"] = "running"
        picked["updated_at"] = _utc_now()
        _save_locked()
        return deepcopy(picked)


def finish_job(job_id: int, result: Dict[str, Any]) -> None:
    with _lock:
        for job in _state["jobs"]:
            if job["id"] == job_id:
                job["status"] = "done"
                job["result"] = deepcopy(result)
                job["error"] = None
                job["updated_at"] = _utc_now()
                break
        _save_locked()


def fail_job(job_id: int, error: str) -> None:
    with _lock:
        for job in _state["jobs"]:
            if job["id"] == job_id:
                job["status"] = "failed"
                job["error"] = error
                job["updated_at"] = _utc_now()
                break
        _save_locked()


def get_job(job_id: int) -> Optional[Dict[str, Any]]:
    with _lock:
        row = next((j for j in _state["jobs"] if j["id"] == job_id), None)
        return deepcopy(row) if row else None


def create_publish_log(
    user_id: Optional[int],
    draft_id: Optional[int],
    card_id: Optional[int],
    platform: str,
    title: Optional[str],
    body: Optional[str],
    result: Dict[str, Any],
) -> int:
    with _lock:
        row = {
            "id": _next_id("publish_logs"),
            "user_id": user_id,
            "draft_id": draft_id,
            "card_id": card_id,
            "platform": platform,
            "title": title,
            "body": body,
            "post_id": result.get("postId"),
            "post_url": result.get("url"),
            "status": "success" if result.get("ok") else "failed",
            "error_text": str(result.get("error") or result.get("message") or "") if not result.get("ok") else None,
            "created_at": _utc_now(),
        }
        _state["publish_logs"].append(row)
        _save_locked()
        return int(row["id"])


def list_publish_logs(user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    with _lock:
        rows = [deepcopy(x) for x in _state["publish_logs"] if x.get("user_id") == user_id]
    rows.sort(key=lambda x: int(x["id"]), reverse=True)
    return rows[: int(limit)]


def list_threads_by_platform(user_id: int, limit_per_platform: int = 20) -> Dict[str, List[Dict[str, Any]]]:
    with _lock:
        rows = [deepcopy(x) for x in _state["publish_logs"] if x.get("user_id") == user_id]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        platform = row.get("platform", "unknown")
        grouped.setdefault(platform, [])
        if len(grouped[platform]) < int(limit_per_platform):
            grouped[platform].append(row)
    return grouped


def create_traffic_event(
    event_type: str,
    session_id: Optional[str] = None,
    platform: Optional[str] = None,
    path: Optional[str] = None,
    user_agent: Optional[str] = None,
    referrer: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> int:
    with _lock:
        row = {
            "id": _next_id("traffic_events"),
            "session_id": session_id,
            "event_type": event_type,
            "platform": platform,
            "path": path,
            "user_agent": user_agent,
            "referrer": referrer,
            "meta": deepcopy(meta or {}),
            "created_at": _utc_now(),
        }
        _state["traffic_events"].append(row)
        _save_locked()
        return int(row["id"])


def get_traffic_summary(days: int) -> Dict[str, Any]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))

    totals = {
        "totalEvents": 0,
        "pageViews": 0,
        "generateCount": 0,
        "refineCount": 0,
        "acceptCount": 0,
        "rejectCount": 0,
        "publishCount": 0,
    }
    daily_map: Dict[str, Dict[str, Any]] = {}

    with _lock:
        events = deepcopy(_state["traffic_events"])

    for e in events:
        created = _parse_iso(e.get("created_at"))
        if not created or created < cutoff:
            continue
        day = created.date().isoformat()
        if day not in daily_map:
            daily_map[day] = {
                "day": day,
                "totalEvents": 0,
                "pageViews": 0,
                "generateCount": 0,
                "refineCount": 0,
                "acceptCount": 0,
                "rejectCount": 0,
                "publishCount": 0,
            }
        item = daily_map[day]
        item["totalEvents"] += 1
        event_type = str(e.get("event_type") or "")
        if event_type == "page_view":
            item["pageViews"] += 1
        elif event_type == "generate":
            item["generateCount"] += 1
        elif event_type == "refine":
            item["refineCount"] += 1
        elif event_type == "accept":
            item["acceptCount"] += 1
        elif event_type == "reject":
            item["rejectCount"] += 1
        elif event_type == "publish":
            item["publishCount"] += 1

    daily = [daily_map[k] for k in sorted(daily_map.keys())]
    for item in daily:
        totals["totalEvents"] += item["totalEvents"]
        totals["pageViews"] += item["pageViews"]
        totals["generateCount"] += item["generateCount"]
        totals["refineCount"] += item["refineCount"]
        totals["acceptCount"] += item["acceptCount"]
        totals["rejectCount"] += item["rejectCount"]
        totals["publishCount"] += item["publishCount"]

    return {"daily": daily, "totals": totals}
