"""Server-side connector for the CMMS SHE requester account."""

from __future__ import annotations

import json
import os
import secrets
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class CmmsError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class CmmsBridge:
    def __init__(self):
        self.base_url = os.environ.get("CMMS_URL", "").strip().rstrip("/")
        self.username = os.environ.get("CMMS_USERNAME", "").strip()
        self.password = os.environ.get("CMMS_PASSWORD", "")
        self._token = ""
        self._user = None
        self._expires = 0.0
        self._lock = threading.Lock()

    @property
    def configured(self):
        return bool(self.base_url and self.username and self.password)

    def _send(self, path, method="GET", body=None, plant="port-klang", token="", binary=False):
        if not self.base_url.startswith(("http://", "https://")):
            raise CmmsError(503, "CMMS_URL must be an HTTP or HTTPS address.")
        headers = {"X-CMMS-Plant": plant, "Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        payload = None
        if body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(self.base_url + path, data=payload, headers=headers, method=method)
        try:
            with urlopen(request, timeout=12) as response:
                data = response.read(15 * 1024 * 1024 + 1)
                if len(data) > 15 * 1024 * 1024:
                    raise CmmsError(502, "CMMS response is too large.")
                return (data, response.headers.get("Content-Type", "application/octet-stream")) if binary else json.loads(data)
        except HTTPError as error:
            try:
                message = json.loads(error.read(4096)).get("error", "CMMS request failed.")
            except (ValueError, AttributeError):
                message = "CMMS request failed."
            raise CmmsError(error.code if error.code < 500 else 502, str(message)) from error
        except (URLError, TimeoutError, OSError) as error:
            raise CmmsError(502, "CMMS is unavailable. Try again shortly.") from error

    def identity(self, refresh=False):
        if not self.configured:
            raise CmmsError(503, "CMMS connection is not configured.")
        with self._lock:
            if refresh or not self._token or time.monotonic() > self._expires:
                session = self._send("/api/auth/login", "POST", {"username": self.username, "password": self.password})
                user = session.get("user", {})
                if user.get("role") != "requester" or user.get("department", "").strip().lower() != "she":
                    raise CmmsError(503, "CMMS account must be a SHE requester.")
                self._token = session["token"]
                self._user = user
                self._expires = time.monotonic() + 3600
            return self._user

    def plants(self):
        access = self.identity().get("plantAccess")
        return ["port-klang", "sendayan"] if access == "both" else [access]

    def call(self, path, method="GET", body=None, plant="port-klang", binary=False):
        if plant not in ("port-klang", "sendayan") or plant not in self.plants():
            raise CmmsError(403, "CMMS account cannot access this plant.")
        try:
            return self._send(path, method, body, plant, self._token, binary)
        except CmmsError as error:
            if error.status != 401:
                raise
            self.identity(refresh=True)
            return self._send(path, method, body, plant, self._token, binary)

    def she_order(self, order_id, plant):
        order = self.call(f"/api/work-orders/{quote(order_id, safe='')}", plant=plant)
        if order.get("responsibleDepartment") != "SHE":
            raise CmmsError(404, "SHE work order not found.")
        return order

    def upload_photo(self, order_id, plant, filename, content_type, content, actor_id, kind):
        self.she_order(order_id, plant)
        boundary = "safety" + secrets.token_hex(12)
        def field(name, value):
            return (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n").encode()
        safe_name = filename.replace('"', "").replace("\\", "_").replace("/", "_")[:120]
        body = field("uploadedBy", actor_id) + field("kind", kind)
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"attachments\"; filename=\"{safe_name}\"\r\nContent-Type: {content_type}\r\n\r\n").encode()
        body += content + f"\r\n--{boundary}--\r\n".encode()
        for attempt in range(2):
            request = Request(self.base_url + f"/api/work-orders/{quote(order_id, safe='')}/attachments", data=body,
                              headers={"Authorization": f"Bearer {self._token}", "X-CMMS-Plant": plant,
                                       "Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
            try:
                with urlopen(request, timeout=30) as response:
                    return json.loads(response.read())
            except HTTPError as error:
                if error.code == 401 and attempt == 0:
                    self.identity(refresh=True)
                    continue
                try:
                    message = json.loads(error.read(4096)).get("error", "Photo upload failed.")
                except (ValueError, AttributeError):
                    message = "Photo upload failed."
                raise CmmsError(error.code if error.code < 500 else 502, message) from error
            except (URLError, TimeoutError, OSError) as error:
                raise CmmsError(502, "CMMS is unavailable. Try again shortly.") from error


bridge = CmmsBridge()
