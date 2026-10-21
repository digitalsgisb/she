"""Safety committee genba findings, master data, evidence and printing."""
import base64
import binascii
import csv
import html
import hashlib
import access
import she_statistics
import io
import json
import os
import re
import time
from datetime import date, datetime, timezone, timedelta
from urllib.parse import parse_qs, urlsplit
from qrcodegen import QrCode

TZ = timezone(timedelta(hours=8))
DEFAULT_SECTIONS = [
    ('FG Store', ['Fareez', 'Shahrul', 'Chandran']),
    ('Mould/Jig Storage', ['Radzi']), ('Mini Forming', ['Abu', 'Nagen']),
    ('Floor Carpet', ['Abu', 'Nagen']), ('Roll Making', ['Jafri', 'MD Fauzi']),
    ('Raw Material Store', ['Yusof', 'Kamrul']), ('Maintenance', ['Shahmy']),
    ('Mould Maker', ['Syukry']), ('Luggage Mat', ['Rohaidzat', 'Azhar']), ('Macro', ['Aman'])]
STATUSES = ('Open', 'In progress', 'Action taken · awaiting review', 'Resolved', 'Closed')

def init(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS redtag_settings (
            id INTEGER PRIMARY KEY CHECK(id=1), sections_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS redtag_findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, red_tag_id TEXT UNIQUE NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id), finding_date TEXT NOT NULL,
            section TEXT NOT NULL, pic TEXT NOT NULL, machine TEXT NOT NULL, hazard TEXT NOT NULL,
            type_of_stop TEXT NOT NULL, rank TEXT NOT NULL, recommendation TEXT NOT NULL,
            status TEXT NOT NULL, issued_by TEXT NOT NULL, photo BLOB NOT NULL, photo_mime TEXT NOT NULL,
            request_key TEXT UNIQUE NOT NULL, request_json TEXT NOT NULL,
            revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
            printed_at INTEGER, printed_by TEXT);
        CREATE INDEX IF NOT EXISTS redtag_date ON redtag_findings(finding_date,id);
        CREATE TABLE IF NOT EXISTS redtag_deletions (
            finding_id INTEGER PRIMARY KEY, red_tag_id TEXT UNIQUE NOT NULL,
            request_key TEXT UNIQUE NOT NULL, deleted_by INTEGER NOT NULL REFERENCES users(id),
            deleted_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS redtag_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT, finding_id INTEGER NOT NULL REFERENCES redtag_findings(id),
            actor TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL, created_at INTEGER NOT NULL);
    ''')
    db.execute('''CREATE TABLE IF NOT EXISTS redtag_pic_accounts (
        section TEXT NOT NULL, pic TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id),
        PRIMARY KEY(section,pic))''')
    for table, column, definition in [('redtag_findings', 'assigned_user_id', 'INTEGER REFERENCES users(id)'),
                                      ('redtag_updates', 'after_photo', 'BLOB'), ('redtag_updates', 'after_mime', 'TEXT')]:
        if column not in {row['name'] for row in db.execute('PRAGMA table_info(' + table + ')')}:
            db.execute('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + definition)
    db.execute('INSERT OR IGNORE INTO redtag_settings(id,sections_json) VALUES(1,?)',
               (json.dumps([dict(name=n, pics=p) for n, p in DEFAULT_SECTIONS]),))

def date_key(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ValueError('Choose a valid finding date.')
    date.fromisoformat(value)
    return value

def settings(db, user=None):
    row = db.execute('SELECT * FROM redtag_settings WHERE id=1').fetchone()
    result = dict(sections=json.loads(row['sections_json']), revision=row['revision'],
                  assignments=[dict(r) for r in db.execute('SELECT * FROM redtag_pic_accounts')])
    if user and user['role'] in ('admin', 'executive'):
        result['accounts'] = [dict(id=u['id'], name=u['display_name'], username=u['username']) for u in db.execute('SELECT * FROM users WHERE active=1')
                              if set(access.features(u)) & {'red-tag', 'red-tag-pic'}]
    return result

def finding(row):
    return {k: row[k] for k in row.keys() if k not in ('photo', 'photo_mime', 'request_key', 'request_json')}

def send_bytes(h, content, mime, filename=None):
    h.send_response(200)
    h.send_header('Content-Type', mime)
    h.send_header('Content-Length', str(len(content)))
    h.send_header('Cache-Control', 'no-store')
    if filename:
        h.send_header('Content-Disposition', 'attachment; filename="' + filename + '"')
    h.security_headers()
    h.end_headers()
    h.wfile.write(content)

def can_view(row, user):
    return 'red-tag' in access.features(user) or row['assigned_user_id'] == user['id']

def get(h, db, path, user):
    try:
        if path in ('/api/red-tags/statistics','/api/red-tags/statistics/records'):
            she_statistics.get(h, db, user, 'red-tag')
            return
        if path == '/api/red-tags/settings':
            h.send_json(200, settings(db, user))
            return
        action_photo = re.fullmatch(r'/api/red-tags/(\d+)/updates/(\d+)/photo', path)
        if action_photo:
            parent = db.execute('SELECT * FROM redtag_findings WHERE id=?', (int(action_photo[1]),)).fetchone()
            photo = db.execute('SELECT after_photo,after_mime FROM redtag_updates WHERE id=? AND finding_id=?',
                               (int(action_photo[2]), int(action_photo[1]))).fetchone()
            if not parent or not can_view(parent, user) or not photo or not photo['after_photo']:
                h.error_json(404, 'Photo not found.')
            else:
                send_bytes(h, photo['after_photo'], photo['after_mime'])
            return
        match = re.fullmatch(r'/api/red-tags/(\d+)(/photo)?', path)
        if match:
            row = db.execute('SELECT * FROM redtag_findings WHERE id=?', (int(match[1]),)).fetchone()
            if not row or not can_view(row, user):
                h.error_json(404, 'Finding not found.')
            elif match[2]:
                send_bytes(h, row['photo'], row['photo_mime'])
            else:
                h.send_json(200, dict(finding=finding(row), updates=[dict(r) for r in db.execute(
                    'SELECT id,finding_id,actor,status,note,created_at,(after_photo IS NOT NULL) AS has_after_photo FROM redtag_updates WHERE finding_id=? ORDER BY id', (row['id'],))]))
            return
        if path not in ('/api/red-tags', '/api/red-tags/print', '/api/red-tags/export'):
            h.error_json(404, 'Not found.')
            return
        query = parse_qs(urlsplit(h.path).query)
        day = date_key(query.get('date', [datetime.now(TZ).date().isoformat()])[0])
        if query.get('inbox') == ['1'] and path == '/api/red-tags':
            rows = db.execute("SELECT * FROM redtag_findings WHERE assigned_user_id=? ORDER BY CASE WHEN status IN ('Resolved','Closed') THEN 1 ELSE 0 END, finding_date DESC,id DESC LIMIT 500", (user['id'],)).fetchall()
        else:
            rows = db.execute('SELECT * FROM redtag_findings WHERE finding_date=? ORDER BY id', (day,)).fetchall()
        rows = [row for row in rows if can_view(row, user)]
        if path.endswith('/print'):
            send_bytes(h, print_html(rows, day).encode(), 'text/html; charset=utf-8')
        elif path.endswith('/export'):
            output = io.StringIO(newline='')
            writer = csv.writer(output)
            writer.writerow(['Record Key', 'Red Tag ID', 'Date Open', 'Section', 'Machine / Equip',
                             'Hazard Identified', 'Before Picture', 'Type of Stop', 'Rank',
                             'Recommendation', 'PIC', 'Status', 'Issue By', 'Printed?', 'Printed Date', 'Printed By'])
            for r in rows:
                values = [str(r['id']), r['red_tag_id'], r['finding_date'], r['section'], r['machine'],
                          r['hazard'], '', r['type_of_stop'], r['rank'], r['recommendation'], r['pic'],
                          r['status'], r['issued_by'], bool(r['printed_at']),
                          datetime.fromtimestamp(r['printed_at'], TZ).isoformat() if r['printed_at'] else '', r['printed_by'] or '']
                # Prevent uploaded/user-entered text from becoming spreadsheet formulas.
                writer.writerow(["'" + str(v) if str(v).lstrip().startswith(('=', '+', '-', '@')) else v for v in values])
            send_bytes(h, ('\ufeff' + output.getvalue()).encode('utf-8'), 'text/csv; charset=utf-8', 'genba-' + day + '.csv')
        else:
            h.send_json(200, dict(date=day, findings=[finding(r) for r in rows]))
    except ValueError as error:
        h.error_json(400, str(error))

def change(h, db, path, method, data, user):
    try:
        match = re.fullmatch(r'/api/red-tags/(\d+)', path)
        if method == 'DELETE' and match:
            if user['role'] not in ('admin', 'executive'):
                h.error_json(403, 'Only Executives and Administrators can delete red tags.')
                return
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM redtag_findings WHERE id=?', (int(match[1]),)).fetchone()
            if not row:
                h.error_json(404, 'Finding not found.')
                return
            if type(data.get('revision')) is not int or data['revision'] != row['revision']:
                h.error_json(409, 'This finding changed. Reload it before deleting.')
                return
            db.execute('INSERT INTO redtag_deletions(finding_id,red_tag_id,request_key,deleted_by,deleted_at) VALUES(?,?,?,?,?)',
                       (row['id'], row['red_tag_id'], row['request_key'], user['id'], int(time.time())))
            db.execute('DELETE FROM redtag_updates WHERE finding_id=?', (row['id'],))
            db.execute('DELETE FROM redtag_findings WHERE id=?', (row['id'],))
            db.commit()
            h.send_json(200, dict(ok=True))
            return
        if path == '/api/red-tags/settings' and method == 'PATCH':
            if user['role'] not in ('admin', 'executive'):
                h.error_json(403, 'Executive or Admin access required.')
                return
            sections = data.get('sections')
            if not isinstance(sections, list) or not 1 <= len(sections) <= 100:
                raise ValueError('Keep between 1 and 100 sections.')
            clean, names = [], set()
            for section in sections:
                if not isinstance(section, dict): raise ValueError('Invalid section.')
                name, pics = section.get('name'), section.get('pics')
                if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100 or name.strip().casefold() in names:
                    raise ValueError('Sections need unique names of up to 100 characters.')
                if not isinstance(pics, list) or not 1 <= len(pics) <= 30 or any(not isinstance(p, str) or not 1 <= len(p.strip()) <= 80 for p in pics):
                    raise ValueError('Each section needs 1–30 PIC names of up to 80 characters.')
                if len({p.strip().casefold() for p in pics}) != len(pics): raise ValueError('Remove duplicate PIC names.')
                names.add(name.strip().casefold())
                clean.append(dict(name=name.strip(), pics=[p.strip() for p in pics]))
            if type(data.get('revision')) is not int: raise ValueError('Provide the section list revision.')
            assignments = data.get('assignments', [])
            valid_pairs = {(s['name'], p) for s in clean for p in s['pics']}
            seen = set()
            if not isinstance(assignments, list) or len(assignments) > 3000: raise ValueError('Invalid PIC account assignments.')
            for assignment in assignments:
                if not isinstance(assignment, dict): raise ValueError('Invalid PIC account assignment.')
                pair = (assignment.get('section'), assignment.get('pic'))
                account_id = assignment.get('user_id')
                if not all(isinstance(x, str) for x in pair) or pair not in valid_pairs or pair in seen or type(account_id) is not int:
                    raise ValueError('Assign each listed PIC to at most one account.')
                account = db.execute('SELECT * FROM users WHERE id=? AND active=1', (account_id,)).fetchone()
                if not account or not set(access.features(account)) & {'red-tag', 'red-tag-pic'}:
                    raise ValueError('Assigned accounts need Red Tag or PIC action access and must be active.')
                seen.add(pair)
            cursor = db.execute('UPDATE redtag_settings SET sections_json=?,revision=revision+1 WHERE id=1 AND revision=?',
                                (json.dumps(clean), data['revision']))
            if cursor.rowcount != 1:
                h.error_json(409, 'Another device changed the section list. Reload before saving.')
                return
            db.execute('DELETE FROM redtag_pic_accounts')
            for assignment in assignments:
                db.execute('INSERT INTO redtag_pic_accounts(section,pic,user_id) VALUES(?,?,?)',
                           (assignment['section'], assignment['pic'], assignment['user_id']))
            for section, pic in valid_pairs:
                account_id = next((a['user_id'] for a in assignments if (a['section'], a['pic']) == (section, pic)), None)
                db.execute("UPDATE redtag_findings SET assigned_user_id=?,revision=revision+1 WHERE section=? AND pic=? AND status NOT IN ('Resolved','Closed') AND assigned_user_id IS NOT ?",
                           (account_id, section, pic, account_id))
            db.commit()
            h.send_json(200, settings(db, user))
            return
        if path == '/api/red-tags' and method == 'POST':
            if 'red-tag' not in access.features(user):
                h.error_json(403, 'Genba finding access is required to create findings.')
                return
            create(h, db, data, user)
            return
        if path == '/api/red-tags/printed' and method == 'POST':
            ids = data.get('ids')
            if not isinstance(ids, list) or not 1 <= len(ids) <= 1000 or any(type(x) is not int or x < 1 for x in ids):
                raise ValueError('Select valid findings to confirm printed.')
            for key in set(ids):
                row = db.execute('SELECT * FROM redtag_findings WHERE id=?', (key,)).fetchone()
                if not row or not can_view(row, user):
                    h.error_json(404, 'Finding not found.')
                    return
            for key in set(ids):
                db.execute('UPDATE redtag_findings SET printed_at=?,printed_by=? WHERE id=?', (int(time.time()), user['display_name'], key))
            db.commit()
            h.send_json(200, dict(ok=True))
            return
        match = re.fullmatch(r'/api/red-tags/(\d+)', path)
        if method == 'PATCH' and match:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM redtag_findings WHERE id=?', (int(match[1]),)).fetchone()
            if not row or not can_view(row, user):
                h.error_json(404, 'Finding not found.')
                return
            if user['role'] not in ('admin', 'executive') and row['user_id'] != user['id'] and row['assigned_user_id'] != user['id']:
                h.error_json(403, 'You can update your own or assigned findings. Executives and Admins can update all findings.')
                return
            status, note = data.get('status'), data.get('note', '')
            if status not in STATUSES or not isinstance(note, str) or not 1 <= len(note.strip()) <= 2000:
                raise ValueError('Choose a valid status and add an action note of up to 2,000 characters.')
            if status in ('Resolved', 'Closed') and user['role'] not in ('admin', 'executive'):
                h.error_json(403, 'An Executive or Admin must verify resolved or closed findings.')
                return
            if type(data.get('revision')) is not int or data['revision'] != row['revision']:
                h.error_json(409, 'This finding changed. Reopen it before updating.')
                return
            raw, mime = (None, None)
            if data.get('after_photo'):
                raw, mime = decode_photo(data['after_photo'])
            if status == 'Action taken · awaiting review' and not raw:
                raise ValueError('Upload an after picture when submitting an action for review.')
            db.execute('UPDATE redtag_findings SET status=?,revision=revision+1 WHERE id=?', (status, row['id']))
            db.execute('INSERT INTO redtag_updates(finding_id,actor,status,note,created_at,after_photo,after_mime) VALUES(?,?,?,?,?,?,?)',
                       (row['id'], user['display_name'], status, note.strip(), int(time.time()), raw, mime))
            db.commit()
            h.send_json(200, dict(ok=True))
            return
        h.error_json(404, 'Not found.')
    except (ValueError, TypeError, binascii.Error) as error:
        h.error_json(400, str(error))

def create(h, db, data, user):
    request_key = data.get('request_key')
    if not isinstance(request_key, str) or not re.fullmatch(r'[a-zA-Z0-9-]{16,80}', request_key):
        raise ValueError('Provide a submission reference.')
    signature = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    db.execute('BEGIN IMMEDIATE')
    previous = db.execute('SELECT * FROM redtag_findings WHERE request_key=?', (request_key,)).fetchone()
    if previous:
        if previous['user_id'] != user['id'] or previous['request_json'] != signature:
            h.error_json(409, 'Submission reference already used. Start a new finding.')
        else:
            h.send_json(200, dict(finding=finding(previous)))
        return
    if db.execute('SELECT 1 FROM redtag_deletions WHERE request_key=?', (request_key,)).fetchone():
        h.error_json(409, 'This finding was deleted. Start a new finding.')
        return
    day = date_key(data.get('finding_date'))
    clean = {}
    for key, maximum in [('section', 100), ('pic', 80), ('machine', 200), ('hazard', 4000),
                         ('type_of_stop', 100), ('rank', 100), ('recommendation', 4000)]:
        value = data.get(key)
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum:
            raise ValueError('Fill in ' + key.replace('_', ' ') + ' (up to ' + str(maximum) + ' characters).')
        clean[key] = value.strip()
    config = settings(db)
    if data.get('settings_revision') != config['revision']:
        h.error_json(409, 'The section/PIC list changed. Reload the form before submitting.')
        return
    if not any(s['name'] == clean['section'] and clean['pic'] in s['pics'] for s in config['sections']):
        raise ValueError('Select a current section and its PIC.')
    status = data.get('status', 'Open')
    if status not in STATUSES: raise ValueError('Choose a valid status.')
    if status in ('Resolved', 'Closed') and user['role'] not in ('admin', 'executive'):
        h.error_json(403, 'Executive verification is required for resolved or closed findings.')
        return
    raw, mime = decode_photo(data.get('photo'))
    # The unique ID is allocated inside the same transaction as the finding.
    period = day[2:7].replace('-', '')
    prefix = 'RT' + period + '-'
    existing = db.execute('SELECT red_tag_id FROM redtag_findings WHERE red_tag_id LIKE ? UNION SELECT red_tag_id FROM redtag_deletions WHERE red_tag_id LIKE ?', (prefix + '%', prefix + '%')).fetchall()
    number = max([int(r[0].split('-')[-1]) for r in existing] or [0]) + 1
    tag = prefix + str(number).zfill(3)
    cursor = db.execute('''INSERT INTO redtag_findings(red_tag_id,user_id,finding_date,section,pic,machine,hazard,
        type_of_stop,rank,recommendation,status,issued_by,photo,photo_mime,request_key,request_json,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
        (tag, user['id'], day, clean['section'], clean['pic'], clean['machine'], clean['hazard'],
         clean['type_of_stop'], clean['rank'], clean['recommendation'], status, user['display_name'], raw, mime,
         request_key, signature, int(time.time())))
    assigned = db.execute('SELECT user_id FROM redtag_pic_accounts WHERE section=? AND pic=?', (clean['section'], clean['pic'])).fetchone()
    db.execute('UPDATE redtag_findings SET assigned_user_id=? WHERE id=?', (assigned['user_id'] if assigned else None, cursor.lastrowid))
    db.commit()
    h.send_json(201, dict(finding=finding(db.execute('SELECT * FROM redtag_findings WHERE id=?', (cursor.lastrowid,)).fetchone())))

def finding_link(finding_id):
    base = os.environ.get('SHE_PUBLIC_URL', 'https://she.sugidigital.org').strip().rstrip('/')
    parsed = urlsplit(base)
    if (parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username or
            parsed.password or parsed.query or parsed.fragment or len(base) > 512):
        raise ValueError('Set SHE_PUBLIC_URL to the public SHE Digital address before printing.')
    return base + '/#/red-tag/' + str(int(finding_id))


def qr_svg(url):
    qr = QrCode.encode_text(url, QrCode.Ecc.MEDIUM)
    # Four blank modules on every side keep the code readable on printed cards.
    border = 4
    size = qr.get_size() + border * 2
    path = ''.join(f'M{x+border},{y+border}h1v1h-1z' for y in range(qr.get_size())
                   for x in range(qr.get_size()) if qr.get_module(x, y))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
            'shape-rendering="crispEdges" role="img" aria-label="QR code to open this red tag">'
            f'<rect width="{size}" height="{size}" fill="#fff"/><path d="{path}" fill="#000"/></svg>')


def print_html(rows, day):
    esc = lambda value: html.escape(str(value))
    cards = []
    for r in rows:
        url = finding_link(r['id'])
        fields = [('Area', r['section']), ('Equip', r['machine']), ('PIC', r['pic']),
                  ('Date', date.fromisoformat(r['finding_date']).strftime('%d/%m/%y')),
                  ('Status', r['status']), ('Type of stop', r['type_of_stop']), ('Rank', r['rank']),
                  ('Issue by', r['issued_by']), ('Physical RT', '________')]
        cards.append('<article class="genba-card"><header class="genba-print-header"><h2>RED TAG ATTACHMENT</h2><strong>' + esc(r['red_tag_id']) + '</strong></header>'
                     '<div class="genba-print-media"><img class="genba-photo" src="/api/red-tags/' + str(r['id']) + '/photo" alt="Before picture">'
                     '<div class="genba-print-side"><a class="genba-qr" href="' + esc(url) + '" aria-label="Open ' + esc(r['red_tag_id']) + '">' + qr_svg(url) + '</a>'
                     '<dl>' + ''.join('<div><dt>' + label + ':</dt><dd>' + esc(value) + '</dd></div>' for label, value in fields) + '</dl></div></div>'
                     '<div class="genba-print-notes"><p><strong>Issue:</strong> ' + esc(r['hazard']) + '</p><p><strong>Action:</strong> ' + esc(r['recommendation']) + '</p></div>'
                     '<footer class="genba-print-footer"><span>Staple to physical red tag</span><span>' + esc(r['red_tag_id']) + '</span></footer></article>')
    sheets = ['<section class="genba-print-sheet">' + ''.join(cards[start:start+6]) + '</section>'
              for start in range(0, len(cards), 6)]
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Safety genba · ' + esc(day) + '</title><link rel="stylesheet" href="/redtag.css?v=20261021-print-button1"></head><body class="genba-print">'
            '<div class="genba-print-toolbar"><div class="genba-print-toolbar-heading"><h1>Safety genba findings · ' + esc(day) + '</h1>'
            '<button id="genbaPrintButton" type="button"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6z"/><path d="M17 11h1"/></svg>Print / Save PDF</button></div><p>' + str(len(rows)) +
            ' finding(s). Print on A4 at 100% / actual size, with browser headers and footers turned off.</p></div>' +
            ''.join(sheets) + ('<p>No findings for this date.</p>' if not rows else '') + '<script src="/redtag-print.js?v=20261021-print1"></script></body></html>')


def decode_photo(photo):
    if not isinstance(photo, str): raise ValueError('Add a picture (JPEG, PNG or WebP, up to 2 MB).')
    match = re.fullmatch(r'data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)', photo)
    if not match: raise ValueError('Use a JPEG, PNG or WebP picture.')
    raw = base64.b64decode(match[2], validate=True)
    if not 1 <= len(raw) <= 2_000_000: raise ValueError('Picture must be at most 2 MB.')
    mime = match[1]
    valid = (mime == 'image/jpeg' and raw.startswith(b'\xff\xd8\xff') or
             mime == 'image/png' and raw.startswith(b'\x89PNG\r\n\x1a\n') or
             mime == 'image/webp' and raw[:4] == b'RIFF' and raw[8:12] == b'WEBP')
    if not valid: raise ValueError('The picture content does not match its file type.')
    return raw, mime
