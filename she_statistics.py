"""Executive dashboard statistics over full datasets, without photo payloads."""
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
import calendar
import json
import re
from urllib.parse import parse_qs, urlsplit
import access

TZ = timezone(timedelta(hours=8))
DONE = {'Resolved', 'Closed'}
REVIEW = 'Awaiting verification'

def period(query):
    mode = query.get('period', ['month'])[0]
    month = query.get('month', [datetime.now(TZ).strftime('%Y-%m')])[0]
    if mode not in ('month', 'year', 'all') or not re.fullmatch(r'20\d{2}-(?:0[1-9]|1[0-2])', month):
        raise ValueError('Choose a valid month and statistics period.')
    year, number = map(int, month.split('-'))
    if mode == 'month':
        start = date(year, number, 1)
        end = date(year + (number == 12), number % 12 + 1, 1)
        label = start.strftime('%B %Y')
    elif mode == 'year':
        start, end, label = date(year, 1, 1), date(year + 1, 1, 1), str(year)
    else:
        start, end, label = date(2000, 1, 1), date(2100, 1, 1), 'All dates'
    return dict(mode=mode, month=month, start=start.isoformat(), end=end.isoformat(), label=label)

def counts(rows, field):
    return [dict(label=label, count=count) for label, count in sorted(Counter(r[field] or 'Unspecified' for r in rows).items(), key=lambda x: (-x[1], x[0]))]

def summary(rows):
    done = sum(r['status'] in DONE for r in rows)
    todo = sum(r['status'] in ('Open', 'In progress') for r in rows)
    review = sum(r['status'] == REVIEW for r in rows)
    return dict(total=len(rows), to_do=todo, awaiting_review=review, completed=done,
                outstanding=todo+review, completion_rate=round(done/len(rows)*100, 1) if rows else None)

def trend(rows, selection):
    year, month = map(int, selection['month'].split('-'))
    if selection['mode'] == 'month':
        keys = [date(year, month, d).isoformat() for d in range(1, calendar.monthrange(year, month)[1]+1)]
        totals = Counter(r['date'] for r in rows)
        return dict(title='Daily activity', note='Findings recorded during '+selection['label'],
                    points=[dict(key=k, label=k[-2:], count=totals[k]) for k in keys])
    if selection['mode'] == 'year':
        keys = [str(year)+'-'+str(m).zfill(2) for m in range(1,13)]
        note = 'Findings recorded during '+str(year)
    else:
        anchor = year*12+month-1
        keys = [str(i//12)+'-'+str(i%12+1).zfill(2) for i in range(anchor-11,anchor+1)]
        note = 'Last 12 months ending '+date(year, month, 1).strftime('%B %Y')
    totals = Counter(r['date'][:7] for r in rows)
    return dict(title='Monthly activity', note=note,
                points=[dict(key=k, label=datetime.strptime(k,'%Y-%m').strftime('%b'), count=totals[k]) for k in keys])

def build(rows, selection, kind):
    selected = rows if selection['mode']=='all' else [r for r in rows if selection['start']<=r['date']<selection['end']]
    statuses = ('Open', 'In progress', REVIEW, 'Resolved', 'Closed') if kind=='red-tag' else ('Open','In progress','Resolved','Closed')
    totals = Counter(r['status'] for r in selected)
    result = dict(kind=kind, selection=selection, summary=summary(selected), backlog=summary(rows),
                  statuses=[dict(label=s,count=totals[s]) for s in statuses], trend=trend(selected,selection))
    if kind=='red-tag':
        result.update(sections=counts(selected,'section'), ranks=counts(selected,'rank'), stops=counts(selected,'stop'))
        workload=defaultdict(list)
        for row in selected: workload[(row['section'],row['pic'])].append(row)
        result['pic_workload'] = sorted([dict(section=s,pic=p,**summary(items)) for (s,p),items in workload.items()],
                                       key=lambda x:(-x['outstanding'],-x['total'],x['section'],x['pic']))
        result['unassigned'] = sum(r['assigned_user_id'] is None and r['status'] not in DONE for r in selected)
    else:
        result.update(categories=counts(selected,'category'), plants=counts(selected,'plant'),
                      locations=counts(selected,'location'), areas=counts(selected,'area'), work_orders=counts(selected,'order'))
    return result

def red_tags(db, user, selection):
    full = 'red-tag' in access.features(user)
    rows = db.execute('SELECT finding_date,section,pic,status,rank,type_of_stop,assigned_user_id FROM redtag_findings' +
                      ('' if full else ' WHERE assigned_user_id=?'), () if full else (user['id'],)).fetchall()
    normalized = [dict(date=r['finding_date'],section=r['section'],pic=r['pic'],
                       status=REVIEW if r['status']=='Action taken · awaiting review' else r['status'],
                       rank=r['rank'],stop=r['type_of_stop'],assigned_user_id=r['assigned_user_id']) for r in rows]
    return build(normalized,selection,'red-tag')

def reports(db, selection, group):
    if group not in ('environment','hiyari-hatto','kaizen','all'): raise ValueError('Choose a valid reporting area.')
    rows=[]
    labels={'environment':'Environment','hiyari-hatto':'Hiyari Hatto','kaizen':'Kaizen'}
    orders={'none':'SHE review','issued':'Work order issued','pending':'Work order pending',
            'sending':'Work order needs checking','failed':'Work order needs retry','uncertain':'Work order needs checking'}
    for row in db.execute('SELECT snapshot_json,status,created_at,plant,location,order_state FROM finding_reports'):
        original=json.loads(row['snapshot_json'])
        area=original.get('group','environment')
        if group!='all' and area!=group: continue
        rows.append(dict(date=datetime.fromtimestamp(row['created_at'],TZ).date().isoformat(),
                         category=original.get('title','Other'), status=row['status'].replace('_',' ').capitalize(),
                         plant={'port-klang':'Port Klang','sendayan':'Sendayan'}.get(row['plant'],row['plant']),
                         location=row['location'],area=labels.get(area,area),order=orders.get(row['order_state'],row['order_state'])))
    result=build(rows,selection,'environment')
    result['group']=group
    result['group_label']=labels.get(group,'All reporting areas')
    return result

def patrol_summary(rows):
    result=summary(rows)
    result['with_findings']=sum(r['not_ok']>0 for r in rows)
    result['not_ok_items']=sum(r['not_ok'] for r in rows)
    ok=sum(r['ok'] for r in rows)
    checked=ok+result['not_ok_items']
    result['ok_rate']=round(ok/checked*100,1) if checked else None
    return result

def patrols(db, selection):
    groups={'general':'General observations','machinery':'Machinery / equipment','ppe':'PPE',
            'hazards':'Hazards','others':'Other observations'}
    rows=[]
    for row in db.execute('SELECT inspector_name,answers_json,rating,created_at,template_json,followup_status FROM patrols WHERE completed=1'):
        answers=json.loads(row['answers_json'])
        template=json.loads(row['template_json'])
        keys=[q['id'] for q in template['questions'] if q['type']=='status'] if template else list(answers)
        checked=Counter(answers.get(k) for k in keys)
        sections=Counter()
        for key in keys:
            if answers.get(key)=='not_ok':
                match=re.fullmatch(r'(?:q_)?(general|machinery|ppe|hazards|others)_\d+',key)
                sections[groups[match[1]] if match else 'Custom checklists']+=1
        not_ok=checked['not_ok']
        status='No findings' if not not_ok else {'open':'Open','action_taken':REVIEW,'resolved':'Resolved'}[row['followup_status']]
        rows.append(dict(date=datetime.fromtimestamp(row['created_at'],TZ).date().isoformat(),
                         status=status,inspector=row['inspector_name'],checklist=template['title'] if template else 'Daily Safety Patrol Checklist',
                         rating=str(row['rating'])+' star'+('s' if row['rating']!=1 else ''),
                         ok=checked['ok'],not_ok=not_ok,na=checked['na'],sections=sections))
    selected=rows if selection['mode']=='all' else [r for r in rows if selection['start']<=r['date']<selection['end']]
    section_counts=Counter()
    for row in selected: section_counts.update(row['sections'])
    state_counts=Counter(r['status'] for r in selected)
    activity=trend(selected,selection)
    activity['unit']='patrols'
    activity['note']=activity['note'].replace('Findings','Completed patrols')
    return dict(kind='patrol',selection=selection,summary=patrol_summary(selected),backlog=patrol_summary(rows),
                statuses=[dict(label=label,count=state_counts[label]) for label in ('No findings','Open',REVIEW,'Resolved')],
                answers=[dict(label=label,count=sum(r[key] for r in selected)) for label,key in [('OK','ok'),('NOT OK','not_ok'),('N/A','na')]],
                sections=[dict(label=label,count=count) for label,count in sorted(section_counts.items(),key=lambda x:(-x[1],x[0]))],
                inspectors=counts(selected,'inspector'),checklists=counts(selected,'checklist'),ratings=counts(selected,'rating'),trend=activity)

def get(h, db, user, kind):
    if user['role'] not in ('executive','admin'):
        h.error_json(403,'Statistics are available to Executives and Admins only.')
        return
    query=parse_qs(urlsplit(h.path).query)
    try:
        selection=period(query)
        result=patrols(db,selection) if kind=='patrol' else red_tags(db,user,selection) if kind=='red-tag' else reports(db,selection,query.get('group',['environment'])[0])
        h.send_json(200,result)
    except ValueError as error:
        h.error_json(400,str(error))
