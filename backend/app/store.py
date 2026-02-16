import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DB_PATH = os.getenv("DB_PATH", "./app.db")

_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.row_factory = sqlite3.Row
_lock = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with _lock:
        cur = _conn.cursor()
        cur.executescript(
            """
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
        _conn.commit()


def create_draft(raw_text: str) -> int:
    with _lock:
        now = _utc_now()
        cur = _conn.cursor()
        cur.execute(
            "INSERT INTO drafts(raw_text, created_at) VALUES (?, ?)",
            (raw_text, now),
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


def create_job(job_type: str, payload: Dict[str, Any]) -> int:
    with _lock:
        now = _utc_now()
        cur = _conn.cursor()
        cur.execute(
            "INSERT INTO jobs(type, status, payload_json, created_at, updated_at) VALUES (?, 'queued', ?, ?, ?)",
            (job_type, json.dumps(payload), now, now),
        )
        _conn.commit()
        return int(cur.lastrowid)


def get_next_queued_job() -> Optional[Dict[str, Any]]:
    with _lock:
        cur = _conn.cursor()
        row = cur.execute(
            "SELECT * FROM jobs WHERE status = 'queued' ORDER BY id ASC LIMIT 1"
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
