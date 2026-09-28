"""Safety Digital web server and small SQLite-backed account service."""

from __future__ import annotations

import getpass
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import time
from contextlib import contextmanager
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("SAFETY_DB_PATH", str(ROOT / "data" / "safety.db")))
PORT = int(os.environ.get("PORT", "8000"))
SESSION_SECONDS = 12 * 60 * 60
HASH_ITERATIONS = 600_000
USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,32}$")
FAILED_LOGINS: dict[tuple[str, str], list[float]] = {}
LOGIN_LOCK = Lock()
COOKIE_NAME = "safety_session"


@contextmanager
def database():
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                display_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                csrf_token TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
            """
        )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, HASH_ITERATIONS)
    return f"pbkdf2_sha256${HASH_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, rounds, salt, stored = encoded.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), int(rounds))
        return hmac.compare_digest(actual, bytes.fromhex(stored))
    except (ValueError, TypeError):
        return False


def public_user(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "display_name": row["display_name"],
        "role": row["role"],
        "active": bool(row["active"]),
        "created_at": row["created_at"],
    }


def valid_password(password: object) -> bool:
    return isinstance(password, str) and 12 <= len(password) <= 128 and len(password.encode("utf-8")) <= 512


def create_first_admin() -> None:
    init_db()
    with database() as db:
        if db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            raise SystemExit("Accounts already exist. Use the User Management page to add users.")
    username = input("Admin username (3–32 letters, numbers, . _ -): ").strip().lower()
    display_name = input("Display name: ").strip()
    password = getpass.getpass("Password (at least 12 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if not USERNAME_RE.fullmatch(username) or not 1 <= len(display_name) <= 80:
        raise SystemExit("Invalid username or display name.")
    if not valid_password(password) or password != confirmation:
        raise SystemExit("Passwords must match and contain 12–128 characters.")
    with database() as db:
        db.execute(
            "INSERT INTO users(username,display_name,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)",
            (username, display_name, hash_password(password), "admin", int(time.time())),
        )
    print(f"Admin account '{username}' created.")


class Handler(BaseHTTPRequestHandler):
    server_version = "SafetyDigital/1.0"

    def security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")

    def send_json(self, status: int, payload: dict | list, extra_headers: dict[str, str] | None = None) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.security_headers()
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def error_json(self, status: int, message: str) -> None:
        self.send_json(status, {"error": message})

    def read_json(self) -> dict | None:
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower() != "application/json":
            self.error_json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Use application/json.")
            return None
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > 16_384:
                raise ValueError
            value = json.loads(self.rfile.read(length))
            if not isinstance(value, dict):
                raise ValueError
            return value
        except (ValueError, json.JSONDecodeError):
            self.error_json(HTTPStatus.BAD_REQUEST, "Invalid request data.")
            return None

    def same_origin(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            return True  # Non-browser clients still need the CSRF token.
        parsed = urlsplit(origin)
        host = self.headers.get("Host", "").lower()
        return parsed.scheme in ("http", "https") and parsed.netloc.lower() == host

    def secure_cookie(self) -> bool:
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        return host not in ("localhost", "127.0.0.1", "[::1]")

    def cookie_header(self, token: str, clear: bool = False) -> str:
        value = f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Path=/"
        if self.secure_cookie():
            value += "; Secure"
        if clear:
            value += "; Max-Age=0"
        else:
            value += f"; Max-Age={SESSION_SECONDS}"
        return value

    def session(self, db: sqlite3.Connection) -> tuple[sqlite3.Row, sqlite3.Row] | None:
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            return None
        if COOKIE_NAME not in cookies:
            return None
        token = cookies[COOKIE_NAME].value
        if len(token) != 64 or not re.fullmatch(r"[0-9a-f]{64}", token):
            return None
        row = db.execute(
            "SELECT s.*,u.id AS uid,u.username,u.display_name,u.password_hash,u.role,u.active,u.created_at AS user_created_at "
            "FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1",
            (hashlib.sha256(token.encode()).hexdigest(), int(time.time())),
        ).fetchone()
        if not row:
            return None
        user = db.execute("SELECT * FROM users WHERE id=?", (row["uid"],)).fetchone()
        return user, row

    def authorize(self, db: sqlite3.Connection, admin: bool = False, csrf: bool = False) -> tuple[sqlite3.Row, sqlite3.Row] | None:
        session = self.session(db)
        if not session:
            self.error_json(HTTPStatus.UNAUTHORIZED, "Please sign in.")
            return None
        user, details = session
        if admin and user["role"] != "admin":
            self.error_json(HTTPStatus.FORBIDDEN, "Admin access required.")
            return None
        if csrf and not hmac.compare_digest(self.headers.get("X-CSRF-Token", ""), details["csrf_token"]):
            self.error_json(HTTPStatus.FORBIDDEN, "Session verification failed. Refresh the page and retry.")
            return None
        return session

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/healthz":
            body = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/api/setup-status":
            with database() as db:
                needs_admin = db.execute("SELECT 1 FROM users LIMIT 1").fetchone() is None
            self.send_json(200, {"needs_admin": needs_admin})
            return
        if path == "/api/session":
            with database() as db:
                session = self.authorize(db)
                if session:
                    self.send_json(200, {"user": public_user(session[0]), "csrf_token": session[1]["csrf_token"]})
            return
        if path == "/api/users":
            with database() as db:
                if self.authorize(db, admin=True):
                    users = db.execute("SELECT * FROM users ORDER BY created_at DESC,id DESC").fetchall()
                    self.send_json(200, {"users": [public_user(user) for user in users]})
            return
        assets = {"/": ROOT / "index.html", "/index.html": ROOT / "index.html", "/styles.css": ROOT / "styles.css", "/script.js": ROOT / "script.js"}
        if re.fullmatch(r"/brand/[1-4]\.png", path):
            assets[path] = ROOT / "public" / path.lstrip("/")
        file = assets.get(path)
        if not file or not file.is_file():
            self.error_json(404, "Not found.")
            return
        body = file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        self.change_request("POST")

    def do_PATCH(self) -> None:
        self.change_request("PATCH")

    def change_request(self, method: str) -> None:
        path = urlsplit(self.path).path
        if not self.same_origin():
            self.error_json(403, "Origin verification failed.")
            return
        data = self.read_json()
        if data is None:
            return
        with database() as db:
            if method == "POST" and path == "/api/login":
                self.login(db, data)
                return
            session = self.authorize(db, csrf=True)
            if not session:
                return
            user, details = session
            if method == "POST" and path == "/api/logout":
                db.execute("DELETE FROM sessions WHERE token_hash=?", (details["token_hash"],))
                self.send_json(200, {"ok": True}, {"Set-Cookie": self.cookie_header("", clear=True)})
                return
            if method == "POST" and path == "/api/me/password":
                self.change_password(db, user, data)
                return
            if user["role"] != "admin":
                self.error_json(403, "Admin access required.")
                return
            if method == "POST" and path == "/api/users":
                self.create_user(db, data)
                return
            match = re.fullmatch(r"/api/users/(\d+)", path)
            if method == "PATCH" and match:
                self.update_user(db, user, int(match.group(1)), data)
                return
            match = re.fullmatch(r"/api/users/(\d+)/reset-password", path)
            if method == "POST" and match:
                self.reset_password(db, user["id"], int(match.group(1)), data)
                return
            self.error_json(404, "Not found.")

    def login(self, db: sqlite3.Connection, data: dict) -> None:
        username = str(data.get("username", "")).strip().lower()
        password = data.get("password", "")
        if not USERNAME_RE.fullmatch(username) or not isinstance(password, str) or len(password) > 128:
            self.error_json(401, "Invalid username or password.")
            return
        key = (self.client_address[0], username)
        now = time.time()
        with LOGIN_LOCK:
            attempts = [stamp for stamp in FAILED_LOGINS.get(key, []) if stamp > now - 900]
            FAILED_LOGINS[key] = attempts
            if len(attempts) >= 5:
                self.error_json(429, "Too many attempts. Try again in 15 minutes.")
                return
        user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if not user or not user["active"] or not verify_password(password, user["password_hash"]):
            with LOGIN_LOCK:
                FAILED_LOGINS.setdefault(key, []).append(now)
            self.error_json(401, "Invalid username or password.")
            return
        with LOGIN_LOCK:
            FAILED_LOGINS.pop(key, None)
        token = secrets.token_hex(32)
        csrf = secrets.token_hex(32)
        db.execute("DELETE FROM sessions WHERE expires_at<=?", (int(now),))
        db.execute("INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user["id"], csrf, int(now) + SESSION_SECONDS, int(now)))
        self.send_json(200, {"user": public_user(user), "csrf_token": csrf}, {"Set-Cookie": self.cookie_header(token)})

    def create_user(self, db: sqlite3.Connection, data: dict) -> None:
        username = str(data.get("username", "")).strip().lower()
        name = str(data.get("display_name", "")).strip()
        role = data.get("role", "user")
        password = data.get("password")
        if not USERNAME_RE.fullmatch(username) or not 1 <= len(name) <= 80 or role not in ("admin", "user") or not valid_password(password):
            self.error_json(400, "Enter a valid username, display name, role and password of at least 12 characters.")
            return
        try:
            cursor = db.execute("INSERT INTO users(username,display_name,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)", (username, name, hash_password(password), role, int(time.time())))
        except sqlite3.IntegrityError:
            self.error_json(409, "That username is already in use.")
            return
        created = db.execute("SELECT * FROM users WHERE id=?", (cursor.lastrowid,)).fetchone()
        self.send_json(201, {"user": public_user(created)})

    def update_user(self, db: sqlite3.Connection, actor: sqlite3.Row, user_id: int, data: dict) -> None:
        db.execute("BEGIN IMMEDIATE")
        target = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not target:
            self.error_json(404, "User not found.")
            return
        if not data or set(data) - {"display_name", "role", "active"}:
            self.error_json(400, "Invalid update.")
            return
        name = str(data.get("display_name", target["display_name"])).strip()
        role = data.get("role", target["role"])
        active = data.get("active", bool(target["active"]))
        if not 1 <= len(name) <= 80 or role not in ("admin", "user") or not isinstance(active, bool):
            self.error_json(400, "Invalid user details.")
            return
        if user_id == actor["id"] and (role != "admin" or not active):
            self.error_json(400, "You cannot remove your own admin access.")
            return
        if target["role"] == "admin" and target["active"] and (role != "admin" or not active):
            count = db.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1").fetchone()[0]
            if count <= 1:
                self.error_json(400, "At least one active admin is required.")
                return
        db.execute("UPDATE users SET display_name=?,role=?,active=? WHERE id=?", (name, role, int(active), user_id))
        if not active:
            db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        updated = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        self.send_json(200, {"user": public_user(updated)})

    def reset_password(self, db: sqlite3.Connection, actor_id: int, user_id: int, data: dict) -> None:
        password = data.get("password")
        if not valid_password(password):
            self.error_json(400, "Password must contain 12–128 characters.")
            return
        if not db.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
            self.error_json(404, "User not found.")
            return
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(password), user_id))
        db.execute("DELETE FROM sessions WHERE user_id=?", (user_id,))
        headers = {"Set-Cookie": self.cookie_header("", clear=True)} if actor_id == user_id else None
        self.send_json(200, {"ok": True}, headers)

    def change_password(self, db: sqlite3.Connection, user: sqlite3.Row, data: dict) -> None:
        current = data.get("current_password", "")
        replacement = data.get("new_password", "")
        if not isinstance(current, str) or not verify_password(current, user["password_hash"]):
            self.error_json(400, "Current password is incorrect.")
            return
        if not valid_password(replacement):
            self.error_json(400, "New password must contain 12–128 characters.")
            return
        db.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(replacement), user["id"]))
        db.execute("DELETE FROM sessions WHERE user_id=?", (user["id"],))
        self.send_json(200, {"ok": True}, {"Set-Cookie": self.cookie_header("", clear=True)})


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "create-admin":
        create_first_admin()
        return
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Safety Digital listening on port {PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
