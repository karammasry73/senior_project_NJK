import sqlite3
from contextlib import contextmanager

from app.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_date TEXT NOT NULL DEFAULT (datetime('now')),
    processed INTEGER NOT NULL DEFAULT 0,
    raw_text TEXT,
    structured_json TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    doc_type TEXT NOT NULL DEFAULT 'document',  -- 'document' (Documents page) or 'invoice' (backing row for Invoices page) - keeps the two histories separate
    confidence REAL
);

CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    invoice_number TEXT,
    vendor TEXT,
    date TEXT,
    total REAL,
    currency TEXT,
    items_json TEXT,
    confidence_score REAL,
    needs_review INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gmail_message_id TEXT UNIQUE,
    thread_id TEXT,
    subject TEXT,
    sender TEXT,
    recipient TEXT,
    body TEXT,
    received_date TEXT,
    category TEXT,
    summary TEXT,
    drafted_reply TEXT,
    sent INTEGER NOT NULL DEFAULT 0,
    processed_date TEXT NOT NULL DEFAULT (datetime('now')),
    direction TEXT NOT NULL DEFAULT 'in',  -- 'in' (synced from Gmail) or 'out' (a reply we sent) - lets a thread's back-and-forth render as an actual branch of alternating nodes
    is_read INTEGER NOT NULL DEFAULT 1,  -- from Gmail's UNREAD label; refreshed on every sync (unlike our own AI fields below)
    pos_x REAL,  -- persisted board-canvas position, absolute world coordinates
    pos_y REAL,
    gmail_category TEXT  -- Gmail's own primary/social/promotions/updates/spam label, distinct from our AI-classified `category`
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,  -- Gmail attachmentId
    email_id INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    filename TEXT,
    mime_type TEXT,
    size INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sender_names (
    sender_email TEXT PRIMARY KEY,  -- bare address, e.g. bob@example.com
    custom_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    summary_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voice_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_text TEXT NOT NULL,
    action_taken TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at INTEGER NOT NULL  -- unix timestamp; compared in Python, not SQL, to avoid datetime-string-format mismatches
);
"""


def get_connection() -> sqlite3.Connection:
    settings.db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_session():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with db_session() as conn:
        conn.executescript(SCHEMA)
        # emails table predates gmail sync support; migrate dev DBs in place
        # (table is always empty at this point in the project, so drop+recreate is safe)
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(emails)")}
        if "gmail_message_id" not in cols:
            conn.execute("DROP TABLE emails")
            conn.executescript(SCHEMA)

        # sessions.expires_at briefly existed as TEXT during development
        # (before switching to a unix-timestamp INTEGER for reliable
        # comparison in Python) - drop and recreate if a dev DB still has
        # the old column type. Sessions are cheap to lose: just log in again.
        session_cols = {row["name"]: row["type"] for row in conn.execute("PRAGMA table_info(sessions)")}
        if session_cols.get("expires_at") == "TEXT":
            conn.execute("DROP TABLE sessions")
            conn.executescript(SCHEMA)

        # direction was added after real emails had already been synced -
        # ALTER instead of drop+recreate so existing synced/classified mail
        # isn't lost. Every pre-existing row is a synced (incoming) message,
        # so the column default of 'in' is already correct for them.
        # (Recheck cols here rather than reuse the value above: it may be
        # stale if the gmail_message_id branch just dropped+recreated the table.)
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(emails)")}
        if "direction" not in cols:
            conn.execute("ALTER TABLE emails ADD COLUMN direction TEXT NOT NULL DEFAULT 'in'")

        # doc_type split the shared documents table into two histories (plain
        # documents vs. invoice backing rows). Existing rows predate the split
        # and were all exam/document uploads, so the 'document' default is
        # correct for them - invoices going forward are tagged 'invoice'.
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(documents)")}
        if "doc_type" not in cols:
            conn.execute("ALTER TABLE documents ADD COLUMN doc_type TEXT NOT NULL DEFAULT 'document'")

        # is_read/pos_x/pos_y/gmail_category: same story, added after real
        # data existed. is_read defaults to 1 (read) for pre-existing rows -
        # harmless, since the next sync overwrites it from Gmail's real
        # current UNREAD state (see sync_emails' ON CONFLICT DO UPDATE).
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(emails)")}
        if "is_read" not in cols:
            conn.execute("ALTER TABLE emails ADD COLUMN is_read INTEGER NOT NULL DEFAULT 1")
        if "pos_x" not in cols:
            conn.execute("ALTER TABLE emails ADD COLUMN pos_x REAL")
        if "pos_y" not in cols:
            conn.execute("ALTER TABLE emails ADD COLUMN pos_y REAL")
        if "gmail_category" not in cols:
            conn.execute("ALTER TABLE emails ADD COLUMN gmail_category TEXT")

        # received_date used to store Gmail's raw RFC 2822 header
        # ("Thu, 17 Sep 2026 22:41:32 +0300"), which doesn't sort correctly
        # as a plain string (day-of-month isn't zero-padded). New syncs write
        # ISO 8601 instead; backfill old rows once so thread ordering (and
        # the back-and-forth branch view) is chronologically correct.
        from datetime import timezone
        from email.utils import parsedate_to_datetime

        for row in conn.execute("SELECT id, received_date FROM emails WHERE received_date LIKE '%,%'").fetchall():
            try:
                # Normalize to UTC, not just ISO-format-with-original-offset:
                # two ISO timestamps only sort correctly as strings when they
                # share one offset (e.g. two senders in different timezones
                # otherwise compare wrong).
                iso = parsedate_to_datetime(row["received_date"]).astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError):
                continue
            conn.execute("UPDATE emails SET received_date = ? WHERE id = ?", (iso, row["id"]))

        # Bootstrap: with no users yet there's no way to log in at all, so
        # seed a default admin account. Change this password after first login.
        if conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0:
            from app.services.passwords import hash_password

            conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
                ("karam", hash_password("12345")),
            )
