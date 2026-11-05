"""Work orders for Genba and patrol findings, using the shared CMMS recovery flow."""
import base64
import json
import re
import sqlite3
from datetime import datetime, timedelta, timezone
import access
import reporting
from cmms_bridge import bridge, CmmsError


def source(db, kind, source_id):
    table = {'red-tag': 'redtag_findings', 'patrol': 'patrols'}[kind]
    row = db.execute(f'SELECT * FROM {table} WHERE id=?', (source_id,)).fetchone()
    if not row or (kind == 'patrol' and not row['completed']):
        raise ValueError('Finding not found.')
    return row


def snapshot(db, kind, row, photo_dir, actor):
    photos = []
    if kind == 'red-tag':
        title = f"Genba / Red Tag {row['red_tag_id']}"
        answers = dict(reference=row['red_tag_id'], date=row['finding_date'], section=row['section'],
                       pic=row['pic'], machine=row['machine'], hazard=row['hazard'],
                       recommendation=row['recommendation'], rank=row['rank'], stop=row['type_of_stop'])
        reporter, location = row['issued_by'], row['section']
        if row['photo']:
            photos.append(dict(name='Before photo', mime=row['photo_mime'], content=base64.b64encode(row['photo']).decode()))
    else:
        template = json.loads(row['template_json'])
        title = template['title'] if template else 'Daily Safety Patrol'
        answers = dict(inspector=row['inspector_name'], remarks=row['remarks'])
        labels = {q['id']: q['label'] for q in template['questions']} if template else {}
        for key, value in json.loads(row['answers_json']).items():
            if value and value not in ('ok', 'na'):
                answers[labels.get(key, key.replace('_', ' '))] = value
        answers.update({f'Remark: {labels.get(key, key)}': value for key, value in json.loads(row['item_remarks_json']).items() if value})
        reporter, location = row['inspector_name'], title
        for photo in db.execute('SELECT * FROM patrol_attachments WHERE patrol_id=? AND update_id IS NULL ORDER BY created_at,id', (row['id'],)):
            if photo['mime_type'] not in ('image/jpeg', 'image/png', 'image/webp'):
                continue
            if photo['size'] > 30_000_000:
                raise ValueError('A patrol photo exceeds 30 MB. Use the SHE Work Orders page to attach a smaller copy.')
            content = (photo_dir / photo['id']).read_bytes()
            photos.append(dict(name=photo['filename'], mime=photo['mime_type'], content=base64.b64encode(content).decode()))
    answers['Work order requested by'] = actor['display_name']
    form = dict(title=title, group=kind, workflow='maintenance',
                questions=[dict(id=key, label=key.replace('_', ' ').capitalize()) for key in answers])
    return form, answers, photos, reporter, location


def status(db, kind, source_id):
    row = db.execute('SELECT * FROM source_orders WHERE source_kind=? AND source_id=?', (kind, source_id)).fetchone()
    if not row:
        return dict(order_state='none', order_id='', order_error='')
    photo = db.execute('SELECT state,error FROM source_order_photos WHERE report_id=?', (row['id'],)).fetchone()
    return dict(**reporting.receipt(row), plant=row['plant'], order_error=row['order_error'],
                order_photo_state=photo['state'] if photo else 'pending', order_photo_error=photo['error'] if photo else '')


def handle(h, db, path, method, data, user, photo_dir):
    if user['role'] not in ('admin', 'executive'):
        h.error_json(403, 'Executive access required.')
        return
    match = re.fullmatch(r'/api/finding-orders/(red-tag|patrol)/(\d+)(?:/(issue|retry|link|sync-photos))?', path)
    if not match or (method == 'GET') == bool(match[3]) or method not in ('GET', 'POST'):
        h.error_json(404, 'Not found.')
        return
    kind, source_id, action = match[1], int(match[2]), match[3]
    try:
        original = source(db, kind, source_id)
        if method == 'GET':
            h.send_json(200, status(db, kind, source_id))
            return
        row = db.execute('SELECT * FROM source_orders WHERE source_kind=? AND source_id=?', (kind, source_id)).fetchone()
        if action == 'issue':
            if row:
                h.error_json(409, 'A work order has already been requested. Reload to view its status.')
                return
            plant = data.get('plant')
            if plant not in ('port-klang', 'sendayan'):
                raise ValueError('Choose the plant for this finding.')
            form, answers, photos, reporter, location = snapshot(db, kind, original, photo_dir, user)
            try:
                cursor = db.execute('''INSERT INTO source_orders(source_kind,source_id,snapshot_json,answers_json,reporter,plant,location,photos_json)
                    VALUES(?,?,?,?,?,?,?,?)''', (kind, source_id, json.dumps(form), json.dumps(answers), reporter, plant, location, json.dumps(photos)))
                db.commit()
            except sqlite3.IntegrityError:
                db.rollback()
                h.error_json(409, 'A work order has already been requested. Reload to view its status.')
                return
            row = db.execute('SELECT * FROM source_orders WHERE id=?', (cursor.lastrowid,)).fetchone()
            reporting.issue_order(db, row)
        elif not row:
            raise ValueError('Request a work order first.')
        elif action == 'retry':
            if row['order_state'] not in ('pending', 'failed'):
                raise ValueError('Check CMMS and link the existing order if creation is uncertain.')
            reporting.issue_order(db, row)
        elif action == 'link':
            if row['order_state'] not in ('uncertain', 'sending'):
                raise ValueError('Only an uncertain work order can be linked.')
            order_id = reporting.text(data.get('order_id'), 100, True)
            order = bridge.she_order(order_id, row['plant'])
            if order.get('type') != 'maintenance' or reporting.order_reference(row) not in (order.get('title', '') + order.get('issueDescription', '')):
                raise ValueError('Choose the SHE work order containing this finding reference.')
            db.execute("UPDATE source_orders SET order_id=?,order_state='issued',order_error='' WHERE id=? AND order_state IN ('uncertain','sending')", (order_id, row['id']))
            db.commit()
            reporting.sync_order_photos(db, db.execute('SELECT * FROM source_orders WHERE id=?', (row['id'],)).fetchone())
        elif action == 'sync-photos':
            reporting.sync_order_photos(db, row)
        h.send_json(201 if action == 'issue' else 200, status(db, kind, source_id))
    except (ValueError, OSError) as error:
        h.error_json(400, str(error))
    except CmmsError as error:
        h.error_json(error.status, str(error))


def overview(h, db, user):
    if user['role'] not in ('admin', 'executive'):
        h.error_json(403, 'Executive access required.')
        return
    counts = dict(reports=db.execute("SELECT COUNT(*) FROM finding_reports WHERE status NOT IN ('resolved','closed')").fetchone()[0],
                  genba=db.execute("SELECT COUNT(*) FROM redtag_findings WHERE status NOT IN ('Resolved','Closed')").fetchone()[0],
                  patrols=db.execute("SELECT COUNT(*) FROM patrols WHERE completed=1 AND followup_status!='resolved'").fetchone()[0])
    recent = []
    for r in db.execute("SELECT id,snapshot_json,location,reporter,created_at FROM finding_reports WHERE status NOT IN ('resolved','closed') ORDER BY created_at DESC,id DESC LIMIT 5"):
        recent.append(dict(title=json.loads(r['snapshot_json'])['title'], detail=f"{r['location']} · {r['reporter']}", kind='Report', href=f"#/reporting-inbox/{r['id']}", created_at=r['created_at']))
    for r in db.execute("SELECT id,red_tag_id,section,hazard,created_at FROM redtag_findings WHERE status NOT IN ('Resolved','Closed') ORDER BY created_at DESC,id DESC LIMIT 5"):
        recent.append(dict(title=r['red_tag_id'], detail=f"{r['section']} · {r['hazard']}", kind='Genba', href=f"#/red-tag/{r['id']}", created_at=r['created_at']))
    for r in db.execute("SELECT id,inspector_name,remarks,created_at FROM patrols WHERE completed=1 AND followup_status!='resolved' ORDER BY created_at DESC,id DESC LIMIT 5"):
        recent.append(dict(title=f"Patrol #{r['id']}", detail=f"{r['inspector_name']} · {r['remarks'] or 'Follow up on this inspection'}", kind='Patrol', href=f"#/daily-safety-patrol/{r['id']}", created_at=r['created_at']))
    h.send_json(200, dict(counts=counts, recent=sorted(recent, key=lambda r: r['created_at'], reverse=True)[:5]))


def module_summary(h, db, kind, user):
    """Use the same record visibility as each source module; omit photo payloads."""
    today = int(datetime.now(timezone(timedelta(hours=8))).replace(hour=0, minute=0, second=0, microsecond=0).timestamp())
    if kind == 'red-tag':
        where, args = ('1=1', ()) if 'red-tag' in access.features(user) else ('assigned_user_id=?', (user['id'],))
        rows = db.execute('SELECT id,red_tag_id AS title,section AS detail,issued_by AS reporter,status,created_at FROM redtag_findings WHERE ' + where + ' ORDER BY created_at DESC,id DESC', args).fetchall()
    else:
        group = {'hiyari-hatto':'hiyari-hatto', 'air-leak':'air-leak'}.get(kind)
        if not group:
            h.error_json(404, 'Module not found.')
            return
        owner, args = ('', ()) if kind!='air-leak' or user['role'] in ('admin','executive') else (' AND user_id=?', (user['id'],))
        rows = db.execute('''SELECT id,json_extract(snapshot_json,'$.title') AS title,location AS detail,reporter,status,created_at
            FROM finding_reports WHERE json_extract(snapshot_json,'$.group')=?''' + owner + ' ORDER BY created_at DESC,id DESC', (group, *args)).fetchall()
    closed = {'resolved','closed'}
    counts = dict(active=sum(r['status'].lower() not in closed for r in rows),
                  today=sum(today<=r['created_at']<today+86400 for r in rows),
                  history=sum(r['status'].lower() in closed for r in rows),
                  review=sum(r['status'].lower()=='action taken · awaiting review' for r in rows))
    recent=[]
    for r in rows[:5]:
        status=r['status'].lower().replace(' ', '_')
        if status not in ('open','in_progress','resolved','closed'):
            status='action_taken'
        recent.append(dict(id=r['id'], title=r['title'], detail=r['detail'], reporter=r['reporter'], status=status,
                           status_label=r['status'].replace('_',' '), created_at=r['created_at'],
                           href=f"#/red-tag/{r['id']}" if kind=='red-tag' else f"#/reporting-inbox/{r['id']}"))
    h.send_json(200, dict(counts=counts,recent=recent))
