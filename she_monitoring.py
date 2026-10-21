"""SHE's five monitoring dashboards and FR-SH-12 review data."""
import json
import re
import time
from collections import Counter
from datetime import date, datetime
from urllib.parse import parse_qs, urlsplit
import access
import she_statistics as stats

KINDS = {'accident': 'patrol', 'compound': 'reporting', 'environmental-findings': 'reporting', 'hiyari': 'reporting'}
SECTIONS = ['Store', 'Accessories', 'Office', 'Mini forming', 'Floor Carpet L1&L2',
            'Floor Carpet L3&L4', 'PE, Pattern, Latex', 'Needle Punch', 'Maintenance', 'Macro']
ENV_CATEGORIES = ['Spillage', 'Aedes Larvae', 'Stagnant Water (as potential mosquito breeding)', 'Others']


def question(key, label, kind='text', required=True, options=None):
    return dict(id=key, label=label, type=kind, required=required, options=options or [])


def hiyari_template():
    return dict(title='Hiyari Hatto', description='FR-SH-12 Rev 1 (06.02.2018). Bahagian A: Team Member. Bahagian B and C are completed by SHE after submission.',
                group='hiyari-hatto', icon='alert', workflow='she', questions=[
        question('employee_no', 'No. pekerja / Employee number'),
        question('shift', 'Shift', 'select', options=['A', 'B', 'N']),
        question('department', 'Jabatan / Department'), question('section', 'Bahagian / Section'),
        question('event_date', 'Tarikh / Date', 'date'),
        question('category', 'Status kategori / Category', 'select', options=['Suggestion', 'Near Miss', 'Observation']),
        question('operation', 'Jenis operasi / Operation', 'select', options=['Production', 'Preparation', 'Maintenance', 'Abnormal', 'Office work', 'Others']),
        question('experience', 'Pengalaman team member / Experience', 'select', options=['Less than 1 year', '1-3 years', 'More than 3 years']),
        question('description', 'Masalah / Problem', 'textarea'),
        question('consequence', 'Bahaya / akibat / Hazard and consequence', 'textarea'),
        question('action', 'Cadangan penambahbaikan / Proposed corrective action', 'textarea'),
        question('stop', 'STOP 6', 'select', options=['1', '2', '3', '4', '5', '6', 'Fire', 'Others']),
        question('sketch_before', 'Lakaran sebelum / Before sketch description (or attach photo)', 'textarea', False),
        question('sketch_after', 'Lakaran penambahbaikan / Improvement sketch description (or attach photo)', 'textarea', False)])


def init(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS she_monthly_records (
            kind TEXT NOT NULL, month TEXT NOT NULL, payload_json TEXT NOT NULL,
            revision INTEGER NOT NULL, actor TEXT NOT NULL, updated_at INTEGER NOT NULL,
            PRIMARY KEY(kind,month));
        CREATE TABLE IF NOT EXISTS she_monthly_history (
            id INTEGER PRIMARY KEY, kind TEXT NOT NULL, month TEXT NOT NULL,
            payload_json TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS hiyari_reviews (
            report_id INTEGER PRIMARY KEY REFERENCES finding_reports(id), payload_json TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS she_migrations (name TEXT PRIMARY KEY);
    ''')
    if not db.execute("SELECT 1 FROM she_migrations WHERE name='fr-sh-12-v1'").fetchone():
        original = db.execute('SELECT * FROM reporting_forms WHERE id=9 AND deleted=0').fetchone()
        definition = json.loads(original['definition_json']) if original else {}
        # Upgrade only the untouched legacy default; keep custom and deleted forms intact.
        legacy = definition.get('title') == 'Hiyari Hatto' and definition.get('questions') == [
            question('description', 'What did you notice?', 'textarea'),
            question('action', 'Any immediate action or suggestion?', 'textarea', False)]
        if legacy:
            db.execute('UPDATE reporting_forms SET definition_json=?,revision=revision+1 WHERE id=9', (json.dumps(hiyari_template()),))
        else:
            db.execute('INSERT INTO reporting_forms(definition_json) VALUES(?)', (json.dumps(hiyari_template()),))
        db.execute("INSERT INTO she_migrations VALUES('fr-sh-12-v1')")


def authorized(user, kind):
    return user['role'] == 'executive' and kind in KINDS


def clean_month(value):
    if not isinstance(value, str) or not re.fullmatch(r'20\d{2}-(0[1-9]|1[0-2])', value):
        raise ValueError('Choose a valid month.')
    return value


def count(value):
    if value is None or value == 'NA':
        return value
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 1000000:
        raise ValueError('Counts must be whole numbers from 0 to 1,000,000, blank, or NA.')
    return value


def clean_payload(kind, data):
    categories = SECTIONS if kind == 'accident' else ENV_CATEGORIES if kind == 'environmental-findings' else ['Compound']
    values = data.get('counts')
    if not isinstance(values, dict) or set(values) != set(categories):
        raise ValueError('Complete the counts for the listed categories.')
    result = dict(counts={k: count(values[k]) for k in categories})
    if kind == 'accident':
        result['off_job'] = count(data.get('off_job'))
        hours = data.get('man_hours')
        if hours is not None and (isinstance(hours, bool) or not isinstance(hours, (int, float)) or not 0 <= hours <= 1e9):
            raise ValueError('Enter valid man-hours.')
        result['man_hours'] = hours
    note = data.get('note', '')
    if not isinstance(note, str) or len(note) > 2000:
        raise ValueError('Notes must be under 2,000 characters.')
    result['note'] = note.strip()
    return result


def monthly(db, kind, year):
    rows = {r['month']: dict(r) for r in db.execute('SELECT * FROM she_monthly_records WHERE kind=? AND month LIKE ? ORDER BY month', (kind, str(year)+'-%'))}
    categories = SECTIONS if kind == 'accident' else ENV_CATEGORIES if kind == 'environmental-findings' else ['Compound']
    result = []
    for number in range(1, 13):
        month = f'{year}-{number:02d}'
        row = rows.get(month)
        payload = json.loads(row['payload_json']) if row else dict(counts={k: None for k in categories})
        values = list(payload['counts'].values())
        available = [v for v in values if isinstance(v, int)]
        total = sum(available) if available else None
        complete = len(available) == len(values)
        hours = payload.get('man_hours')
        result.append(dict(month=month, revision=row['revision'] if row else 0, payload=payload,
                           actor=row['actor'] if row else '', updated_at=row['updated_at'] if row else None,
                           total=total, complete=complete,
                           ifr=round(total*1000000/hours, 2) if kind=='accident' and complete and hours else None))
    return dict(kind=kind, year=year, categories=categories, months=result,
                total=sum(r['total'] or 0 for r in result), reported_months=sum(r['complete'] for r in result))


def hiyari(db, year):
    records = []
    for r in db.execute('SELECT r.*,v.payload_json AS review_json FROM finding_reports r LEFT JOIN hiyari_reviews v ON v.report_id=r.id ORDER BY r.id DESC'):
        snapshot, answers = json.loads(r['snapshot_json']), json.loads(r['answers_json'])
        if snapshot.get('group') != 'hiyari-hatto':
            continue
        date_value = answers.get('event_date') or datetime.fromtimestamp(r['created_at'], stats.TZ).date().isoformat()
        if not date_value.startswith(str(year)+'-'):
            continue
        review = json.loads(r['review_json']) if r['review_json'] else {}
        records.append(dict(id=r['id'], reference=f"SHE-{r['id']:06d}", date=date_value, reporter=r['reporter'],
                            location=r['location'], category=answers.get('category') or 'Unclassified',
                            section=answers.get('section') or 'Unspecified', rank=review.get('rank') or 'Unclassified',
                            stop=review.get('stop') or answers.get('stop') or 'Unclassified', status=r['status'],
                            pic=review.get('pic') or 'Unassigned', description=answers.get('description','')))
    done = sum(r['status'] in ('resolved', 'closed') for r in records)
    monthly_rows = []
    for number in range(1,13):
        items = [r for r in records if r['date'].startswith(f'{year}-{number:02d}')]
        closed = sum(r['status'] in ('resolved','closed') for r in items)
        monthly_rows.append(dict(month=f'{year}-{number:02d}', total=len(items), closed=closed, open=len(items)-closed))
    return dict(kind='hiyari', year=year, total=len(records), closed=done, open=len(records)-done,
                completion=round(done/len(records)*100,1) if records else None, months=monthly_rows,
                categories={field: dict(Counter(r[field] for r in records)) for field in ('category','rank','stop','section','pic')}, records=records)


def get(h, db, path, user):
    kind = path.rsplit('/',1)[-1]
    if not authorized(user, kind):
        h.error_json(403, 'Executive access and module permission required.'); return
    try:
        year = parse_qs(urlsplit(h.path).query).get('year', [str(datetime.now(stats.TZ).year)])[0]
        if not re.fullmatch(r'20\d{2}', year):
            raise ValueError('Choose a year from 2000 to 2099.')
        result = hiyari(db, int(year)) if kind=='hiyari' else monthly(db, kind, int(year))
        history = parse_qs(urlsplit(h.path).query).get('history', [''])[0]
        if history and kind!='hiyari':
            clean_month(history)
            result['history'] = [dict(actor=r['actor'], created_at=r['created_at'], payload=json.loads(r['payload_json']))
                                 for r in db.execute('SELECT * FROM she_monthly_history WHERE kind=? AND month=? ORDER BY id DESC', (kind,history))]
        h.send_json(200, result)
    except ValueError as error:
        h.error_json(400, str(error))


def change(h, db, path, method, data, user):
    kind = path.rsplit('/',1)[-1]
    if kind=='hiyari' or not authorized(user, kind):
        h.error_json(403, 'Executive access and module permission required.'); return
    try:
        if method != 'POST':
            h.error_json(405, 'Use POST to save monthly statistics.'); return
        month = clean_month(data.get('month'))
        payload = clean_payload(kind, data)
        revision = data.get('revision')
        if type(revision) is not int or revision < 0:
            raise ValueError('Reload this month before saving.')
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT revision FROM she_monthly_records WHERE kind=? AND month=?', (kind,month)).fetchone()
        if (row['revision'] if row else 0) != revision:
            db.rollback(); h.error_json(409, 'This month changed. Reload before saving.'); return
        now = int(time.time())
        db.execute('INSERT OR REPLACE INTO she_monthly_records VALUES(?,?,?,?,?,?)', (kind,month,json.dumps(payload),revision+1,user['display_name'],now))
        db.execute('INSERT INTO she_monthly_history(kind,month,payload_json,actor,created_at) VALUES(?,?,?,?,?)', (kind,month,json.dumps(payload),user['display_name'],now))
        db.commit()
        h.send_json(200, dict(ok=True,revision=revision+1))
    except (ValueError, TypeError) as error:
        h.error_json(400, str(error))


REVIEW_FIELDS = {'hos_name', 'hos_employee_no', 'rank', 'stop', 'resolution', 'pic', 'target_date', 'team_member', 'head_of_section', 'she_officer', 'manager'}


def save_review(db, row, data, user):
    if json.loads(row['snapshot_json']).get('group') != 'hiyari-hatto':
        raise ValueError('This report is not Hiyari Hatto.')
    review = data.get('review')
    if not isinstance(review, dict) or set(review) != REVIEW_FIELDS:
        raise ValueError('Complete the Hiyari Hatto review fields.')
    for key, value in review.items():
        if not isinstance(value, str) or len(value) > (2000 if key=='resolution' else 160):
            raise ValueError('Check review field lengths.')
    review = {k: v.strip() for k,v in review.items()}
    if review['rank'] not in ('','A','B','C','5S') or review['stop'] not in ('','1','2','3','4','5','6','Fire','Others'):
        raise ValueError('Choose a valid rank and STOP category.')
    if review['target_date']:
        date.fromisoformat(review['target_date'])
    status = data.get('status')
    if status not in ('open','in_progress','resolved','closed'):
        raise ValueError('Choose a valid status.')
    if status in ('resolved','closed'):
        required = ['hos_name','hos_employee_no','rank','resolution','pic','target_date','team_member','head_of_section','she_officer']
        if review['rank']=='A': required.append('manager')
        if any(not review[k] for k in required):
            raise ValueError('Complete sections B and C before closing. Rank A also requires manager verification.')
    changed = db.execute('UPDATE finding_reports SET status=?,revision=revision+1 WHERE id=? AND revision=?', (status,row['id'],data.get('revision'))).rowcount
    if not changed:
        return False
    db.execute('INSERT OR REPLACE INTO hiyari_reviews VALUES(?,?)', (row['id'],json.dumps(review)))
    note = 'FR-SH-12 review: '+json.dumps(review, ensure_ascii=False)
    db.execute('INSERT INTO finding_updates(report_id,actor,note,status,created_at) VALUES(?,?,?,?,?)', (row['id'],user['display_name'],note,status,int(time.time())))
    db.commit()
    return True
