"""Genba account, assignment, evidence and export integration coverage."""
import base64
import json
import unittest
import uuid
from urllib.request import Request
from unittest.mock import patch
import server
from test_server import AccountFlowTests
from test_http_memory import urlopen

PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

class GenbaTests(unittest.TestCase):
    setUp = AccountFlowTests.setUp
    tearDown = AccountFlowTests.tearDown
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login
    def request(self, *args, **kwargs):
        with patch('test_server.urlopen', urlopen):
            return AccountFlowTests.request(self, *args, **kwargs)

    def setup_accounts(self):
        self.first_admin()
        self.admin, self.csrf = self.login('admin','AdminPassword123!')
        def create(username, role, features):
            status, result, _ = self.request('/api/users', 'POST', dict(username=username,display_name=username,
                password='PasswordForTest123!',role=role,features=features),self.admin,self.csrf)
            self.assertEqual(status,201)
            return result['user']['id']
        self.exec_id=create('executive','executive',['red-tag'])
        self.pic_id=create('fareez','user',['red-tag-pic'])
        self.other_id=create('outsider','user',['red-tag-pic'])
        self.pic, self.pic_csrf=self.login('fareez','PasswordForTest123!')
        self.other, self.other_csrf=self.login('outsider','PasswordForTest123!')
        config=self.request('/api/red-tags/settings',cookie=self.admin)[1]
        config['assignments']=[dict(section='FG Store',pic='Fareez',user_id=self.pic_id)]
        self.assertEqual(self.request('/api/red-tags/settings','PATCH',config,self.admin,self.csrf)[0],200)
        self.config=self.request('/api/red-tags/settings',cookie=self.admin)[1]

    def payload(self):
        return dict(finding_date='2026-10-13',section='FG Store',pic='Fareez',machine='Packing line',
                    hazard='<script>alert(1)</script>',type_of_stop='Immediate stop',rank='A',
                    recommendation='Replace damaged guard',status='Open',photo=PHOTO,
                    settings_revision=self.config['revision'],request_key=str(uuid.uuid4()))

    def create(self, payload=None):
        data=payload or self.payload()
        status,result,_=self.request('/api/red-tags','POST',data,self.admin,self.csrf)
        self.assertEqual(status,201,result)
        return result['finding']

    def test_active_and_history_span_dates(self):
        self.setup_accounts()
        active = self.create()
        data = self.payload()
        data['finding_date'] = '2026-09-01'
        completed = self.create(data)
        with server.database() as db:
            db.execute("UPDATE redtag_findings SET status='Resolved' WHERE id=?", (completed['id'],))
        for view, expected in [('active', active['id']), ('history', completed['id'])]:
            path = '/api/red-tags?view=' + view
            self.assertEqual([r['id'] for r in self.request(path, cookie=self.admin)[1]['findings']], [expected])
            # Workspace records are shared with signed-in staff.
            self.assertEqual([r['id'] for r in self.request(path, cookie=self.other)[1]['findings']], [expected])

    def test_assigned_pic_inbox_after_photo_and_executive_verification(self):
        self.setup_accounts()
        row=self.create()
        self.assertEqual(row['red_tag_id'],'RT2610-001')
        self.assertEqual(row['assigned_user_id'],self.pic_id)
        self.assertEqual(len(self.request('/api/red-tags?inbox=1',cookie=self.pic)[1]['findings']),1)
        self.assertEqual(self.request('/api/red-tags?inbox=1',cookie=self.other)[1]['findings'],[])
        path='/api/red-tags/'+str(row['id'])
        self.assertEqual(self.request(path,cookie=self.other)[0],404)
        self.assertEqual(self.request(path+'/photo',cookie=self.other)[0],404)
        action=dict(status='Action taken · awaiting review',note='Guard replaced',revision=row['revision'])
        self.assertEqual(self.request(path,'PATCH',action,self.pic,self.pic_csrf)[0],400)
        action['after_photo']=PHOTO
        self.assertEqual(self.request(path,'PATCH',action,self.pic,self.pic_csrf)[0],200)
        detail=self.request(path,cookie=self.pic)[1]
        self.assertTrue(detail['updates'][0]['has_after_photo'])
        photo_path=path+'/updates/'+str(detail['updates'][0]['id'])+'/photo'
        self.assertEqual(self.request(photo_path,cookie=self.other)[0],404)
        req=Request(self.base+photo_path,headers={'Cookie':self.pic})
        response=urlopen(req)
        self.assertEqual(response.body,base64.b64decode(PHOTO.split(',')[1]))
        self.assertEqual(self.request(path,'PATCH',dict(status='Closed',note='Done',revision=detail['finding']['revision']),self.pic,self.pic_csrf)[0],403)
        self.assertEqual(self.request(path,'PATCH',dict(status='Resolved',note='SHE verified',revision=detail['finding']['revision']),self.admin,self.csrf)[0],200)
        self.assertEqual(self.request(path,'PATCH',action,self.pic,self.pic_csrf)[0],409)

    def test_feature_revocation_and_executive_cannot_escalate_accounts(self):
        self.setup_accounts()
        for path in ['/api/patrols','/api/patrol-templates','/api/cmms/config','/api/reporting/reports','/api/users']:
            self.assertEqual(self.request(path,cookie=self.pic)[0],403,path)
        self.assertEqual(self.request('/api/red-tags','POST',self.payload(),self.pic,self.pic_csrf)[0],403)
        executive,csrf=self.login('executive','PasswordForTest123!')
        self.assertEqual(self.request('/api/users',cookie=executive)[0],200)
        self.assertEqual(self.request('/api/users/'+str(self.pic_id),'PATCH',dict(features=[]),executive,csrf)[0],200)
        self.assertEqual(self.request('/api/red-tags?inbox=1',cookie=self.pic)[0],403)
        self.assertEqual(self.request('/api/users/'+str(self.pic_id),'PATCH',dict(role='admin'),executive,csrf)[0],403)
        self.assertEqual(self.request('/api/users/1','PATCH',dict(display_name='Changed'),executive,csrf)[0],403)
        self.assertEqual(self.request('/api/users/1/reset-password','POST',dict(password='AnotherPassword123!'),executive,csrf)[0],403)

    def test_validation_idempotency_and_master_data_snapshots(self):
        self.setup_accounts()
        payload=self.payload()
        row=self.create(payload)
        status,result,_=self.request('/api/red-tags','POST',payload,self.admin,self.csrf)
        self.assertEqual(status,200)
        self.assertEqual(result['finding']['id'],row['id'])
        changed={**payload,'hazard':'Different hazard'}
        self.assertEqual(self.request('/api/red-tags','POST',changed,self.admin,self.csrf)[0],409)
        changed=self.payload();changed['pic']='Not a PIC'
        self.assertEqual(self.request('/api/red-tags','POST',changed,self.admin,self.csrf)[0],400)
        config=self.config.copy();config['sections']=[s for s in config['sections'] if s['name']!='FG Store'];config['assignments']=[]
        self.assertEqual(self.request('/api/red-tags/settings','PATCH',config,self.admin,self.csrf)[0],200)
        self.assertEqual(self.request('/api/red-tags/settings','PATCH',config,self.admin,self.csrf)[0],409)
        self.assertEqual(self.request('/api/red-tags/'+str(row['id']),cookie=self.pic)[1]['finding']['section'],'FG Store')
        self.assertEqual(self.request('/api/red-tags','POST',self.payload(),self.admin,self.csrf)[0],409)
        self.assertEqual(self.request('/api/red-tags/settings','PATCH',config,self.pic,self.pic_csrf)[0],403)

    def test_print_export_and_date_filters(self):
        self.setup_accounts()
        row=self.create()
        other=self.payload();other['pic']='Shahrul';other['machine']='=HYPERLINK("https://example.com")'
        self.create(other)
        self.assertEqual(self.request('/api/red-tags?date=2026-10-14',cookie=self.admin)[1]['findings'],[])
        status,printed,_=self.request('/api/red-tags/print?date=2026-10-13',cookie=self.admin)
        self.assertEqual(status,200)
        self.assertIn('&lt;script&gt;',printed)
        self.assertIn('Type of stop',printed)
        self.assertIn('Issue by',printed)
        status,export,_=self.request('/api/red-tags/export?date=2026-10-13',cookie=self.admin)
        self.assertEqual(status,200)
        self.assertIn("'=HYPERLINK",export)
        pic_print=self.request('/api/red-tags/print?date=2026-10-13',cookie=self.pic)[1]
        self.assertIn(row['red_tag_id'],pic_print)
        self.assertNotIn('RT2610-002',pic_print)
        self.assertEqual(self.request('/api/red-tags/printed','POST',dict(ids=[row['id']]),self.pic,self.pic_csrf)[0],200)
        self.assertTrue(self.request('/api/red-tags/'+str(row['id']),cookie=self.pic)[1]['finding']['printed_at'])
        self.assertEqual(self.request('/api/red-tags/print?date=bad',cookie=self.admin)[0],400)
        self.assertEqual(self.request('/api/red-tags/printed','POST',dict(ids=[2]),self.pic,self.pic_csrf)[0],404)

if __name__ == '__main__': unittest.main()
