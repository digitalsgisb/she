"""Public SHE reporting, versioned forms and Executive follow-up."""
import base64
import hashlib
import hmac
import json
import logging
import re
import secrets
import sqlite3
import time
import she_statistics
import she_monitoring
import reporting_alerts
from threading import Lock

from cmms_bridge import bridge, CmmsError

TOKEN_SECRET = secrets.token_bytes(32)
RATE_LOCK = Lock()
ATTEMPTS = {}
GROUPS = ('environment', 'hiyari-hatto', 'kaizen', 'air-leak')
STATUSES = ('open', 'in_progress', 'resolved', 'closed')
LOG = logging.getLogger(__name__)


def init(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS reporting_forms (
            id INTEGER PRIMARY KEY, definition_json TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS finding_reports (
            id INTEGER PRIMARY KEY, request_key TEXT UNIQUE NOT NULL,
            request_hash TEXT NOT NULL, user_id INTEGER REFERENCES users(id),
            snapshot_json TEXT NOT NULL, answers_json TEXT NOT NULL,
            reporter TEXT NOT NULL, contact TEXT NOT NULL, plant TEXT NOT NULL,
            location TEXT NOT NULL, photos_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open', revision INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL, order_state TEXT NOT NULL DEFAULT 'none',
            order_id TEXT NOT NULL DEFAULT '', order_error TEXT NOT NULL DEFAULT '');
        CREATE TABLE IF NOT EXISTS finding_updates (
            id INTEGER PRIMARY KEY, report_id INTEGER NOT NULL REFERENCES finding_reports(id),
            actor TEXT NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS source_orders (
            id INTEGER PRIMARY KEY, source_kind TEXT NOT NULL, source_id INTEGER NOT NULL,
            snapshot_json TEXT NOT NULL, answers_json TEXT NOT NULL, reporter TEXT NOT NULL,
            contact TEXT NOT NULL DEFAULT '', plant TEXT NOT NULL, location TEXT NOT NULL,
            photos_json TEXT NOT NULL, order_state TEXT NOT NULL DEFAULT 'pending',
            order_id TEXT NOT NULL DEFAULT '', order_error TEXT NOT NULL DEFAULT '',
            UNIQUE(source_kind,source_id));
        CREATE TABLE IF NOT EXISTS source_order_photos (
            report_id INTEGER PRIMARY KEY REFERENCES source_orders(id),
            state TEXT NOT NULL DEFAULT 'pending', uploaded_json TEXT NOT NULL DEFAULT '[]',
            error TEXT NOT NULL DEFAULT '', started_at INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS finding_order_photos (
            report_id INTEGER PRIMARY KEY REFERENCES finding_reports(id),
            state TEXT NOT NULL DEFAULT 'pending', uploaded_json TEXT NOT NULL DEFAULT '[]',
            error TEXT NOT NULL DEFAULT '', started_at INTEGER NOT NULL DEFAULT 0);
    ''')
    # Seed once only: deleted forms must never reappear after restart.
    if db.execute('SELECT 1 FROM reporting_forms LIMIT 1').fetchone():
        return
    topics = [
        ('Water leakage', 'Kebocoran paip air', 'water', 'kaizen'),
        ('Oil / chemical spillage', 'Tumpahan minyak / bahan kimia', 'spill', 'she'),
        ('Improper waste disposal', 'Pembuangan sisa tidak betul', 'waste', 'she'),
        ('Waste segregation issue', 'Isu pengasingan sisa', 'recycle', 'she'),
        ('Drainage / discharge issue', 'Isu saliran / pelepasan', 'drain', 'she'),
        ('Equipment leakage', 'Kebocoran peralatan', 'tool', 'she'),
        ('Energy wastage', 'Pembaziran tenaga', 'energy', 'she'),
        ('Other environmental concerns', 'Lain-lain isu alam sekitar', 'leaf', 'she'),
        ('Hiyari Hatto', 'Report a near miss / laporkan kejadian nyaris', 'alert', 'she'),
        ('Kaizen idea', 'Suggest an improvement / cadangkan penambahbaikan', 'idea', 'she'),
    ]
    for i, (title, subtitle, symbol, workflow) in enumerate(topics, 1):
        definition = dict(title=title, description=subtitle, icon=symbol,
                          group='environment' if i <= 8 else GROUPS[i-8], workflow=workflow,
                          questions=[dict(id='description', label='What did you notice?', type='textarea', required=True, options=[]),
                                     dict(id='action', label='Any immediate action or suggestion?', type='textarea', required=False, options=[])])
        db.execute('INSERT INTO reporting_forms(id,definition_json) VALUES(?,?)', (i, json.dumps(definition)))


def init_air_leak(db):
    db.execute('CREATE TABLE IF NOT EXISTS reporting_migrations (name TEXT PRIMARY KEY)')
    if db.execute("SELECT 1 FROM reporting_migrations WHERE name='air-leak-v1'").fetchone():
        return
    form = dict(title='Air Leak', description='Report a compressed air leak and automatically issue a maintenance work order.',
                icon='tool', group='air-leak', workflow='maintenance', questions=[
                    dict(id='machine', label='Machine / Equipment', type='text', required=True, options=[]),
                    dict(id='description', label='Where is the leak and what did you notice?', type='textarea', required=True, options=[]),
                    dict(id='action', label='Immediate action taken', type='textarea', required=False, options=[])])
    db.execute('INSERT INTO reporting_forms(definition_json) VALUES(?)', (json.dumps(form),))
    db.execute("INSERT INTO reporting_migrations VALUES('air-leak-v1')")


def init_stagnant_water(db):
    db.execute('CREATE TABLE IF NOT EXISTS reporting_migrations (name TEXT PRIMARY KEY)')
    if db.execute("SELECT 1 FROM reporting_migrations WHERE name='stagnant-water-v1'").fetchone():
        return
    form = dict(title='Stagnant water (Air bertakung)', description='Laporkan air bertakung / report stagnant water, a potential mosquito breeding spot.',
                icon='drain', group='environment', workflow='she', questions=[
                    dict(id='description', label='Where exactly is the stagnant water and how big is it?', type='textarea', required=True, options=[]),
                    dict(id='duration', label='How long has it been there, if known?', type='text', required=False, options=[]),
                    dict(id='action', label='Any immediate action or suggestion?', type='textarea', required=False, options=[])])
    db.execute('INSERT INTO reporting_forms(definition_json) VALUES(?)', (json.dumps(form),))
    db.execute("INSERT INTO reporting_migrations VALUES('stagnant-water-v1')")


def token():
    value = f'{int(time.time())}:{secrets.token_hex(16)}'
    return value + ':' + hmac.new(TOKEN_SECRET, value.encode(), hashlib.sha256).hexdigest()


def valid_token(value):
    if not isinstance(value, str):
        return False
    try:
        timestamp, nonce, signature = value.split(':')
        age = time.time() - int(timestamp)
        expected = hmac.new(TOKEN_SECRET, f'{timestamp}:{nonce}'.encode(), hashlib.sha256).hexdigest()
        return 0 <= age < 7200 and hmac.compare_digest(expected, signature)
    except (ValueError, TypeError):
        return False


def text(value, maximum, required=False):
    if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
        raise ValueError('Please complete the required fields and keep answers within their limits.')
    return value.strip()


def definition(data):
    title = text(data.get('title'), 120, True)
    description = text(data.get('description', ''), 1000)
    if data.get('group') not in GROUPS or data.get('workflow') not in ('she', 'kaizen', 'maintenance'):
        raise ValueError('Choose a reporting area and workflow.')
    if data['group'] == 'air-leak' and data['workflow'] != 'maintenance':
        raise ValueError('Air Leak reports must issue maintenance work orders.')
    questions = data.get('questions')
    if not isinstance(questions, list) or not 1 <= len(questions) <= 30:
        raise ValueError('Add between 1 and 30 questions.')
    result, ids = [], set()
    for q in questions:
        if not isinstance(q, dict) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,60}', str(q.get('id', ''))):
            raise ValueError('Each question needs a valid ID.')
        if q['id'] in ids or q.get('type') not in ('text', 'textarea', 'select', 'number', 'date') or not isinstance(q.get('required'), bool):
            raise ValueError('Check question IDs, types and required settings.')
        if q['id'] in ('reporter', 'contact', 'plant', 'location', 'photos', 'title', 'group', 'workflow', 'icon', 'revision'):
            raise ValueError('This question ID is reserved for form details.')
        ids.add(q['id'])
        options = q.get('options', [])
        if not isinstance(options, list) or len(options) > 30:
            raise ValueError('Use up to 30 choices.')
        options = [text(o, 160, True) for o in options]
        if q['type'] == 'select' and (not options or len(set(options)) != len(options)):
            raise ValueError('Add unique choices for each choice question.')
        result.append(dict(id=q['id'], label=text(q.get('label'), 240, True), type=q['type'], required=q['required'], options=options))
    symbol = data.get('icon', 'leaf')
    if symbol not in ('water', 'spill', 'waste', 'recycle', 'drain', 'tool', 'energy', 'leaf', 'alert', 'idea'):
        symbol = 'leaf'
    return dict(title=title, description=description, group=data['group'], workflow=data['workflow'], icon=symbol, questions=result)


def forms(db):
    return [dict(id=r['id'], revision=r['revision'], **json.loads(r['definition_json'])) for r in db.execute('SELECT * FROM reporting_forms WHERE deleted=0 ORDER BY id')]


def order_tables(row):
    return ('source_orders', 'source_order_photos') if 'source_kind' in row.keys() else ('finding_reports', 'finding_order_photos')


def order_reference(row):
    if 'source_kind' in row.keys():
        return f"{'GENBA' if row['source_kind']=='red-tag' else 'PATROL'}-{row['source_id']:06d}"
    return f"SHE-{row['id']:06d}"


def receipt(row):
    return dict(reference=order_reference(row), order_state=row['order_state'], order_id=row['order_id'])


def issue_order(db, row):
    store, _ = order_tables(row)
    reference = order_reference(row)
    # Claim and commit before the remote call. Never retry an ambiguous response automatically.
    claimed = db.execute(f"UPDATE {store} SET order_state='sending',order_error='' WHERE id=? AND order_state IN ('pending','failed')", (row['id'],)).rowcount
    db.commit()
    if not claimed:
        return
    snapshot = json.loads(row['snapshot_json'])
    answers = json.loads(row['answers_json'])
    detail = '\n'.join(f"{q['label']}: {answers.get(q['id'], '')}" for q in snapshot['questions'])
    if snapshot['group'] == 'hiyari-hatto':
        detail = f"Reporter: {row['reporter']}\nContact / department: {row['contact'] or 'Not supplied'}\n{detail}"
    attempted = False
    try:
        actor = bridge.identity()
        attempted = True
        order = bridge.call('/api/work-orders', 'POST', dict(
            requesterId=actor['id'], type='maintenance' if snapshot['workflow'] == 'maintenance' else 'kaizen', priority='medium',
            responsibleDepartment='SHE', reportedByDepartment='SHE', reportedByName=row['reporter'],
            title=f"{reference} · {snapshot['title']}",
            issueDescription=f"{reference}\n{snapshot['title']}\nLocation: {row['location']}\n{detail}"[:5000],
            machineName=answers.get('machine', 'Others')[:100], area=row['location'][:100], location=row['location'][:100],
            issueCategoryName=snapshot['title'][:100]), row['plant'])
        if not isinstance(order, dict) or not order.get('id'):
            raise CmmsError(502, 'CMMS response did not include an order ID. Check CMMS before linking this report.')
        db.execute(f"UPDATE {store} SET order_state='issued',order_id=?,order_error='' WHERE id=?", (str(order['id']), row['id']))
    except CmmsError as error:
        state = 'failed' if not attempted or error.status in (400, 401, 403, 404, 409, 422, 503) else 'uncertain'
        db.execute(f'UPDATE {store} SET order_state=?,order_error=? WHERE id=?', (state, str(error), row['id']))
    except Exception:
        db.execute(f"UPDATE {store} SET order_state='uncertain',order_error='Check CMMS for this report reference before linking an order.' WHERE id=?", (row['id'],))
    db.commit()

    saved = db.execute(f'SELECT * FROM {store} WHERE id=?', (row['id'],)).fetchone()
    if saved['order_state'] == 'issued':
        sync_order_photos(db, saved)


def sync_order_photos(db, row):
    """Copy evidence to the existing order; never reissue it after an upload failure."""
    if row['order_state'] != 'issued' or not row['order_id']:
        raise ValueError('Link an issued work order before copying photos.')
    _, photo_store = order_tables(row)
    db.execute(f'INSERT OR IGNORE INTO {photo_store}(report_id) VALUES(?)', (row['id'],))
    now = int(time.time())
    claimed = db.execute(f"UPDATE {photo_store} SET state='sending',error='',started_at=? WHERE report_id=? AND state!='synced' AND (state!='sending' OR started_at<?)",
                         (now, row['id'], now - 300)).rowcount
    db.commit()
    if not claimed:
        return
    progress = db.execute(f'SELECT uploaded_json FROM {photo_store} WHERE report_id=?', (row['id'],)).fetchone()
    uploaded = set(json.loads(progress['uploaded_json']))
    try:
        actor = bridge.identity()
        order = bridge.she_order(row['order_id'], row['plant'])
        attachments = order.get('attachments')
        if not isinstance(attachments, list):
            raise ValueError('CMMS did not return its photo list. Retry copying photos.')
        for index, photo in enumerate(json.loads(row['photos_json'])):
            if index in uploaded:
                continue
            content = base64.b64decode(photo['content'], validate=True)
            digest = hashlib.sha256(content).hexdigest()[:16]
            extension = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp'}[photo['mime']]
            filename = f"{order_reference(row)}-photo-{index + 1}-{digest}.{extension}"
            # A timed-out upload may have succeeded remotely. Reconcile before retrying.
            if not any(a.get('originalName') == filename and a.get('kind') == 'issue' for a in attachments):
                content, mime, filename = cmms_photo(content, photo['mime'], filename)
                if not any(a.get('originalName') == filename and a.get('kind') == 'issue' for a in attachments):
                    bridge.upload_photo(row['order_id'], row['plant'], filename, mime, content, actor['id'], 'issue')
            uploaded.add(index)
            db.execute(f'UPDATE {photo_store} SET uploaded_json=? WHERE report_id=?', (json.dumps(sorted(uploaded)), row['id']))
            db.commit()
        db.execute(f"UPDATE {photo_store} SET state='synced',error='' WHERE report_id=?", (row['id'],))
    except Exception as error:
        message = str(error) if isinstance(error, (CmmsError, ValueError)) else 'Could not copy report photos. Retry copying photos to the existing work order.'
        db.execute(f"UPDATE {photo_store} SET state='failed',error=? WHERE report_id=?", (message, row['id']))
    db.commit()


def sync_pending_order_photos(database, stop=None):
    """Catch up old linked reports and retry failed/stalled photo transfers fairly."""
    for store, photo_store in (('finding_reports', 'finding_order_photos'), ('source_orders', 'source_order_photos')):
        with database() as db:
            ids = [r['id'] for r in db.execute(f'''SELECT r.id FROM {store} r
                LEFT JOIN {photo_store} p ON p.report_id=r.id
                WHERE r.order_state='issued' AND r.order_id!=''
                  AND (p.report_id IS NULL OR p.state='pending'
                       OR (p.state IN ('failed','sending') AND p.started_at<?))
                ORDER BY COALESCE(p.started_at,0),r.id LIMIT 20''', (int(time.time()) - 300,))]
        for report_id in ids:
            if stop is not None and stop.is_set():
                return
            with database() as db:
                row = db.execute(f'SELECT * FROM {store} WHERE id=?', (report_id,)).fetchone()
                if row and row['order_state'] == 'issued' and row['order_id']:
                    sync_order_photos(db, row)


def run_order_photo_sync(database, stop):
    """Run immediately at startup, then poll without delaying HTTP requests."""
    while not stop.is_set():
        try:
            if bridge.configured:
                sync_pending_order_photos(database, stop)
        except Exception:
            LOG.exception('Automatic CMMS report photo sync failed; it will retry.')
        if stop.wait(60):
            break


def cmms_photo(content, mime, filename):
    # CMMS accepts 8 MiB; retain the full original in SHE and resize only its copy.
    if len(content) <= 8 * 1024 * 1024:
        return content, mime, filename
    from io import BytesIO
    from PIL import Image, ImageOps
    with Image.open(BytesIO(content)) as image:
        image = ImageOps.exif_transpose(image).convert('RGB')
        image.thumbnail((2560, 2560))
        output = BytesIO()
        image.save(output, format='JPEG', quality=85)
    if output.tell() > 8 * 1024 * 1024:
        raise ValueError('Photo copy exceeds the CMMS size limit.')
    return output.getvalue(), 'image/jpeg', filename.rsplit('.', 1)[0] + '.jpg'


def get(h, db, path):
    if path == '/api/reporting/public':
        h.send_json(200, dict(forms=[f for f in forms(db) if f['group'] != 'air-leak'], token=token()))
        return
    session = h.authorize(db)
    if not session:
        return
    user = session[0]
    if path == '/api/reporting/notifications':
        reporting_alerts.get(h, db, user)
        return
    if path == '/api/reporting/qr':
        from redtag import finding_link, qr_svg
        try:
            url = finding_link(1).split('/#/red-tag/')[0] + '/report'
        except ValueError as error:
            h.error_json(400, str(error))
            return
        h.send_json(200, dict(url=url, svg=qr_svg(url).replace('open this red tag', 'open Report to SHE')))
        return
    if path == '/api/reporting/air-leak':
        form = next((f for f in forms(db) if f['group'] == 'air-leak'), None)
        rows = db.execute("SELECT * FROM finding_reports WHERE (user_id=? OR ? IN ('admin','executive')) ORDER BY id DESC LIMIT 500", (user['id'], user['role'])).fetchall()
        h.send_json(200, dict(form=form, token=token(), reports=[dict(**receipt(r), id=r['id'], status=r['status'], plant=r['plant'], location=r['location'], created_at=r['created_at']) for r in rows if json.loads(r['snapshot_json'])['group'] == 'air-leak']))
        return
    if path in ('/api/reporting/statistics','/api/reporting/statistics/records'):
        she_statistics.get(h, db, user, 'environment')
        return
    if path == '/api/reporting/forms' and user['role'] not in ('executive', 'admin'):
        h.error_json(403, 'Executive access required.')
        return
    if path == '/api/reporting/forms':
        h.send_json(200, dict(forms=forms(db)))
    elif path == '/api/reporting/reports':
        rows = db.execute('SELECT id,snapshot_json,reporter,plant,location,status,created_at,order_state,order_id,json_array_length(photos_json) AS photo_count FROM finding_reports ORDER BY id DESC LIMIT 500').fetchall()
        h.send_json(200, dict(reports=[dict(id=r['id'], **receipt(r), title=json.loads(r['snapshot_json'])['title'],
            group=json.loads(r['snapshot_json'])['group'], reporter=r['reporter'], plant=r['plant'], location=r['location'],
            status=r['status'], created_at=r['created_at'],thumbnail_url=f"/api/reporting/reports/{r['id']}/photos/0" if r['photo_count'] else '') for r in rows]))
    elif re.fullmatch(r'/api/reporting/reports/\d+/photos/[0-2]', path):
        row=db.execute('SELECT photos_json FROM finding_reports WHERE id=?',(int(path.split('/')[-3]),)).fetchone()
        photos=json.loads(row['photos_json']) if row else []
        index=int(path.split('/')[-1])
        if index>=len(photos):
            h.error_json(404,'Photo not found.')
            return
        photo=photos[index]
        content=base64.b64decode(photo['content'])
        h.send_response(200)
        h.send_header('Content-Type',photo['mime'])
        h.send_header('Content-Length',str(len(content)))
        h.send_header('Cache-Control','private, no-store')
        h.send_header('X-Content-Type-Options','nosniff')
        h.end_headers()
        h.wfile.write(content)
    elif re.fullmatch(r'/api/reporting/reports/\d+', path):
        row = db.execute('SELECT * FROM finding_reports WHERE id=?', (int(path.split('/')[-1]),)).fetchone()
        if not row:
            h.error_json(404, 'Report not found.')
            return
        result = dict(row)
        for key in ('request_key', 'request_hash'):
            result.pop(key)
        for key in ('snapshot', 'answers', 'photos'):
            result[key] = json.loads(result.pop(key + '_json'))
        result['updates'] = [dict(r) for r in db.execute('SELECT * FROM finding_updates WHERE report_id=? ORDER BY id', (row['id'],))]
        review = db.execute('SELECT payload_json FROM hiyari_reviews WHERE report_id=?', (row['id'],)).fetchone()
        result['hiyari_review'] = json.loads(review['payload_json']) if review else {}
        result.update(receipt(row))
        photo_sync = db.execute('SELECT state,error FROM finding_order_photos WHERE report_id=?', (row['id'],)).fetchone()
        result['order_photo_state'] = photo_sync['state'] if photo_sync else 'pending'
        result['order_photo_error'] = photo_sync['error'] if photo_sync else ''
        h.send_json(200, dict(report=result))
    else:
        h.error_json(404, 'Not found.')


def submit(h, db, data):
    if not valid_token(data.get('token')):
        h.error_json(403, 'This reporting session expired. Reload the page and try again.')
        return
    fingerprint = hashlib.sha256(json.dumps({k: v for k, v in data.items() if k != 'token'}, sort_keys=True).encode()).hexdigest()
    key = data.get('request_key')
    if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9-]{20,80}', key):
        raise ValueError('Invalid submission reference. Reload and try again.')
    previous = db.execute('SELECT * FROM finding_reports WHERE request_key=?', (key,)).fetchone()
    if previous:
        if json.loads(previous['snapshot_json'])['group'] == 'air-leak':
            session = h.authorize(db, csrf=True)
            if not session:
                return
            if previous['user_id'] != session[0]['id']:
                h.error_json(403, 'This report belongs to another account.')
                return
        if previous['request_hash'] != fingerprint:
            h.error_json(409, 'This submission reference was already used. Start a new report.')
        else:
            h.send_json(200, receipt(previous))
        return
    with RATE_LOCK:
        now = time.time()
        # Bound memory and discard expired windows.
        for ip in list(ATTEMPTS):
            ATTEMPTS[ip] = [v for v in ATTEMPTS[ip] if now-v < 600]
            if not ATTEMPTS[ip]:
                del ATTEMPTS[ip]
        ip = h.client_address[0]
        if len(ATTEMPTS.get(ip, [])) >= 300 or len(ATTEMPTS) >= 10000:
            h.error_json(429, 'Too many reports. Please try again in a few minutes.')
            return
        ATTEMPTS.setdefault(ip, []).append(now)
    if type(data.get('form_id')) is not int or type(data.get('revision')) is not int:
        raise ValueError('Choose a valid form.')
    row = db.execute('SELECT * FROM reporting_forms WHERE id=? AND deleted=0', (data.get('form_id'),)).fetchone()
    if not row or data.get('revision') != row['revision']:
        h.error_json(409, 'This form changed. Reload it before submitting.')
        return
    form = json.loads(row['definition_json'])
    if form['group'] == 'air-leak' and not h.authorize(db, csrf=True):
        return
    answers = data.get('answers')
    if not isinstance(answers, dict) or set(answers) - {q['id'] for q in form['questions']}:
        raise ValueError('Check the form answers.')
    clean = {}
    for q in form['questions']:
        value = text(answers.get(q['id'], ''), 2000, q['required'])
        if value and q['type'] == 'select' and value not in q['options']:
            raise ValueError('Choose one of the available answers.')
        if value and q['type'] == 'number' and not re.fullmatch(r'-?\d{1,12}(\.\d{1,8})?', value):
            raise ValueError('Enter a valid number.')
        if value and q['type'] == 'date':
            from datetime import date
            date.fromisoformat(value)
        clean[q['id']] = value
    reporter = text(data.get('reporter', ''), 80, True)
    contact = text(data.get('contact', ''), 160)
    location = text(data.get('location', ''), 240, True)
    plant = data.get('plant')
    if plant not in ('port-klang', 'sendayan'):
        raise ValueError('Choose a plant.')
    photos = data.get('photos', [])
    if not isinstance(photos, list) or not 1 <= len(photos) <= 3:
        raise ValueError('Attach at least one photo (up to three photos).')
    clean_photos = []
    for photo in photos:
        if not isinstance(photo, dict) or photo.get('mime') not in ('image/jpeg', 'image/png', 'image/webp'):
            raise ValueError('Use JPEG, PNG or WebP photos.')
        try:
            content = base64.b64decode(photo.get('content', ''), validate=True)
        except (ValueError, TypeError):
            raise ValueError('Invalid photo.')
        if not 1 <= len(content) <= 10_000_000:
            raise ValueError('Each photo must be 10 MB or smaller.')
        if not (content.startswith(b'\xff\xd8\xff') or content.startswith(b'\x89PNG\r\n\x1a\n') or (content[:4] == b'RIFF' and content[8:12] == b'WEBP')):
            raise ValueError('Invalid image file.')
        clean_photos.append(dict(name=text(photo.get('name', 'Photo'), 120), mime=photo['mime'], content=photo['content']))
    session = h.session(db)
    try:
        cursor = db.execute('INSERT INTO finding_reports(request_key,request_hash,user_id,snapshot_json,answers_json,reporter,contact,plant,location,photos_json,created_at,order_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
            (key, fingerprint, session[0]['id'] if session else None, json.dumps(form), json.dumps(clean), session[0]['display_name'] if form['group'] == 'air-leak' else reporter, contact, plant, location, json.dumps(clean_photos), int(time.time()), 'pending' if form['workflow'] in ('kaizen', 'maintenance') else 'none'))
        db.commit()
    except sqlite3.IntegrityError:
        previous = db.execute('SELECT * FROM finding_reports WHERE request_key=?', (key,)).fetchone()
        if not previous or previous['request_hash'] != fingerprint:
            h.error_json(409, 'Submission reference already used.')
        else:
            h.send_json(200, receipt(previous))
        return
    saved = db.execute('SELECT * FROM finding_reports WHERE id=?', (cursor.lastrowid,)).fetchone()
    reporting_alerts.queue_report(db, saved['id'])
    if saved['order_state'] == 'pending':
        issue_order(db, saved)
    saved = db.execute('SELECT * FROM finding_reports WHERE id=?', (saved['id'],)).fetchone()
    h.send_json(201, receipt(saved))


def change(h, db, path, method, data, user):
    if user['role'] not in ('executive', 'admin'):
        h.error_json(403, 'Executive access required.')
        return
    try:
        if method == 'POST' and path in ('/api/reporting/notifications/read', '/api/reporting/notifications/subscribe', '/api/reporting/notifications/unsubscribe'):
            reporting_alerts.change(h, db, path, data, user)
            return
        match = re.fullmatch(r'/api/reporting/forms/(\d+)(/delete)?', path)
        if path == '/api/reporting/forms' and method == 'POST':
            new = definition(data)
            cursor = db.execute('INSERT INTO reporting_forms(definition_json) VALUES(?)', (json.dumps(new),))
            db.commit()
            h.send_json(201, dict(id=cursor.lastrowid))
        elif match and ((method == 'PATCH' and not match[2]) or (method == 'POST' and match[2])):
            row = db.execute('SELECT * FROM reporting_forms WHERE id=? AND deleted=0', (int(match[1]),)).fetchone()
            if not row:
                h.error_json(404, 'Form not found.')
                return
            if data.get('revision') != row['revision']:
                h.error_json(409, 'Someone edited this form. Reload before saving.')
                return
            new = definition(data) if not match[2] else None
            changed = db.execute('UPDATE reporting_forms SET definition_json=?,deleted=?,revision=revision+1 WHERE id=? AND revision=?',
                (json.dumps(new) if new else row['definition_json'], int(bool(match[2])), row['id'], row['revision'])).rowcount
            db.commit()
            h.send_json(200 if changed else 409, dict(ok=True) if changed else dict(error='Form changed. Reload it.'))
        else:
            match = re.fullmatch(r'/api/reporting/reports/(\d+)/(updates|issue-order|retry-order|link-order|sync-order-photos|hiyari-review)', path)
            if not match or method != 'POST':
                h.error_json(404, 'Not found.')
                return
            row = db.execute('SELECT * FROM finding_reports WHERE id=?', (int(match[1]),)).fetchone()
            if not row:
                h.error_json(404, 'Report not found.')
                return
            if match[2] == 'sync-order-photos':
                sync_order_photos(db, row)
                h.send_json(200, dict(ok=True))
            elif match[2] == 'hiyari-review':
                changed = she_monitoring.save_review(db, row, data, user)
                h.send_json(200 if changed else 409, dict(ok=True) if changed else dict(error='Report changed. Reload before saving.'))
            elif match[2] == 'issue-order':
                if json.loads(row['snapshot_json'])['group'] not in GROUPS:
                    raise ValueError('This report does not support work orders.')
                claimed = db.execute("UPDATE finding_reports SET order_state='pending' WHERE id=? AND order_state='none'", (row['id'],)).rowcount
                if not claimed:
                    h.error_json(409, 'A work order has already been requested. Reload to view its status.')
                    return
                db.execute('INSERT INTO finding_updates(report_id,actor,note,status,created_at) VALUES(?,?,?,?,?)',
                           (row['id'], user['display_name'], 'Requested a CMMS work order from this report.', row['status'], int(time.time())))
                db.commit()
                issue_order(db, row)
                h.send_json(200, receipt(db.execute('SELECT * FROM finding_reports WHERE id=?', (row['id'],)).fetchone()))
            elif match[2] == 'retry-order':
                if row['order_state'] not in ('failed', 'pending'):
                    h.error_json(409, 'Check CMMS and link an existing order if its creation is uncertain.')
                    return
                issue_order(db, row)
                h.send_json(200, receipt(db.execute('SELECT * FROM finding_reports WHERE id=?', (row['id'],)).fetchone()))
            elif match[2] == 'link-order':
                order_id = text(data.get('order_id'), 100, True)
                if row['order_state'] not in ('uncertain', 'sending'):
                    h.error_json(409, 'Only an uncertain work order can be linked.')
                    return
                order = bridge.she_order(order_id, row['plant'])
                reference = f"SHE-{row['id']:06d}"
                expected_type = 'maintenance' if json.loads(row['snapshot_json'])['workflow'] == 'maintenance' else 'kaizen'
                if order.get('type') != expected_type or reference not in (order.get('title', '') + order.get('issueDescription', '')):
                    raise ValueError('Choose the SHE work order containing this report reference.')
                db.execute("UPDATE finding_reports SET order_id=?,order_state='issued',order_error='' WHERE id=? AND order_state IN ('uncertain','sending')", (order_id, row['id']))
                db.commit()
                sync_order_photos(db, db.execute('SELECT * FROM finding_reports WHERE id=?', (row['id'],)).fetchone())
                h.send_json(200, dict(ok=True))
            else:
                if json.loads(row['snapshot_json']).get('group')=='hiyari-hatto' and data.get('status') in ('resolved','closed'):
                    raise ValueError('Use the FR-SH-12 review to verify and close Hiyari Hatto reports.')
                note = text(data.get('note', ''), 2000, True)
                status = data.get('status')
                if status not in STATUSES:
                    raise ValueError('Choose a valid follow-up status.')
                changed = db.execute('UPDATE finding_reports SET status=?,revision=revision+1 WHERE id=? AND revision=?', (status, row['id'], data.get('revision'))).rowcount
                if not changed:
                    h.error_json(409, 'This report changed. Reload before updating.')
                    return
                db.execute('INSERT INTO finding_updates(report_id,actor,note,status,created_at) VALUES(?,?,?,?,?)', (row['id'], user['display_name'], note, status, int(time.time())))
                db.commit()
                h.send_json(200, dict(ok=True))
    except ValueError as error:
        h.error_json(400, str(error))
    except CmmsError as error:
        h.error_json(error.status, str(error))
