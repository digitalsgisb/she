"""Small patrol card payloads and unresolved finding context."""
import json


def first_photo(db, patrol_id, question_id=None):
    row = db.execute('''SELECT id FROM patrol_attachments WHERE patrol_id=? AND update_id IS NULL
        AND mime_type IN ('image/jpeg','image/png','image/webp','image/gif')
        ORDER BY CASE WHEN question_id=? THEN 0 ELSE 1 END,created_at,id LIMIT 1''', (patrol_id, question_id or '')).fetchone()
    return f"/api/patrols/{patrol_id}/attachments/{row['id']}" if row else ''


def finding_items(row, default_template):
    template = json.loads(row['template_json'])
    questions = (template or default_template)['questions']
    labels = {q['id']: q['label'] for q in questions if q['type']=='status'}
    remarks = json.loads(row['item_remarks_json'])
    issues=[]
    for key,value in json.loads(row['answers_json']).items():
        if value!='not_ok' or (template and key not in labels):
            continue
        issues.append(dict(key=key,label=labels.get(key,labels.get('q_'+key,key.replace('_',' ').capitalize())),
                           remark=remarks.get(key,remarks.get('q_'+key,''))))
    return issues


def card(db, row, default_template, photo=True):
    template = json.loads(row['template_json'])
    issues = finding_items(row, default_template)
    updates = db.execute('SELECT COUNT(*) FROM patrol_updates WHERE patrol_id=?', (row['id'],)).fetchone()[0]
    return dict(id=row['id'],inspector=row['inspector_name'],created_at=row['created_at'],status=row['followup_status'],
                title=template['title'] if template else 'Daily Safety Patrol',remarks=row['remarks'],findings=len(issues),issues=issues,
                update_count=updates,needs_attention=row['followup_status']!='resolved' and bool(issues or row['remarks'].strip() or updates or row['followup_status']=='action_taken'),
                thumbnail_url=first_photo(db,row['id']) if photo else '')
