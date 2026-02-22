import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import psycopg
from psycopg.rows import dict_row

_lock = threading.Lock()


def _require_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required. Use your Supabase Postgres connection string.")
    return database_url


def _connect() -> psycopg.Connection:
    return psycopg.connect(_require_database_url(), row_factory=dict_row)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return value


def _normalize_row(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return {k: _normalize_value(v) for k, v in row.items()}


def _as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
        except json.JSONDecodeError:
            return [value]
    return []


def init_db() -> None:
    schema_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_identities (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(provider, provider_user_id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS social_auth_states (
        id BIGSERIAL PRIMARY KEY,
        state TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS drafts (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        raw_text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cards (
        id BIGSERIAL PRIMARY KEY,
        draft_id BIGINT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        suggestions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        status TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS style_profiles (
        id BIGSERIAL PRIMARY KEY,
        platform TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL,
        custom_instructions TEXT,
        extracted_tone TEXT,
        reference_posts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
        id BIGSERIAL PRIMARY KEY,
        platform TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_oauth_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, platform)
    );

    CREATE TABLE IF NOT EXISTS oauth_states (
        id BIGSERIAL PRIMARY KEY,
        state TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        code_verifier TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS jobs (
        id BIGSERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json JSONB NOT NULL,
        result_json JSONB,
        error TEXT,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS publish_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        draft_id BIGINT REFERENCES drafts(id) ON DELETE SET NULL,
        card_id BIGINT REFERENCES cards(id) ON DELETE SET NULL,
        platform TEXT NOT NULL,
        title TEXT,
        body TEXT,
        post_id TEXT,
        post_url TEXT,
        status TEXT NOT NULL,
        error_text TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS traffic_events (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT,
        event_type TEXT NOT NULL,
        platform TEXT,
        path TEXT,
        user_agent TEXT,
        referrer TEXT,
        meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_traffic_events_created_at
        ON traffic_events(created_at);

    CREATE INDEX IF NOT EXISTS idx_traffic_events_type_created_at
        ON traffic_events(event_type, created_at);

    CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at
        ON jobs(status, run_at, created_at);
    """

    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(schema_sql)


def create_or_get_user_by_identity(
    provider: str,
    provider_user_id: str,
    name: Optional[str],
    email: Optional[str],
    avatar_url: Optional[str],
) -> Dict[str, Any]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT u.*
                    FROM users u
                    JOIN auth_identities a ON a.user_id = u.id
                    WHERE a.provider = %s AND a.provider_user_id = %s
                    """,
                    (provider, provider_user_id),
                )
                row = cur.fetchone()

                if row:
                    cur.execute(
                        """
                        UPDATE users
                        SET name = %s, email = %s, avatar_url = %s, updated_at = %s
                        WHERE id = %s
                        RETURNING *
                        """,
                        (name, email, avatar_url, _utc_now(), row["id"]),
                    )
                    return _normalize_row(cur.fetchone()) or {}

                now = _utc_now()
                cur.execute(
                    """
                    INSERT INTO users(name, email, avatar_url, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (name, email, avatar_url, now, now),
                )
                created_user = cur.fetchone()
                if not created_user:
                    return {}

                cur.execute(
                    """
                    INSERT INTO auth_identities(user_id, provider, provider_user_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (created_user["id"], provider, provider_user_id, now, now),
                )
                return _normalize_row(created_user) or {}


def create_user_session(user_id: int, ttl_days: int = 30) -> str:
    import secrets

    token = secrets.token_urlsafe(48)
    expires_at = _utc_now() + timedelta(days=ttl_days)

    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_sessions(user_id, session_token, expires_at, created_at)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user_id, token, expires_at, _utc_now()),
                )
    return token


def get_user_by_session(token: str) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT u.*, s.expires_at AS session_expires_at
                    FROM user_sessions s
                    JOIN users u ON u.id = s.user_id
                    WHERE s.session_token = %s
                    """,
                    (token,),
                )
                row = cur.fetchone()
                if not row:
                    return None

                expires_at = row.get("session_expires_at")
                if isinstance(expires_at, datetime) and expires_at < _utc_now():
                    cur.execute("DELETE FROM user_sessions WHERE session_token = %s", (token,))
                    return None

                return _normalize_row(
                    {
                        "id": row["id"],
                        "name": row.get("name"),
                        "email": row.get("email"),
                        "avatar_url": row.get("avatar_url"),
                        "created_at": row.get("created_at"),
                        "updated_at": row.get("updated_at"),
                    }
                )


def delete_user_session(token: str) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM user_sessions WHERE session_token = %s", (token,))


def create_social_auth_state(state: str, provider: str, redirect_uri: str) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO social_auth_states(state, provider, redirect_uri, created_at)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (state, provider, redirect_uri, _utc_now()),
                )


def pop_social_auth_state(state: str) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM social_auth_states WHERE state = %s", (state,))
                row = cur.fetchone()
                if not row:
                    return None
                cur.execute("DELETE FROM social_auth_states WHERE state = %s", (state,))
                return _normalize_row(row)


def create_draft(raw_text: str, user_id: Optional[int] = None) -> int:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO drafts(raw_text, user_id, created_at)
                    VALUES (%s, %s, %s)
                    RETURNING id
                    """,
                    (raw_text, user_id, _utc_now()),
                )
                row = cur.fetchone()
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
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO cards(draft_id, platform, title, body, suggestions_json, status, version, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, 1, %s, %s)
                    RETURNING id
                    """,
                    (
                        draft_id,
                        platform,
                        title,
                        body,
                        json.dumps(suggestions),
                        status,
                        _utc_now(),
                        _utc_now(),
                    ),
                )
                row = cur.fetchone()
                return int(row["id"])


def get_card(card_id: int) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM cards WHERE id = %s", (card_id,))
                row = cur.fetchone()
                if not row:
                    return None

    data = _normalize_row(row) or {}
    data["suggestions"] = _as_list(data.pop("suggestions_json", []))
    return data


def list_cards_for_draft(draft_id: int) -> List[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM cards WHERE draft_id = %s ORDER BY id ASC", (draft_id,))
                rows = cur.fetchall()

    cards: List[Dict[str, Any]] = []
    for row in rows:
        data = _normalize_row(row) or {}
        data["suggestions"] = _as_list(data.pop("suggestions_json", []))
        cards.append(data)
    return cards


def update_card_status(card_id: int, status: str) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE cards SET status = %s, updated_at = %s WHERE id = %s",
                    (status, _utc_now(), card_id),
                )


def update_card_content(card_id: int, title: str, body: str, suggestions: List[str], status: str = "draft") -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE cards
                    SET title = %s,
                        body = %s,
                        suggestions_json = %s::jsonb,
                        status = %s,
                        version = version + 1,
                        updated_at = %s
                    WHERE id = %s
                    """,
                    (title, body, json.dumps(suggestions), status, _utc_now(), card_id),
                )


def upsert_style_profile(
    platform: str,
    mode: str,
    custom_instructions: Optional[str],
    extracted_tone: Optional[str],
    reference_posts: List[str],
) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO style_profiles(platform, mode, custom_instructions, extracted_tone, reference_posts_json, updated_at)
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT(platform)
                    DO UPDATE SET
                        mode = EXCLUDED.mode,
                        custom_instructions = EXCLUDED.custom_instructions,
                        extracted_tone = EXCLUDED.extracted_tone,
                        reference_posts_json = EXCLUDED.reference_posts_json,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (platform, mode, custom_instructions, extracted_tone, json.dumps(reference_posts), _utc_now()),
                )


def upsert_oauth_token(platform: str, access_token: str, refresh_token: Optional[str], expires_at: Optional[str]) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO oauth_tokens(platform, access_token, refresh_token, expires_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT(platform)
                    DO UPDATE SET
                        access_token = EXCLUDED.access_token,
                        refresh_token = EXCLUDED.refresh_token,
                        expires_at = EXCLUDED.expires_at,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (platform, access_token, refresh_token, expires_at, _utc_now()),
                )


def get_oauth_token(platform: str) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM oauth_tokens WHERE platform = %s", (platform,))
                return _normalize_row(cur.fetchone())


def upsert_user_oauth_token(
    user_id: int,
    platform: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_at: Optional[str],
) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_oauth_tokens(user_id, platform, access_token, refresh_token, expires_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT(user_id, platform)
                    DO UPDATE SET
                        access_token = EXCLUDED.access_token,
                        refresh_token = EXCLUDED.refresh_token,
                        expires_at = EXCLUDED.expires_at,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (user_id, platform, access_token, refresh_token, expires_at, _utc_now()),
                )


def get_user_oauth_token(user_id: int, platform: str) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM user_oauth_tokens WHERE user_id = %s AND platform = %s", (user_id, platform))
                return _normalize_row(cur.fetchone())


def create_oauth_state(state: str, platform: str, redirect_uri: str, code_verifier: Optional[str]) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO oauth_states(state, platform, redirect_uri, code_verifier, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (state, platform, redirect_uri, code_verifier, _utc_now()),
                )


def pop_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM oauth_states WHERE state = %s", (state,))
                row = cur.fetchone()
                if not row:
                    return None
                cur.execute("DELETE FROM oauth_states WHERE state = %s", (state,))
                return _normalize_row(row)


def create_job(job_type: str, payload: Dict[str, Any], user_id: Optional[int] = None, run_at: Optional[str] = None) -> tuple[int, str]:
    status = "scheduled" if run_at else "queued"
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO jobs(type, status, payload_json, user_id, run_at, created_at, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (job_type, status, json.dumps(payload), user_id, run_at, _utc_now(), _utc_now()),
                )
                row = cur.fetchone()
                return int(row["id"]), status


def get_next_queued_job() -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    WITH picked AS (
                        SELECT id
                        FROM jobs
                        WHERE status = 'queued'
                           OR (status = 'scheduled' AND run_at IS NOT NULL AND run_at <= NOW())
                        ORDER BY COALESCE(run_at, created_at) ASC, id ASC
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    UPDATE jobs j
                    SET status = 'running', updated_at = %s
                    FROM picked
                    WHERE j.id = picked.id
                    RETURNING j.*
                    """,
                    (_utc_now(),),
                )
                row = cur.fetchone()
                if not row:
                    return None

    job = _normalize_row(row) or {}
    payload = job.pop("payload_json", {})
    result = job.pop("result_json", None)
    if isinstance(payload, str):
        payload = json.loads(payload or "{}")
    if isinstance(result, str):
        result = json.loads(result or "{}")
    job["payload"] = payload if isinstance(payload, dict) else {}
    job["result"] = result if isinstance(result, dict) else None
    return job


def finish_job(job_id: int, result: Dict[str, Any]) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE jobs
                    SET status = 'done', result_json = %s::jsonb, error = NULL, updated_at = %s
                    WHERE id = %s
                    """,
                    (json.dumps(result), _utc_now(), job_id),
                )


def fail_job(job_id: int, error: str) -> None:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE jobs SET status = 'failed', error = %s, updated_at = %s WHERE id = %s",
                    (error, _utc_now(), job_id),
                )


def get_job(job_id: int) -> Optional[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
                row = cur.fetchone()
                if not row:
                    return None

    data = _normalize_row(row) or {}
    payload = data.pop("payload_json", {})
    result = data.pop("result_json", None)
    if isinstance(payload, str):
        payload = json.loads(payload or "{}")
    if isinstance(result, str):
        result = json.loads(result or "{}")
    data["payload"] = payload if isinstance(payload, dict) else {}
    data["result"] = result if isinstance(result, dict) else None
    return data


def create_publish_log(
    user_id: Optional[int],
    draft_id: Optional[int],
    card_id: Optional[int],
    platform: str,
    title: Optional[str],
    body: Optional[str],
    result: Dict[str, Any],
) -> int:
    error_text = None
    if not result.get("ok"):
        err = result.get("error") or result.get("message") or ""
        error_text = json.dumps(err) if not isinstance(err, str) else err

    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO publish_logs(
                      user_id, draft_id, card_id, platform, title, body, post_id, post_url, status, error_text, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        user_id,
                        draft_id,
                        card_id,
                        platform,
                        title,
                        body,
                        result.get("postId"),
                        result.get("url"),
                        "success" if result.get("ok") else "failed",
                        error_text,
                        _utc_now(),
                    ),
                )
                row = cur.fetchone()
                return int(row["id"])


def list_publish_logs(user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_id, draft_id, card_id, platform, title, body, post_id, post_url, status, error_text, created_at
                    FROM publish_logs
                    WHERE user_id = %s
                    ORDER BY id DESC
                    LIMIT %s
                    """,
                    (user_id, int(limit)),
                )
                rows = cur.fetchall()
    return [_normalize_row(row) or {} for row in rows]


def list_threads_by_platform(user_id: int, limit_per_platform: int = 20) -> Dict[str, List[Dict[str, Any]]]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT platform, id, draft_id, card_id, title, body, post_id, post_url, status, error_text, created_at
                    FROM publish_logs
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    """,
                    (user_id,),
                )
                rows = cur.fetchall()

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        d = _normalize_row(row) or {}
        p = str(d.get("platform"))
        grouped.setdefault(p, [])
        if len(grouped[p]) < limit_per_platform:
            grouped[p].append(d)
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
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO traffic_events(
                        session_id, event_type, platform, path, user_agent, referrer, meta_json, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                    RETURNING id
                    """,
                    (
                        session_id,
                        event_type,
                        platform,
                        path,
                        user_agent,
                        referrer,
                        json.dumps(meta or {}),
                        _utc_now(),
                    ),
                )
                row = cur.fetchone()
                return int(row["id"])


def get_traffic_summary(days: int) -> Dict[str, Any]:
    with _lock:
        with _connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                        COUNT(*) AS total_events,
                        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
                        SUM(CASE WHEN event_type = 'generate' THEN 1 ELSE 0 END) AS generate_count,
                        SUM(CASE WHEN event_type = 'refine' THEN 1 ELSE 0 END) AS refine_count,
                        SUM(CASE WHEN event_type = 'accept' THEN 1 ELSE 0 END) AS accept_count,
                        SUM(CASE WHEN event_type = 'reject' THEN 1 ELSE 0 END) AS reject_count,
                        SUM(CASE WHEN event_type = 'publish' THEN 1 ELSE 0 END) AS publish_count
                    FROM traffic_events
                    WHERE created_at >= NOW() - (%s::text || ' days')::interval
                    GROUP BY day
                    ORDER BY day ASC
                    """,
                    (int(days),),
                )
                rows = cur.fetchall()

    daily = []
    totals = {
        "totalEvents": 0,
        "pageViews": 0,
        "generateCount": 0,
        "refineCount": 0,
        "acceptCount": 0,
        "rejectCount": 0,
        "publishCount": 0,
    }

    for row in rows:
        item = {
            "day": row["day"],
            "totalEvents": int(row.get("total_events") or 0),
            "pageViews": int(row.get("page_views") or 0),
            "generateCount": int(row.get("generate_count") or 0),
            "refineCount": int(row.get("refine_count") or 0),
            "acceptCount": int(row.get("accept_count") or 0),
            "rejectCount": int(row.get("reject_count") or 0),
            "publishCount": int(row.get("publish_count") or 0),
        }
        daily.append(item)
        totals["totalEvents"] += item["totalEvents"]
        totals["pageViews"] += item["pageViews"]
        totals["generateCount"] += item["generateCount"]
        totals["refineCount"] += item["refineCount"]
        totals["acceptCount"] += item["acceptCount"]
        totals["rejectCount"] += item["rejectCount"]
        totals["publishCount"] += item["publishCount"]

    return {"daily": daily, "totals": totals}
