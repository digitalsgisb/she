"""Full-dataset totals, local date boundaries, and Executive-only statistics."""
import json
import unittest
from datetime import datetime
from unittest.mock import patch
import server
import she_statistics as stats
from test_server import AccountFlowTests
from test_http_memory import urlopen

class StatisticsTests(unittest.TestCase):
    setUp=AccountFlowTests.setUp
    tearDown=AccountFlowTests.tearDown
    first_admin=AccountFlowTests.first_admin
    login=AccountFlowTests.login
    def request(self,*args,**kwargs):
        with patch('test_server.urlopen',urlopen): return AccountFlowTests.request(self,*args,**kwargs)
    def accounts(self):
        self.first_admin()
        self.admin,self.csrf=self.login('admin','AdminPassword123!')
        with server.database() as db:
            for name,role,features in [('executive','executive',['patrol','red-tag','reporting']),('operator','user',['red-tag','reporting']),('restricted','executive',[])]:
                db.execute('INSERT INTO users(username,display_name,password_hash,role,active,created_at,feature_access) VALUES(?,?,?,?,1,1,?)',
                           (name,name,server.hash_password('PasswordForTest123!'),role,json.dumps(features)))
        self.executive,self.exec_csrf=self.login('executive','PasswordForTest123!')
        self.operator,self.user_csrf=self.login('operator','PasswordForTest123!')
        self.restricted,self.restricted_csrf=self.login('restricted','PasswordForTest123!')
    def seed_reports(self):
        with server.database() as db:
            records=[('environment','Oil / chemical spillage','open','2026-09-30T23:59:59','none'),
                     ('environment','Water leakage','resolved','2026-10-01T00:00:00','issued'),
                     ('environment','Oil / chemical spillage','in_progress','2026-10-31T23:59:59','failed'),
                     ('environment','Water leakage','closed','2026-11-01T00:00:00','issued'),
                     ('kaizen','Kaizen idea','open','2026-10-05T12:00:00','none')]
            for i,(group,title,status,day,order) in enumerate(records):
                timestamp=int(datetime.fromisoformat(day).replace(tzinfo=stats.TZ).timestamp())
                db.execute('INSERT INTO finding_reports(request_key,request_hash,snapshot_json,answers_json,reporter,contact,plant,location,photos_json,status,created_at,order_state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                           (str(i),'hash',json.dumps(dict(title=title,group=group)),'{}','Guest','','port-klang','Production','[]',status,timestamp,order))
    def test_role_and_feature_checks_on_both_statistic_endpoints(self):
        self.accounts()
        for path in ['/api/patrols/statistics','/api/red-tags/statistics','/api/reporting/statistics','/api/patrols/statistics/records','/api/red-tags/statistics/records','/api/reporting/statistics/records']:
            self.assertEqual(self.request(path)[0],401)
            self.assertEqual(self.request(path,cookie=self.operator)[0],403)
            self.assertEqual(self.request(path,cookie=self.restricted)[0],403)
            self.assertEqual(self.request(path,cookie=self.executive)[0],200)
            self.assertEqual(self.request(path,cookie=self.admin)[0],200)
            self.assertEqual(self.request(path+'?month=not-a-month',cookie=self.admin)[0],400)
            self.assertEqual(self.request(path+'?period=invalid',cookie=self.admin)[0],400)
    def test_environment_period_local_midnight_and_area_filters(self):
        self.accounts();self.seed_reports()
        response=self.request('/api/reporting/statistics?month=2026-10',cookie=self.admin)[1]
        self.assertEqual(response['summary']['total'],2)
        self.assertEqual(response['summary']['completed'],1)
        self.assertEqual(response['summary']['completion_rate'],50)
        self.assertEqual(response['backlog']['outstanding'],2)
        self.assertEqual(len(response['trend']['points']),31)
        self.assertEqual(response['trend']['points'][0]['count'],1)
        self.assertEqual(response['trend']['points'][-1]['count'],1)
        self.assertEqual(sum(x['count'] for x in response['statuses']),2)
        all_areas=self.request('/api/reporting/statistics?month=2026-10&group=all',cookie=self.admin)[1]
        self.assertEqual(all_areas['summary']['total'],3)
        year=self.request('/api/reporting/statistics?period=year&month=2026-10',cookie=self.admin)[1]
        self.assertEqual(year['summary']['total'],4)
        self.assertEqual(len(year['trend']['points']),12)
        self.assertEqual(self.request('/api/reporting/statistics?group=wrong',cookie=self.admin)[0],400)
    def test_environment_totals_are_not_limited_to_inbox_500(self):
        self.accounts();self.seed_reports()
        with server.database() as db:
            template=db.execute('SELECT * FROM finding_reports LIMIT 1').fetchone()
            for i in range(510):
                db.execute('INSERT INTO finding_reports(request_key,request_hash,snapshot_json,answers_json,reporter,contact,plant,location,photos_json,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                           ('extra'+str(i),'hash',template['snapshot_json'],'{}','Guest','','port-klang','Production','[]','open',template['created_at']))
        response=self.request('/api/reporting/statistics?period=all&month=2026-10',cookie=self.admin)[1]
        self.assertEqual(response['summary']['total'],514)
        self.assertEqual(sum(x['count'] for x in response['categories']),514)
        from urllib.parse import urlencode
        params=urlencode(dict(period='all',month='2026-10',field='category',values=json.dumps(['Oil / chemical spillage']),page=2))
        records=self.request('/api/reporting/statistics/records?'+params,cookie=self.admin)[1]
        self.assertEqual(records['total'],512)
        self.assertEqual(records['pages'],21)
        self.assertEqual(records['page'],2)
        self.assertEqual(len(records['records']),25)
        self.assertTrue(all(r['category']=='Oil / chemical spillage' for r in records['records']))
        others=self.request('/api/reporting/statistics/records?'+urlencode(dict(period='all',field='category',exclude=json.dumps(['Water leakage']))),cookie=self.admin)[1]
        self.assertEqual(others['total'],512)
    def test_redtag_period_backlog_rank_and_pic_workload(self):
        self.accounts()
        with server.database() as db:
            for i,(day,status) in enumerate([('2026-09-29','Open'),('2026-10-13','Open'),('2026-10-13','Action taken · awaiting review'),('2026-10-13','Resolved'),('2026-10-20','Closed'),('2026-11-03','In progress')]):
                db.execute('INSERT INTO redtag_findings(red_tag_id,user_id,finding_date,section,pic,machine,hazard,type_of_stop,rank,recommendation,status,issued_by,photo,photo_mime,request_key,request_json,created_at) VALUES(?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                           ('TAG'+str(i),day,'FG Store','Fareez','Line','Guard','Immediate stop','A','Repair',status,'SHE',b'photo','image/png','key'+str(i),'hash',1))
        response=self.request('/api/red-tags/statistics?month=2026-10',cookie=self.executive)[1]
        self.assertEqual(response['summary'],dict(total=4,to_do=1,awaiting_review=1,completed=2,outstanding=2,completion_rate=50.0))
        self.assertEqual(response['backlog']['outstanding'],4)
        self.assertEqual(response['pic_workload'][0]['outstanding'],2)
        self.assertEqual(response['ranks'],[dict(label='A',count=4)])
        self.assertEqual(response['unassigned'],2)
        self.assertEqual(sum(x['count'] for x in response['trend']['points']),4)
        year=self.request('/api/red-tags/statistics?period=year&month=2026-10',cookie=self.admin)[1]
        self.assertEqual(year['summary']['total'],6)
        with server.database() as db:
            executive_id=db.execute("SELECT id FROM users WHERE username='executive'").fetchone()[0]
            db.execute("UPDATE users SET feature_access='[\"red-tag-pic\"]' WHERE id=?",(executive_id,))
            db.execute("UPDATE redtag_findings SET assigned_user_id=? WHERE finding_date='2026-10-13'",(executive_id,))
        scoped=self.request('/api/red-tags/statistics?month=2026-10',cookie=self.executive)[1]
        self.assertEqual(scoped['summary']['total'],3)
        self.assertEqual(scoped['backlog']['total'],3)
        from urllib.parse import urlencode
        records=self.request('/api/red-tags/statistics/records?'+urlencode(dict(month='2026-10',field='pic',values=json.dumps(['Fareez']),section='FG Store')),cookie=self.executive)[1]
        self.assertEqual(records['total'],3)
        self.assertTrue(all(r['section']=='FG Store' and r['pic']=='Fareez' for r in records['records']))
        wrong_section=self.request('/api/red-tags/statistics/records?'+urlencode(dict(month='2026-10',field='pic',values=json.dumps(['Fareez']),section='Maintenance')),cookie=self.executive)[1]
        self.assertEqual(wrong_section['total'],0)
    def test_empty_period_has_no_fabricated_completion_rate(self):
        self.accounts()
        for path in ['/api/red-tags/statistics','/api/reporting/statistics']:
            response=self.request(path+'?month=2026-10',cookie=self.admin)[1]
            self.assertEqual(response['summary']['total'],0)
            self.assertIsNone(response['summary']['completion_rate'])
            self.assertTrue(all(p['count']==0 for p in response['trend']['points']))

    def test_patrol_typed_answers_incomplete_submissions_and_followup(self):
        self.accounts()
        custom=dict(title='Custom machinery check',questions=[dict(id='q_guard',type='status'),dict(id='q_note',type='text')])
        with server.database() as db:
            fixtures=[('2026-10-01T00:00:00',{'general_0':'not_ok','general_1':'ok','ppe_0':'na'},None,'open',1),
                      ('2026-10-13T12:00:00',{'q_guard':'not_ok','q_note':'not_ok'},custom,'action_taken',1),
                      ('2026-10-20T12:00:00',{'general_0':'ok','ppe_0':'na'},None,'open',1),
                      ('2026-10-21T12:00:00',{'q_guard':'not_ok','q_note':'not_ok'},custom,'resolved',1),
                      ('2026-10-22T12:00:00',{'general_0':'not_ok'},None,'open',0),
                      ('2026-09-30T23:59:59',{'general_0':'not_ok'},None,'open',1)]
            for day,answers,template,status,completed in fixtures:
                timestamp=int(datetime.fromisoformat(day).replace(tzinfo=stats.TZ).timestamp())
                db.execute('INSERT INTO patrols(user_id,inspector_name,answers_json,rating,remarks,created_at,template_json,followup_status,completed) VALUES(1,?,?,?,?,?,?,?,?)',
                           ('Sara',json.dumps(answers),3,'',timestamp,json.dumps(template),status,completed))
        response=self.request('/api/patrols/statistics?month=2026-10',cookie=self.executive)[1]
        self.assertEqual(response['summary']['total'],4)
        self.assertEqual(response['summary']['with_findings'],3)
        self.assertEqual(response['summary']['not_ok_items'],3)
        self.assertEqual(response['summary']['ok_rate'],40)
        self.assertEqual(response['summary']['outstanding'],2)
        self.assertEqual(response['backlog']['outstanding'],3)
        self.assertEqual(response['answers'],[dict(label='OK',count=2),dict(label='NOT OK',count=3),dict(label='N/A',count=2)])
        self.assertEqual(sum(x['count'] for x in response['sections']),3)
        self.assertEqual(sum(x['count'] for x in response['statuses']),4)
        self.assertEqual(response['trend']['points'][0]['count'],1)
        self.assertEqual(response['checklists'][0]['count'],2)
        self.assertEqual(sum(x['count'] for x in response['trend']['points']),4)
        self.assertEqual(self.request('/api/patrols/statistics',cookie=self.operator)[0],403)

    def test_chart_drilldown_matches_period_category_and_answer_counts(self):
        from urllib.parse import urlencode
        self.accounts();self.seed_reports()
        params=urlencode(dict(month='2026-10',field='status',values=json.dumps(['Resolved'])))
        result=self.request('/api/reporting/statistics/records?'+params,cookie=self.admin)[1]
        self.assertEqual(result['total'],1)
        self.assertEqual(result['records'][0]['title'],'Water leakage')
        self.assertEqual(result['records'][0]['reference'],'SHE-000002')
        self.assertEqual(result['records'][0]['detail_url'],'/#/reporting-inbox/2')
        daily=self.request('/api/reporting/statistics/records?'+urlencode(dict(month='2026-10',field='date',values=json.dumps(['2026-10-31']))),cookie=self.admin)[1]
        self.assertEqual(daily['total'],1)
        self.assertEqual(daily['records'][0]['status'],'In progress')
        self.assertEqual(self.request('/api/reporting/statistics/records?field=unknown&values=[]',cookie=self.admin)[0],400)
        self.assertEqual(self.request('/api/reporting/statistics/records?page=0',cookie=self.admin)[0],400)
        self.assertEqual(self.request('/api/reporting/statistics/records?values={}',cookie=self.admin)[0],400)
        with server.database() as db:
            template=dict(title='Custom',questions=[dict(id='q_a',type='status'),dict(id='q_b',type='status'),dict(id='q_note',type='text')])
            stamp=int(datetime(2026,10,13,12,tzinfo=stats.TZ).timestamp())
            for answers in [{'q_a':'not_ok','q_b':'not_ok','q_note':'not_ok'},{'q_a':'ok','q_b':'na','q_note':'not_ok'}]:
                db.execute('INSERT INTO patrols(user_id,inspector_name,answers_json,rating,remarks,created_at,template_json) VALUES(1,?,?,?,?,?,?)',('Sara',json.dumps(answers),3,'',stamp,json.dumps(template)))
        result=self.request('/api/patrols/statistics/records?'+urlencode(dict(month='2026-10',field='answer',values=json.dumps(['NOT OK']))),cookie=self.admin)[1]
        self.assertEqual(result['total'],1)
        self.assertEqual(result['matched_items'],2)
        result=self.request('/api/patrols/statistics/records?'+urlencode(dict(month='2026-10',field='section',values=json.dumps(['Custom checklists']))),cookie=self.admin)[1]
        self.assertEqual(result['total'],1)
        self.assertEqual(result['matched_items'],2)

    def test_record_photo_previews_keep_authenticated_access(self):
        import base64
        from urllib.request import Request
        self.accounts()
        self.seed_reports()
        payload=b'photo-preview-test'
        with server.database() as db:
            db.execute('UPDATE finding_reports SET photos_json=?,answers_json=? WHERE id=2',
                       (json.dumps([dict(mime='image/png',content=base64.b64encode(payload).decode())]),json.dumps({'issue':'Leak at the pump'})))
        records=self.request('/api/reporting/statistics/records?month=2026-10',cookie=self.admin)[1]['records']
        record=next(r for r in records if r['id']==2)
        self.assertEqual(record['description'],'Leak at the pump')
        self.assertEqual(record['photo_url'],'/api/reporting/reports/2/photos/0')
        self.assertIsNone(next(r for r in records if r['id']==3)['photo_url'])
        response=urlopen(Request(self.base+record['photo_url'],headers={'Cookie':self.admin}))
        self.assertEqual(response.status,200)
        self.assertEqual(response.read(),payload)
        self.assertEqual(response.headers['Content-Type'],'image/png')
        self.assertEqual(response.headers['Cache-Control'],'private, no-store')
        self.assertEqual(self.request(record['photo_url'])[0],401)
        self.assertEqual(self.request(record['photo_url'],cookie=self.restricted)[0],403)
        self.assertEqual(self.request('/api/reporting/reports/2/photos/1',cookie=self.admin)[0],404)

if __name__=='__main__': unittest.main()
