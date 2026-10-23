"""Air leak persistence, maintenance work orders and role boundaries."""
import base64
import json
import unittest
from unittest.mock import patch
import server
import reporting
from cmms_bridge import CmmsError
from test_server import AccountFlowTests
from test_http_memory import urlopen


class AirLeakTests(unittest.TestCase):
    setUp = AccountFlowTests.setUp
    tearDown = AccountFlowTests.tearDown
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login

    def request(self, *args, **kwargs):
        with patch('test_server.urlopen', urlopen):
            return AccountFlowTests.request(self, *args, **kwargs)

    def account(self):
        self.first_admin()
        with server.database() as db:
            db.execute("INSERT INTO users(username,display_name,password_hash,role,active,created_at,feature_access) VALUES('member','Committee Member',?,'safety_committee',1,1,'[]')", (server.hash_password('CommitteePassword123!'),))
        return self.login('member', 'CommitteePassword123!')

    def payload(self, cookie, key='air-leak-report-key-00001'):
        status, data, _ = self.request('/api/reporting/air-leak', cookie=cookie)
        self.assertEqual(status, 200)
        return dict(form_id=data['form']['id'], revision=data['form']['revision'], token=data['token'],
                    request_key=key, reporter='Committee Member', contact='', plant='sendayan', location='FG Store',
                    answers=dict(machine='Packing machine', description='Air escaping from hose fitting.', action='Isolated supply.'), photos=[dict(name='Finding.png', mime='image/png', content=base64.b64encode(b'\x89PNG\r\n\x1a\n').decode())])

    def test_air_leak_requires_photo(self):
        cookie, csrf = self.account()
        data = self.payload(cookie)
        status, result, _ = self.request('/api/reporting/submit', 'POST', {**data, 'photos': []}, cookie, csrf)
        self.assertEqual(status, 400)
        self.assertIn('at least one photo', result['error'])
        with server.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM finding_reports').fetchone()[0], 0)

    def test_submit_issues_one_maintenance_order_and_retry_returns_same_receipt(self):
        cookie, csrf = self.account()
        data = self.payload(cookie)
        with patch.object(reporting.bridge, 'identity', return_value={'id':'she-requester'}), patch.object(reporting.bridge, 'call', return_value={'id':'wo-123'}) as call:
            self.assertEqual(self.request('/api/reporting/submit','POST',data)[0],401)
            self.assertEqual(self.request('/api/reporting/submit','POST',data,cookie)[0],403)
            status, receipt, _ = self.request('/api/reporting/submit','POST',data,cookie,csrf)
            self.assertEqual(status,201)
            self.assertEqual(receipt['order_state'],'issued')
            self.assertEqual(receipt['order_id'],'wo-123')
            self.assertEqual(call.call_args.args[2]['type'],'maintenance')
            self.assertEqual(call.call_args.args[2]['machineName'],'Packing machine')
            self.assertEqual(call.call_args.args[3],'sendayan')
            retry = self.request('/api/reporting/submit','POST',data,cookie,csrf)
            self.assertEqual(retry[0],200)
            self.assertEqual(retry[1],receipt)
            self.assertEqual(call.call_count,1)
            self.assertEqual(self.request('/api/reporting/submit','POST',data)[0],401)
        history=self.request('/api/reporting/air-leak',cookie=cookie)[1]['reports']
        self.assertEqual(len(history),1)
        self.assertEqual(history[0]['reference'],receipt['reference'])
        self.assertEqual(self.request('/air-leak-ui.js')[0],200)
        server.init_db()
        with server.database() as db:
            self.assertEqual(sum(f['group']=='air-leak' for f in reporting.forms(db)),1)

    def test_uncertain_order_is_saved_and_not_reissued_on_retry(self):
        cookie, csrf=self.account()
        data=self.payload(cookie)
        with patch.object(reporting.bridge,'identity',return_value={'id':'she-requester'}), patch.object(reporting.bridge,'call',side_effect=CmmsError(502,'Response lost')) as call:
            result=self.request('/api/reporting/submit','POST',data,cookie,csrf)[1]
            self.assertEqual(result['order_state'],'uncertain')
            self.assertEqual(self.request('/api/reporting/submit','POST',data,cookie,csrf)[1],result)
            self.assertEqual(call.call_count,1)
        with server.database() as db:
            row=db.execute('SELECT * FROM finding_reports').fetchone()
            self.assertEqual(json.loads(row['answers_json'])['machine'],'Packing machine')

    def test_dashboards_allow_admin_and_executive_and_features_are_shared(self):
        cookie, _=self.account()
        self.assertEqual(self.request('/api/patrols/statistics',cookie=cookie)[0],403)
        admin,_=self.login('admin','AdminPassword123!')
        self.assertEqual(self.request('/api/patrols/statistics',cookie=admin)[0],200)
        with server.database() as db: db.execute("UPDATE users SET role='executive' WHERE username='member'")
        self.assertEqual(self.request('/api/patrols/statistics',cookie=cookie)[0],200)
        self.assertEqual(self.request('/api/she-monitoring/accident',cookie=cookie)[0],200)
        self.assertEqual(self.request('/api/session',cookie=cookie)[1]['user']['features'],list(server.access.FEATURES))
