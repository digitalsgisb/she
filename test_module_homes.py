"""Home summaries use each module's source records and visibility rules."""
import json
import time
import unittest
from unittest.mock import patch
import access
import reporting
import server
from test_finding_orders import FindingOrderTests


class ModuleHomeTests(unittest.TestCase):
    setUp = FindingOrderTests.setUp
    tearDown = FindingOrderTests.tearDown
    request = FindingOrderTests.request
    first_admin = FindingOrderTests.first_admin
    login = FindingOrderTests.login

    def reports(self):
        with server.database() as db:
            db.execute("INSERT INTO users(username,display_name,password_hash,role,active,created_at) SELECT 'other','Other',password_hash,'user',1,1 FROM users WHERE id=1")
            for group in ('hiyari-hatto','air-leak','environment'):
                form=next(f for f in reporting.forms(db) if f['group']==group)
                for owner,status in ((1,'open'),(2,'closed')):
                    key=f'{group}-{owner}'
                    db.execute('''INSERT INTO finding_reports(request_key,request_hash,user_id,snapshot_json,answers_json,reporter,contact,plant,location,photos_json,created_at,status)
                        VALUES(?,?,?,?,?,'Inspector','','port-klang','FG Store','[]',?,?)''',
                        (key,key,owner,json.dumps(form),'{}',int(time.time()),status))

    def test_red_tag_and_reporting_summaries_have_counts_recent_and_no_photo_data(self):
        self.reports()
        for kind in ('red-tag','hiyari-hatto','air-leak'):
            with self.subTest(kind=kind):
                path=f'/api/workspace/modules/{kind}'
                self.assertEqual(self.request(path)[0],401)
                status,data,_=self.request(path,cookie=self.cookie)
                self.assertEqual(status,200)
                self.assertEqual(data['counts']['active'],1)
                self.assertEqual(data['counts']['history'],0 if kind=='red-tag' else 1)
                self.assertEqual(len(data['recent']),1 if kind=='red-tag' else 2)
                if kind=='red-tag':
                    self.assertEqual(len(data['active']),1)
                    self.assertEqual(data['active'][0]['pic'],'Fareez')
                self.assertNotIn('photos',data['recent'][0])
                self.assertNotIn('content',json.dumps(data))

    def test_air_leak_owner_scope_and_genba_assigned_visibility(self):
        self.reports()
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE id=1")
        data=self.request('/api/workspace/modules/air-leak',cookie=self.cookie)[1]
        self.assertEqual(data['counts']['history'],0)
        self.assertEqual(len(data['recent']),1)
        # Hiyari report visibility matches the shared staff reporting inbox.
        self.assertEqual(len(self.request('/api/workspace/modules/hiyari-hatto',cookie=self.cookie)[1]['recent']),2)
        with patch.object(access,'features',return_value=['red-tag-pic']):
            self.assertEqual(self.request('/api/workspace/modules/red-tag',cookie=self.cookie)[1]['recent'],[])
            with server.database() as db:
                db.execute('UPDATE redtag_findings SET assigned_user_id=1')
            data=self.request('/api/workspace/modules/red-tag',cookie=self.cookie)[1]
            self.assertEqual(len(data['recent']),1)
            self.assertEqual(data['recent'][0]['href'],'#/red-tag/1')


if __name__=='__main__':
    unittest.main()
