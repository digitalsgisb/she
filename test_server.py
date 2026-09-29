"""Focused integration checks for Safety Digital accounts and authorization."""

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
        self.assertIn('/styles.css?v=20260929-she1', html)
        self.assertIn('/script.js?v=20260929-she1', html)
        self.assertIn('/cmms-ui.js?v=20260929-she1', html)
        self.assertEqual(headers["Cache-Control"], "no-store")
        status, icon, headers = self.request("/favicon.svg?v=20260928-sync1")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "image/svg+xml")
        self.assertIn("<svg", icon)
        status, manifest, headers = self.request("/manifest.webmanifest")
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "application/manifest+json")
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(self.request("/sw.js")[0], 200)

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
