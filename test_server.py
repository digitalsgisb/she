"""Focused integration checks for Safety Digital accounts and authorization."""

import json
import sqlite3
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class AccountFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        server.DB_PATH = Path(self.temp.name) / "safety.db"
        server.FAILED_LOGINS.clear()
        server.init_db()
        self.http = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.http.server_port}"

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(timeout=2)
        for attempt in range(5):
            try:
                self.temp.cleanup()
                break
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.1)

    def request(self, path, method="GET", body=None, cookie=None, csrf=None, origin=None):
        headers = {}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if cookie:
            headers["Cookie"] = cookie
        if csrf:
            headers["X-CSRF-Token"] = csrf
        if origin:
            headers["Origin"] = origin
        req = Request(self.base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
        try:
            response = urlopen(req)
        except HTTPError as error:
            response = error
        data = response.read()
        return response.status, json.loads(data) if data.startswith((b"{", b"[")) else data.decode(), response.headers

    def first_admin(self):
        with server.database() as db:
            db.execute("INSERT INTO users(username,display_name,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)", ("admin", "Admin User", server.hash_password("AdminPassword123!"), "admin", int(time.time())))

    def login(self, username, password):
        status, data, headers = self.request("/api/login", "POST", {"username": username, "password": password})
        self.assertEqual(status, 200)
        return headers["Set-Cookie"].split(";", 1)[0], data["csrf_token"]

    def test_login_user_management_and_access_revocation(self):
        self.assertEqual(self.request("/api/setup-status")[1], {"needs_admin": True})
        self.assertEqual(self.request("/api/users")[0], 401)
        self.first_admin()
        self.assertEqual(self.request("/api/setup-status")[1], {"needs_admin": False})
        self.assertEqual(self.request("/api/login", "POST", {"username": "admin", "password": "wrong"})[0], 401)
        admin_cookie, admin_csrf = self.login("admin", "AdminPassword123!")
        self.assertEqual(self.request("/api/users", cookie=admin_cookie)[0], 200)
        self.assertEqual(self.request("/api/users", "POST", {"username": "operator", "display_name": "Operator", "password": "OperatorPass123!", "role": "user"}, admin_cookie)[0], 403)
        self.assertEqual(self.request("/api/users", "POST", {}, admin_cookie, admin_csrf, "https://evil.example")[0], 403)
        status, created, _ = self.request("/api/users", "POST", {"username": "operator", "display_name": "Operator", "password": "OperatorPass123!", "role": "user"}, admin_cookie, admin_csrf)
        self.assertEqual(status, 201)
        operator_id = created["user"]["id"]
        user_cookie, user_csrf = self.login("operator", "OperatorPass123!")
        self.assertEqual(self.request("/api/users", cookie=user_cookie)[0], 403)
        self.assertEqual(self.request("/api/users", "POST", {}, user_cookie, user_csrf)[0], 403)
        self.assertEqual(self.request(f"/api/users/{operator_id}/reset-password", "POST", {"password": "NewOperatorPass123!"}, admin_cookie, admin_csrf)[0], 200)
        self.assertEqual(self.request("/api/session", cookie=user_cookie)[0], 401)
        self.assertEqual(self.request("/api/login", "POST", {"username": "operator", "password": "OperatorPass123!"})[0], 401)
        user_cookie, _ = self.login("operator", "NewOperatorPass123!")
        status, _, _ = self.request(f"/api/users/{operator_id}", "PATCH", {"active": False}, admin_cookie, admin_csrf)
        self.assertEqual(status, 200)
        self.assertEqual(self.request("/api/session", cookie=user_cookie)[0], 401)
        self.assertEqual(self.request("/api/login", "POST", {"username": "operator", "password": "NewOperatorPass123!"})[0], 401)
        self.assertEqual(self.request("/api/users/1", "PATCH", {"active": False}, admin_cookie, admin_csrf)[0], 400)

    def test_password_change_invalidates_session(self):
        self.first_admin()
        cookie, csrf = self.login("admin", "AdminPassword123!")
        status, _, _ = self.request("/api/me/password", "POST", {"current_password": "AdminPassword123!", "new_password": "NewAdminPassword123!"}, cookie, csrf)
        self.assertEqual(status, 200)
        self.assertEqual(self.request("/api/session", cookie=cookie)[0], 401)
        self.login("admin", "NewAdminPassword123!")

    def test_versioned_assets_and_hidden_shell(self):
        status, html, headers = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn('id="appShell" hidden', html)
        self.assertIn('/styles.css?v=20260928-sidebar2', html)
        self.assertIn('/script.js?v=20260928-sidebar2', html)
        self.assertEqual(headers["Cache-Control"], "no-store")
        status, icon, headers = self.request("/favicon.svg?v=20260928-sync1")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/svg+xml")
        self.assertIn("<svg", icon)


if __name__ == "__main__":
    unittest.main()
