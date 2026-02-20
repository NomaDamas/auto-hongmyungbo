import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

DB_PATH = os.getenv("DB_PATH", "./app.db")

_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.row_factory = sqlite3.Row
_lock = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_column(table: str, column: str, definition: str) -> None:
    cur = _conn.cursor()
    cols = {row["name"] for row in cur.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db() -> None:
    with _lock:
        cur = _conn.cursor()
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT,
                avatar_url TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS auth_identities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                provider TEXT NOT NULL,
                provider_user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(provider, provider_user_id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS social_auth_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL UNIQUE,
                provider TEXT NOT NULL,
                redirect_uri TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raw_text TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                draft_id INTEGER NOT NULL,
                platform TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                suggestions_json TEXT NOT NULL,
                status TEXT NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(draft_id) REFERENCES drafts(id)
            );

            CREATE TABLE IF NOT EXISTS style_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL UNIQUE,
                mode TEXT NOT NULL,
                custom_instructions TEXT,
                extracted_tone TEXT,
                reference_posts_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS oauth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                platform TEXT NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at TEXT,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_oauth_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                platform TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at TEXT,
                updated_at TEXT NOT NULL,
                UNIQUE(user_id, platform),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS oauth_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT NOT NULL UNIQUE,
                platform TEXT NOT NULL,
                redirect_uri TEXT NOT NULL,
                code_verifier TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                result_json TEXT,
                error TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS publish_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                draft_id INTEGER,
                card_id INTEGER,
                platform TEXT NOT NULL,
                title TEXT,
                body TEXT,
                post_id TEXT,
                post_url TEXT,
                status TEXT NOT NULL,
                error_text TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(draft_id) REFERENCES drafts(id),
                FOREIGN KEY(card_id) REFERENCES cards(id)
            );

            CREATE TABLE IF NOT EXISTS traffic_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                event_type TEXT NOT NULL,
                platform TEXT,
                path TEXT,
                user_agent TEXT,
                referrer TEXT,
                meta_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_traffic_events_created_at
            ON traffic_events(created_at);

            CREATE INDEX IF NOT EXISTS idx_traffic_events_type_created_at
            ON traffic_events(event_type, created_at);
            """
        )

        _ensure_column("drafts", "user_id", "INTEGER")
        _ensure_column("jobs", "user_id", "INTEGER")
        _ensure_column("jobs", "run_at", "TEXT")

        _conn.commit()


def create_or_get_user_by_identity(
    provider: str,
    provider_user_id: str,
    name: Optional[str],
    email: Optional[str],
    avatar_url: Optional[str],
) -> Dict[str, Any]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute(
            "SELECT u.* FROM users u JOIN auth_identities a ON a.user_id = u.id WHERE a.provider = ? AND a.provider_user_id = ?",
            (provider, provider_user_id),
        ).fetchone()
        if row:
            cur.execute(
                "UPDATE users SET name = ?, email = ?, avatar_url = ?, updated_at = ? WHERE id = ?",
                (name, email, avatar_url, _utc_now(), row["id"]),
            )
            _conn.commit()
            return dict(cur.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone())

        now = _utc_now()
        cur.execute(
            "INSERT INTO users(name, email, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (name, email, avatar_url, now, now),
        )
        user_id = int(cur.lastrowid)
        cur.execute(
            "INSERT INTO auth_identities(user_id, provider, provider_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, provider, provider_user_id, now, now),
        )
        _conn.commit()
        return dict(cur.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


def create_user_session(user_id: int, ttl_days: int = 30) -> str:
    import secrets

    token = secrets.token_urlsafe(48)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            "INSERT INTO user_sessions(user_id, session_token, expires_at, created_at) VALUES (?, ?, ?, ?)",
            (user_id, token, expires_at, _utc_now()),
        )
        _conn.commit()
    return token


def get_user_by_session(token: str) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute(
            """
            SELECT u.*, s.expires_at AS session_expires_at
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.session_token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            return None

        expires_at = row["session_expires_at"]
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
            cur.execute("DELETE FROM user_sessions WHERE session_token = ?", (token,))
            _conn.commit()
            return None

        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "avatar_url": row["avatar_url"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }


def delete_user_session(token: str) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute("DELETE FROM user_sessions WHERE session_token = ?", (token,))
        _conn.commit()


def create_social_auth_state(state: str, provider: str, redirect_uri: str) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            "INSERT INTO social_auth_states(state, provider, redirect_uri, created_at) VALUES (?, ?, ?, ?)",
            (state, provider, redirect_uri, _utc_now()),
        )
        _conn.commit()


def pop_social_auth_state(state: str) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute("SELECT * FROM social_auth_states WHERE state = ?", (state,)).fetchone()
        if not row:
            return None
        cur.execute("DELETE FROM social_auth_states WHERE state = ?", (state,))
        _conn.commit()
    return dict(row)


def create_draft(raw_text: str, user_id: Optional[int] = None) -> int:
    with _lock:
        now = _utc_now()
        cur = _conn.cursor()
        cur.execute(
            "INSERT INTO drafts(raw_text, user_id, created_at) VALUES (?, ?, ?)",
            (raw_text, user_id, now),
        )
        _conn.commit()
        return int(cur.lastrowid)


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
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO cards(draft_id, platform, title, body, suggestions_json, status, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (draft_id, platform, title, body, json.dumps(suggestions), status, now, now),
        )
        _conn.commit()
        return int(cur.lastrowid)


def get_card(card_id: int) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute("SELECT * FROM cards WHERE id = ?", (card_id,)).fetchone()
        if not row:
            return None
        data = dict(row)
        data["suggestions"] = json.loads(data.pop("suggestions_json", "[]"))
        return data


def list_cards_for_draft(draft_id: int) -> List[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        rows = cur.execute(
            "SELECT * FROM cards WHERE draft_id = ? ORDER BY id ASC",
            (draft_id,),
        ).fetchall()

    cards: List[Dict[str, Any]] = []
    for row in rows:
        data = dict(row)
        data["suggestions"] = json.loads(data.pop("suggestions_json", "[]"))
        cards.append(data)
    return cards


def update_card_status(card_id: int, status: str) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            "UPDATE cards SET status = ?, updated_at = ? WHERE id = ?",
            (status, _utc_now(), card_id),
        )
        _conn.commit()


def update_card_content(card_id: int, title: str, body: str, suggestions: List[str], status: str = "draft") -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            """
            UPDATE cards
            SET title = ?, body = ?, suggestions_json = ?, status = ?, version = version + 1, updated_at = ?
            WHERE id = ?
            """,
            (title, body, json.dumps(suggestions), status, _utc_now(), card_id),
        )
        _conn.commit()


def upsert_style_profile(
    platform: str,
    mode: str,
    custom_instructions: Optional[str],
    extracted_tone: Optional[str],
    reference_posts: List[str],
) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO style_profiles(platform, mode, custom_instructions, extracted_tone, reference_posts_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform)
            DO UPDATE SET
                mode = excluded.mode,
                custom_instructions = excluded.custom_instructions,
                extracted_tone = excluded.extracted_tone,
                reference_posts_json = excluded.reference_posts_json,
                updated_at = excluded.updated_at
            """,
            (
                platform,
                mode,
                custom_instructions,
                extracted_tone,
                json.dumps(reference_posts),
                _utc_now(),
            ),
        )
        _conn.commit()


def upsert_oauth_token(platform: str, access_token: str, refresh_token: Optional[str], expires_at: Optional[str]) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO oauth_tokens(platform, access_token, refresh_token, expires_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(platform)
            DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """,
            (platform, access_token, refresh_token, expires_at, _utc_now()),
        )
        _conn.commit()


def get_oauth_token(platform: str) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute("SELECT * FROM oauth_tokens WHERE platform = ?", (platform,)).fetchone()
        if not row:
            return None
    return dict(row)


def upsert_user_oauth_token(
    user_id: int,
    platform: str,
    access_token: str,
    refresh_token: Optional[str],
    expires_at: Optional[str],
) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO user_oauth_tokens(user_id, platform, access_token, refresh_token, expires_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, platform)
            DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at
            """,
            (user_id, platform, access_token, refresh_token, expires_at, _utc_now()),
        )
        _conn.commit()


def get_user_oauth_token(user_id: int, platform: str) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute(
            "SELECT * FROM user_oauth_tokens WHERE user_id = ? AND platform = ?",
            (user_id, platform),
        ).fetchone()
        if not row:
            return None
    return dict(row)


def create_oauth_state(state: str, platform: str, redirect_uri: str, code_verifier: Optional[str]) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO oauth_states(state, platform, redirect_uri, code_verifier, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (state, platform, redirect_uri, code_verifier, _utc_now()),
        )
        _conn.commit()


def pop_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute("SELECT * FROM oauth_states WHERE state = ?", (state,)).fetchone()
        if not row:
            return None
        cur.execute("DELETE FROM oauth_states WHERE state = ?", (state,))
        _conn.commit()
    return dict(row)


def create_job(job_type: str, payload: Dict[str, Any], user_id: Optional[int] = None, run_at: Optional[str] = None) -> tuple[int, str]:
    with _lock:
        now = _utc_now()
        status = "scheduled" if run_at else "queued"
        cur = _conn.cursor()
        cur.execute(
            "INSERT INTO jobs(type, status, payload_json, user_id, run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (job_type, status, json.dumps(payload), user_id, run_at, now, now),
        )
        _conn.commit()
        return int(cur.lastrowid), status


def get_next_queued_job() -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute(
            """
            SELECT * FROM jobs
            WHERE status = 'queued'
               OR (status = 'scheduled' AND run_at IS NOT NULL AND datetime(run_at) <= datetime('now'))
            ORDER BY COALESCE(run_at, created_at) ASC, id ASC
            LIMIT 1
            """
        ).fetchone()
        if not row:
            return None
        job = dict(row)
        cur.execute(
            "UPDATE jobs SET status = 'running', updated_at = ? WHERE id = ?",
            (_utc_now(), job["id"]),
        )
        _conn.commit()

    job["payload"] = json.loads(job.pop("payload_json", "{}"))
    if job.get("result_json"):
        job["result"] = json.loads(job["result_json"])
    return job


def finish_job(job_id: int, result: Dict[str, Any]) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            "UPDATE jobs SET status = 'done', result_json = ?, error = NULL, updated_at = ? WHERE id = ?",
            (json.dumps(result), _utc_now(), job_id),
        )
        _conn.commit()


def fail_job(job_id: int, error: str) -> None:
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            "UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
            (error, _utc_now(), job_id),
        )
        _conn.commit()


def get_job(job_id: int) -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if not row:
            return None

    data = dict(row)
    data["payload"] = json.loads(data.pop("payload_json", "{}"))
    result_json = data.pop("result_json", None)
    data["result"] = json.loads(result_json) if result_json else None
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
    with _lock:
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO publish_logs(
              user_id, draft_id, card_id, platform, title, body, post_id, post_url, status, error_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                json.dumps(result.get("error") or result.get("message") or "") if not result.get("ok") else None,
                _utc_now(),
            ),
        )
        _conn.commit()
        return int(cur.lastrowid)


def list_publish_logs(user_id: int, limit: int = 100) -> List[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        rows = cur.execute(
            """
            SELECT id, user_id, draft_id, card_id, platform, title, body, post_id, post_url, status, error_text, created_at
            FROM publish_logs
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, int(limit)),
        ).fetchall()
    return [dict(row) for row in rows]


def list_threads_by_platform(user_id: int, limit_per_platform: int = 20) -> Dict[str, List[Dict[str, Any]]]:
    with _lock:
        cur = _conn.cursor()
        rows = cur.execute(
            """
            SELECT platform, id, draft_id, card_id, title, body, post_id, post_url, status, created_at
            FROM publish_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        d = dict(row)
        p = d["platform"]
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
        cur = _conn.cursor()
        cur.execute(
            """
            INSERT INTO traffic_events(
                session_id, event_type, platform, path, user_agent, referrer, meta_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
        _conn.commit()
        return int(cur.lastrowid)


def get_traffic_summary(days: int) -> Dict[str, Any]:
    with _lock:
        cur = _conn.cursor()
        rows = cur.execute(
            """
            SELECT
                substr(created_at, 1, 10) AS day,
                COUNT(*) AS total_events,
                SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
                SUM(CASE WHEN event_type = 'generate' THEN 1 ELSE 0 END) AS generate_count,
                SUM(CASE WHEN event_type = 'refine' THEN 1 ELSE 0 END) AS refine_count,
                SUM(CASE WHEN event_type = 'accept' THEN 1 ELSE 0 END) AS accept_count,
                SUM(CASE WHEN event_type = 'reject' THEN 1 ELSE 0 END) AS reject_count,
                SUM(CASE WHEN event_type = 'publish' THEN 1 ELSE 0 END) AS publish_count
            FROM traffic_events
            WHERE datetime(created_at) >= datetime('now', ?)
            GROUP BY substr(created_at, 1, 10)
            ORDER BY day ASC
            """,
            (f"-{int(days)} days",),
        ).fetchall()

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
            "totalEvents": int(row["total_events"] or 0),
            "pageViews": int(row["page_views"] or 0),
            "generateCount": int(row["generate_count"] or 0),
            "refineCount": int(row["refine_count"] or 0),
            "acceptCount": int(row["accept_count"] or 0),
            "rejectCount": int(row["reject_count"] or 0),
            "publishCount": int(row["publish_count"] or 0),
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
