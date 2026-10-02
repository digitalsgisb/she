"""Focused integration checks for SHE Digital accounts and authorization."""

import json
import sqlite3
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class RoleMigrationTests(unittest.TestCase):
    def test_old_user_roles_migrate_without_losing_accounts_or_sessions(self):
        original_path = server.DB_PATH
        temp = tempfile.TemporaryDirectory()
        try:
            server.DB_PATH = Path(temp.name) / "old.db"
            with sqlite3.connect(server.DB_PATH) as db:
                db.executescript("""
                        CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                            display_name TEXT NOT NULL, password_hash TEXT NOT NULL,
                            role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                            active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)), created_at INTEGER NOT NULL);
                        CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
                        CREATE TABLE patrols (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
                            inspector_name TEXT NOT NULL, answers_json TEXT NOT NULL, rating INTEGER NOT NULL,
                            remarks TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
                        INSERT INTO users(id,username,display_name,password_hash,role,active,created_at)
                            VALUES(1,'olduser','Old User','hash','user',1,1);
                        INSERT INTO sessions VALUES('token',1,'csrf',9999999999,1);
                        INSERT INTO patrols VALUES(1,1,'Old User','{}',3,'',1);
                """)
            db.close()
            server.init_db()
            with server.database() as db:
                self.assertEqual(db.execute("SELECT username FROM users WHERE id=1").fetchone()[0], "olduser")
                self.assertEqual(db.execute("SELECT user_id FROM sessions").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT user_id FROM patrols").fetchone()[0], 1)
                db.execute("UPDATE users SET role='executive' WHERE id=1")
                self.assertFalse(db.execute("PRAGMA foreign_key_check").fetchall())
        finally:
            server.DB_PATH = original_path
            for attempt in range(5):
                try:
                    temp.cleanup()
                    break
                except PermissionError:
                    if attempt == 4:
                        raise
                    time.sleep(0.1)


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
        self.assertIn('/styles.css?v=20261002-mobile-nav1', html)
        self.assertIn('/script.js?v=20261002-mobile-nav1', html)
        self.assertIn('/patrol.js?v=20261002-mobile-nav1', html)
        self.assertIn('/cmms-ui.js?v=20261002-mobile-nav1', html)
        self.assertIn('id="mobileTabbar"', html)
        self.assertEqual(headers["Cache-Control"], "no-store")
        status, icon, headers = self.request("/favicon.svg?v=20260928-sync1")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/svg+xml")
        self.assertIn("<svg", icon)
        status, manifest, headers = self.request("/manifest.webmanifest")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/manifest+json")
        self.assertEqual(manifest["display"], "standalone")
        self.assertTrue(any(icon["sizes"] == "512x512" for icon in manifest["icons"]))
        with urlopen(self.base + "/icons/icon-192.png") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Content-Type"], "image/png")
        self.assertEqual(self.request("/sw.js")[0], 200)

    def test_patrol_submission_and_attachment_access(self):
        self.first_admin()
        cookie, csrf = self.login("admin", "AdminPassword123!")
        answers = {f"{group}_{index}": "ok" for group, count in server.PATROL_GROUPS.items() for index in range(count)}
        payload = {"inspector_name": "Sara", "answers": answers, "rating": 3, "remarks": "All clear"}
        self.assertEqual(self.request("/api/patrols")[0], 401)
        self.assertEqual(self.request("/api/patrols", "POST", payload, cookie)[0], 403)
        bad = dict(payload, answers={"general_0": "ok"})
        self.assertEqual(self.request("/api/patrols", "POST", bad, cookie, csrf)[0], 400)
        status, result, _ = self.request("/api/patrols", "POST", payload, cookie, csrf)
        self.assertEqual(status, 201)
        patrol_id = result["id"]
        self.assertEqual(self.request("/api/patrols", cookie=cookie)[1]["patrols"][0]["id"], patrol_id)
        self.assertEqual(self.request(f"/api/patrols/{patrol_id}", cookie=cookie)[1]["patrol"]["answers"], answers)
        request = Request(self.base + f"/api/patrols/{patrol_id}/attachments", data=b"%PDF-1.4\n",
                          headers={"Cookie": cookie, "X-CSRF-Token": csrf, "X-File-Name": "inspection.pdf",
                                   "Content-Type": "application/octet-stream"}, method="POST")
        with urlopen(request) as response:
            self.assertEqual(response.status, 201)
            attachment_id = json.load(response)["id"]
        self.assertEqual(self.request(f"/api/patrols/{patrol_id}", cookie=cookie)[1]["patrol"]["attachments"][0]["filename"], "inspection.pdf")
        self.assertEqual(self.request(f"/api/patrols/{patrol_id}/attachments/{attachment_id}")[0], 401)
        self.assertEqual(self.request(f"/api/patrols/{patrol_id}/attachments/{attachment_id}", cookie=cookie)[1], "%PDF-1.4\n")

    def test_patrol_period_and_role_visibility(self):
        self.first_admin()
        admin_cookie, admin_csrf = self.login("admin", "AdminPassword123!")
        for username, role in (("operator", "user"), ("manager", "executive")):
            status, _, _ = self.request("/api/users", "POST", {"username": username, "display_name": username.title(),
                "password": "TestPassword123!", "role": role}, admin_cookie, admin_csrf)
            self.assertEqual(status, 201)
        user_cookie, user_csrf = self.login("operator", "TestPassword123!")
        executive_cookie, _ = self.login("manager", "TestPassword123!")
        answers = {f"{group}_{index}": "ok" for group, count in server.PATROL_GROUPS.items() for index in range(count)}
        answers["hazards_0"] = "not_ok"
        payload = {"inspector_name": "Aman", "answers": answers, "rating": 2}
        admin_id = self.request("/api/patrols", "POST", payload, admin_cookie, admin_csrf)[1]["id"]
        user_id = self.request("/api/patrols", "POST", payload, user_cookie, user_csrf)[1]["id"]
        start, end = int(time.time()) - 3600, int(time.time()) + 3600
        query = f"/api/patrols?start={start}&end={end}"
        self.assertEqual(self.request(query, cookie=user_cookie)[1]["patrols"][0]["id"], user_id)
        self.assertEqual(len(self.request(query, cookie=user_cookie)[1]["patrols"]), 1)
        self.assertEqual(len(self.request(query, cookie=executive_cookie)[1]["patrols"]), 2)
        self.assertEqual(self.request(query, cookie=executive_cookie)[1]["patrols"][0]["counts"]["not_ok"], 1)
        self.assertEqual(self.request(f"/api/patrols/{admin_id}", cookie=user_cookie)[0], 404)
        self.assertEqual(self.request(f"/api/patrols/{admin_id}", cookie=executive_cookie)[0], 200)
        self.assertEqual(self.request("/api/patrols?start=1&end=999999999", cookie=admin_cookie)[0], 400)

    def test_she_work_orders_are_scoped_and_verification_requires_a_resolved_job(self):
        class FakeCmms:
            configured = True
            def __init__(self):
                self.calls = []
            def plants(self):
                return ["port-klang"]
            def identity(self):
                return {"id": "she-requester", "role": "requester", "department": "SHE"}
            def call(self, path, method="GET", body=None, plant="port-klang", binary=False):
                self.calls.append((path, method, body, plant))
                if path == "/api/push/config":
                    return {"enabled": False, "publicKey": None}
                if path == "/api/work-orders" and method == "GET":
                    return [{"id": "she-1", "responsibleDepartment": "SHE"}, {"id": "prod-1", "responsibleDepartment": "Production"}]
                if path == "/api/work-orders/she-1":
                    return {"id": "she-1", "responsibleDepartment": "SHE", "status": "resolved"}
                if path == "/api/work-orders/prod-1":
                    return {"id": "prod-1", "responsibleDepartment": "Production", "status": "resolved"}
                return {"id": "new-she", "responsibleDepartment": "SHE"}
            def she_order(self, order_id, plant):
                order = self.call("/api/work-orders/" + order_id, plant=plant)
                if order["responsibleDepartment"] != "SHE":
                    raise server.CmmsError(404, "SHE work order not found.")
                return order

        self.first_admin()
        cookie, csrf = self.login("admin", "AdminPassword123!")
        fake = FakeCmms()
        with patch.object(server, "bridge", fake):
            self.assertEqual(self.request("/api/cmms/work-orders")[0], 401)
            self.assertEqual(self.request("/api/cmms/work-orders", cookie=cookie)[1], [{"id": "she-1", "responsibleDepartment": "SHE"}])
            self.assertEqual(self.request("/api/cmms/work-orders/prod-1", cookie=cookie)[0], 404)
            self.assertEqual(self.request("/api/cmms/work-orders", "POST", {"issueDescription": "Broken exhaust fan"}, cookie=cookie)[0], 403)
            status, created, _ = self.request("/api/cmms/work-orders", "POST", {"issueDescription": "Broken exhaust fan", "machineName": "Fan", "plant": "port-klang"}, cookie, csrf)
            self.assertEqual(status, 201)
            self.assertEqual(created["id"], "new-she")
            create = [call for call in fake.calls if call[0] == "/api/work-orders" and call[1] == "POST"][-1]
            self.assertEqual(create[2]["responsibleDepartment"], "SHE")
            self.assertEqual(create[2]["requesterId"], "she-requester")
            self.assertEqual(self.request("/api/cmms/work-orders/she-1/verification", "PATCH", {"plant": "port-klang", "status": "returned", "note": ""}, cookie, csrf)[0], 400)
            status, _, _ = self.request("/api/cmms/work-orders/she-1/verification", "PATCH", {"plant": "port-klang", "status": "closed", "note": "Looks good"}, cookie, csrf)
            self.assertEqual(status, 200)
            verification = [call for call in fake.calls if call[0].endswith("/status")][-1]
            self.assertEqual(verification[2]["status"], "closed")
            self.assertIn("Admin User", verification[2]["note"])


if __name__ == "__main__":
    unittest.main()
