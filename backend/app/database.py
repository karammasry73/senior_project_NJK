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
    processed_date TEXT NOT NULL DEFAULT (datetime('now'))
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

        # Bootstrap: with no users yet there's no way to log in at all, so
        # seed a default admin account. Change this password after first login.
        if conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0:
            from app.services.passwords import hash_password

            conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
                ("karam", hash_password("12345")),
            )
