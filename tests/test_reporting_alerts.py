"""New-report alerts: privacy, durable counts, idempotency and phone delivery."""
import base64
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import reporting_alerts as alerts
import server
from test_server import AccountFlowTests
from test_reporting import ReportingTests
from test_http_memory import urlopen


class ReportAlertTests(unittest.TestCase):
    setUp = AccountFlowTests.setUp
    tearDown = AccountFlowTests.tearDown
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login
    payload = ReportingTests.payload

    def request(self, *args, **kwargs):
        with patch('test_server.urlopen', urlopen):
            return AccountFlowTests.request(self, *args, **kwargs)

    def account(self):
        self.first_admin()
        return self.login('admin', 'AdminPassword123!')

    def subscription(self, suffix='one'):
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        key = ec.generate_private_key(ec.SECP256R1()).public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        encode = lambda data: base64.urlsafe_b64encode(data).decode().rstrip('=')
        return dict(endpoint='https://fcm.googleapis.com/fcm/send/' + suffix,
                    keys=dict(p256dh=encode(key), auth=encode(b'1234567890123456')))

    def test_unread_is_per_executive_durable_and_retry_does_not_alert_twice(self):
        cookie, csrf = self.account()
        self.assertEqual(self.request('/api/reporting/notifications')[0], 401)
        self.assertEqual(self.request('/api/reporting/notifications', cookie=cookie)[1]['unread'], 0)
        with patch.object(alerts, 'queue_report') as queue:
            data = self.payload()
            self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 201)
            self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 200)
            self.assertEqual(queue.call_count, 1)
        result = self.request('/api/reporting/notifications', cookie=cookie)[1]
        self.assertEqual(result['unread'], 1)
        self.assertEqual(result['reports'][0]['reference'], 'SHE-000001')
        self.assertNotIn('reporter', result['reports'][0])
        self.assertEqual(self.request('/api/reporting/notifications/read', 'POST', {'through_id':1}, cookie)[0], 403)
        self.assertEqual(self.request('/api/reporting/notifications/read', 'POST', {'through_id':2}, cookie, csrf)[0], 400)
        self.assertEqual(self.request('/api/reporting/notifications/read', 'POST', {'through_id':1}, cookie, csrf)[0], 200)
        server.init_db()
        self.assertEqual(self.request('/api/reporting/notifications', cookie=cookie)[1]['unread'], 0)
        self.request('/api/reporting/submit', 'POST', self.payload())
        self.request('/api/reporting/notifications/read', 'POST', {'through_id':0}, cookie, csrf)
        self.assertEqual(self.request('/api/reporting/notifications', cookie=cookie)[1]['unread'], 1)
        with server.database() as db:
            db.execute("INSERT INTO users(username,display_name,password_hash,role,active,created_at) VALUES('exec','SHE Executive',?,'executive',1,1)", (server.hash_password('ExecutivePassword123!'),))
        executive, exec_csrf = self.login('exec', 'ExecutivePassword123!')
        self.assertEqual(self.request('/api/reporting/notifications', cookie=executive)[1]['unread'], 2)
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE username='exec'")
        self.assertEqual(self.request('/api/reporting/notifications', cookie=executive)[0], 403)
        self.assertEqual(self.request('/api/reporting/notifications/read', 'POST', {'through_id':1}, executive, exec_csrf)[0], 403)

    def test_qr_is_generated_locally_for_public_reporting(self):
        cookie, _ = self.account()
        self.assertEqual(self.request('/api/reporting/qr')[0], 401)
        with patch.dict(os.environ, {'SHE_PUBLIC_URL':'https://she.example'}):
            status, result, _ = self.request('/api/reporting/qr', cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(result['url'], 'https://she.example/report')
        self.assertIn('<svg', result['svg'])
        self.assertIn('QR code to open Report to SHE', result['svg'])
        self.assertEqual(self.request('/report')[0], 200)
        self.assertEqual(self.request('/reporting-push/sw.js')[0], 200)
        with patch.dict(os.environ, {'SHE_PUBLIC_URL':'javascript:alert(1)'}):
            self.assertEqual(self.request('/api/reporting/qr', cookie=cookie)[0], 400)

    def test_website_alerts_remain_available_without_phone_dependency(self):
        cookie, csrf = self.account()
        with patch.object(alerts, 'webpush', None):
            result = self.request('/api/reporting/notifications', cookie=cookie)[1]
            self.assertFalse(result['push']['enabled'])
            self.assertEqual(self.request('/api/reporting/notifications/subscribe', 'POST', {}, cookie, csrf)[0], 503)
            self.assertEqual(self.request('/api/reporting/submit', 'POST', self.payload())[0], 201)
            self.assertEqual(self.request('/api/reporting/notifications', cookie=cookie)[1]['unread'], 1)

    @unittest.skipIf(alerts.webpush is None, 'Install requirements.txt to test Web Push')
    def test_push_keys_persist_subscriptions_validate_and_expired_devices_are_removed(self):
        cookie, csrf = self.account()
        config = self.request('/api/reporting/notifications', cookie=cookie)[1]['push']
        server.init_db()
        self.assertEqual(config, self.request('/api/reporting/notifications', cookie=cookie)[1]['push'])
        self.assertTrue(config['enabled'])
        subscription = self.subscription()
        endpoint = '/api/reporting/notifications/subscribe'
        for url in ('http://fcm.googleapis.com/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil.test/a', 'https://fcm.googleapis.com:8080/a'):
            self.assertEqual(self.request(endpoint, 'POST', {'subscription':{**subscription,'endpoint':url}}, cookie, csrf)[0], 400)
        self.assertEqual(self.request(endpoint, 'POST', {'subscription':subscription}, cookie, csrf)[0], 201)
        with patch.object(alerts, 'queue_report'):
            self.request('/api/reporting/submit', 'POST', self.payload())
        with patch.object(alerts, 'webpush') as send:
            alerts.send_report(str(server.DB_PATH), 1)
            self.assertEqual(send.call_count, 1)
            self.assertEqual(json.loads(send.call_args.kwargs['data'])['report_id'], 1)
            self.assertNotIn('Guest Person', send.call_args.kwargs['data'])
        failure = Exception('Expired')
        failure.response = SimpleNamespace(status_code=410)
        with patch.object(alerts, 'webpush', side_effect=failure):
            alerts.send_report(str(server.DB_PATH), 1)
        with server.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reporting_push_subscriptions').fetchone()[0], 0)
        self.request(endpoint, 'POST', {'subscription':subscription}, cookie, csrf)
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE username='admin'")
        with patch.object(alerts, 'webpush') as send:
            alerts.send_report(str(server.DB_PATH), 1)
            send.assert_not_called()

    @unittest.skipIf(alerts.webpush is None, 'Install requirements.txt to test Web Push')
    def test_real_push_encryption_without_sending_to_a_device(self):
        import requests
        cookie, csrf = self.account()
        self.request('/api/reporting/notifications', cookie=cookie)
        self.request('/api/reporting/notifications/subscribe', 'POST', {'subscription':self.subscription()}, cookie, csrf)
        with patch.object(alerts, 'queue_report'):
            self.request('/api/reporting/submit', 'POST', self.payload())
        response = requests.Response()
        response.status_code = 201
        with patch('requests.Session.request', return_value=response) as request:
            alerts.send_report(str(server.DB_PATH), 1)
        self.assertEqual(request.call_count, 1)
        self.assertEqual(request.call_args.kwargs['headers']['content-encoding'], 'aes128gcm')
        self.assertIn('vapid', request.call_args.kwargs['headers']['authorization'].lower())


if __name__ == '__main__':
    unittest.main()
