"""Per-executive unread reports and independent Web Push subscriptions."""
import base64
import json
import logging
import os
import re
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from urllib.parse import urlsplit

try:
    from pywebpush import webpush
except ImportError:
    webpush = None

WORKERS = ThreadPoolExecutor(max_workers=2, thread_name_prefix='she-report-push')
LOG = logging.getLogger(__name__)


def init(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS reporting_alert_reads (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            through_id INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS reporting_push_keys (
            id INTEGER PRIMARY KEY CHECK(id=1), private_key TEXT NOT NULL, public_key TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS reporting_push_subscriptions (
            endpoint TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subscription_json TEXT NOT NULL);
    ''')


def push_config(db):
    if webpush is None:
        return dict(enabled=False, publicKey='', reason='Phone alerts need the server push dependency installed. Website alerts are available.')
    row = db.execute('SELECT public_key FROM reporting_push_keys WHERE id=1').fetchone()
    if not row:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        key = ec.generate_private_key(ec.SECP256R1())
        private = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                    serialization.NoEncryption()).decode()
        public = base64.urlsafe_b64encode(key.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)).decode().rstrip('=')
        db.execute('INSERT OR IGNORE INTO reporting_push_keys VALUES(1,?,?)', (private, public))
        db.commit()
        row = db.execute('SELECT public_key FROM reporting_push_keys WHERE id=1').fetchone()
    return dict(enabled=True, publicKey=row['public_key'])


def get(h, db, user):
    if user['role'] not in ('admin', 'executive'):
        h.error_json(403, 'Executive access required.')
        return
    row = db.execute('SELECT through_id FROM reporting_alert_reads WHERE user_id=?', (user['id'],)).fetchone()
    through = row['through_id'] if row else 0
    latest = db.execute('SELECT COALESCE(MAX(id),0) FROM finding_reports').fetchone()[0]
    count = db.execute('SELECT COUNT(*) FROM finding_reports WHERE id>?', (through,)).fetchone()[0]
    reports = [dict(id=r['id'], reference=f"SHE-{r['id']:06d}", title=json.loads(r['snapshot_json'])['title'])
               for r in db.execute('SELECT id,snapshot_json FROM finding_reports WHERE id>? ORDER BY id DESC LIMIT 6', (through,))]
    h.send_json(200, dict(unread=count, latest_id=latest, reports=reports, push=push_config(db)))


def valid_subscription(value):
    if not isinstance(value, dict) or not isinstance(value.get('endpoint'), str):
        raise ValueError('Invalid phone notification subscription.')
    endpoint = value['endpoint']
    parsed = urlsplit(endpoint)
    host = parsed.hostname or ''
    allowed = (host == 'fcm.googleapis.com' or host == 'updates.push.services.mozilla.com' or
               host.endswith('.push.services.mozilla.com') or host == 'web.push.apple.com' or
               host.endswith('.notify.windows.com'))
    if (not allowed or parsed.scheme != 'https' or parsed.port not in (None, 443) or
            parsed.username or parsed.password or parsed.fragment or len(endpoint) > 4096):
        raise ValueError('Unsupported phone notification service.')
    keys = value.get('keys')
    if not isinstance(keys, dict):
        raise ValueError('Invalid phone notification keys.')
    for name, size in (('p256dh', 65), ('auth', 16)):
        encoded = keys.get(name, '')
        if not isinstance(encoded, str) or not re.fullmatch(r'[A-Za-z0-9_-]+={0,2}', encoded):
            raise ValueError('Invalid phone notification keys.')
        try:
            raw = base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4))
        except ValueError:
            raise ValueError('Invalid phone notification keys.')
        if len(raw) != size or (name == 'p256dh' and raw[0] != 4):
            raise ValueError('Invalid phone notification keys.')
    return dict(endpoint=endpoint, keys={name: keys[name] for name in ('p256dh', 'auth')})


def change(h, db, path, data, user):
    if path.endswith('/read'):
        through = data.get('through_id')
        latest = db.execute('SELECT COALESCE(MAX(id),0) FROM finding_reports').fetchone()[0]
        if type(through) is not int or not 0 <= through <= latest:
            raise ValueError('Choose a valid report notification.')
        db.execute('INSERT INTO reporting_alert_reads VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET through_id=MAX(through_id,excluded.through_id)', (user['id'], through))
        h.send_json(200, dict(ok=True))
    elif path.endswith('/unsubscribe'):
        endpoint = data.get('endpoint')
        if not isinstance(endpoint, str):
            raise ValueError('Invalid subscription.')
        db.execute('DELETE FROM reporting_push_subscriptions WHERE user_id=? AND endpoint=?', (user['id'], endpoint))
        h.send_json(200, dict(ok=True))
    else:
        if not push_config(db)['enabled']:
            h.error_json(503, 'Phone alerts are not configured on the server yet.')
            return
        subscription = valid_subscription(data.get('subscription'))
        db.execute('INSERT INTO reporting_push_subscriptions VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,subscription_json=excluded.subscription_json',
                   (subscription['endpoint'], user['id'], json.dumps(subscription)))
        h.send_json(201, dict(ok=True))


def queue_report(db, report_id):
    # Run after the durable report commit, outside the public submission response.
    if webpush is not None:
        path = db.execute('PRAGMA database_list').fetchone()[2]
        if path:
            WORKERS.submit(send_report, path, report_id)


def send_report(db_path, report_id):
    try:
        with closing(sqlite3.connect(db_path, timeout=15)) as db:
            db.row_factory = sqlite3.Row
            row = db.execute('SELECT private_key FROM reporting_push_keys WHERE id=1').fetchone()
            if not row or not db.execute('SELECT 1 FROM finding_reports WHERE id=?', (report_id,)).fetchone():
                return
            from py_vapid import Vapid
            private = Vapid.from_pem(row['private_key'].encode())
            subscriptions = db.execute("SELECT s.* FROM reporting_push_subscriptions s JOIN users u ON u.id=s.user_id WHERE u.active=1 AND u.role IN ('admin','executive')").fetchall()
            payload = json.dumps(dict(title='New Report to SHE', body=f'SHE-{report_id:06d} received. Open the SHE inbox to review.',
                                      tag=f'she-report-{report_id}', report_id=report_id))
            for item in subscriptions:
                try:
                    # Re-check the recipient immediately before delivering.
                    if not db.execute("SELECT 1 FROM users WHERE id=? AND active=1 AND role IN ('admin','executive')", (item['user_id'],)).fetchone():
                        continue
                    webpush(subscription_info=json.loads(item['subscription_json']), data=payload,
                            vapid_private_key=private, vapid_claims={'sub': os.environ.get('SHE_PUSH_SUBJECT') or os.environ.get('SHE_PUBLIC_URL', 'https://she.sugidigital.org')},
                            ttl=86400, timeout=10)
                except Exception as error:
                    response = getattr(error, 'response', None)
                    if response is not None and response.status_code in (404, 410):
                        db.execute('DELETE FROM reporting_push_subscriptions WHERE endpoint=? AND subscription_json=?', (item['endpoint'], item['subscription_json']))
                        db.commit()
                    else:
                        LOG.warning('SHE phone alert delivery failed for report %s; the report remains in the inbox.', report_id)
    except Exception:
        LOG.exception('SHE phone alert dispatch failed for report %s.', report_id)
