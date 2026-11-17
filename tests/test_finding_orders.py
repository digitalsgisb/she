"""Cross-module issuance, permissions, duplicate protection and photo recovery."""
import base64
import json
import unittest
from unittest.mock import patch
import reporting
import server
from cmms_bridge import CmmsError
from test_server import AccountFlowTests

PHOTO = b'\x89PNG\r\n\x1a\n'


class FindingOrderTests(unittest.TestCase):
    tearDown = AccountFlowTests.tearDown
    request = AccountFlowTests.request
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login

    def setUp(self):
        AccountFlowTests.setUp(self)
        self.first_admin()
        self.cookie, self.csrf = self.login('admin', 'AdminPassword123!')
        self.identity = self.enterContext(patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}))
        self.create = self.enterContext(patch.object(reporting.bridge, 'call', return_value={'id': 'WO-action'}))
        self.upload = self.enterContext(patch.object(reporting.bridge, 'upload_photo', return_value=[]))
        self.remote = self.enterContext(patch.object(reporting.bridge, 'she_order', return_value={'attachments': []}))
        with server.database() as db:
            db.execute('''INSERT INTO redtag_findings(red_tag_id,user_id,finding_date,section,pic,machine,hazard,
                type_of_stop,rank,recommendation,status,issued_by,photo,photo_mime,request_key,request_json,created_at)
                VALUES('RT-001',1,'2026-11-05','FG Store','Fareez','Packing line','Damaged guard',
                'STOP 1','A','Replace guard','Open','Inspector',?,'image/png','test-redtag-key','{}',1)''', (PHOTO,))
            db.execute('''INSERT INTO patrols(user_id,inspector_name,answers_json,rating,remarks,created_at,completed,item_remarks_json)
                VALUES(1,'Inspector','{"machine_1":"not_ok"}',2,'Guard broken',2,1,'{"machine_1":"Replace guard"}')''')
            db.execute("INSERT INTO patrol_attachments(id,patrol_id,filename,mime_type,size,created_at) VALUES(?,1,'guard.png','image/png',?,1)", ('a' * 32, len(PHOTO)))
        server.patrol_files().mkdir()
        (server.patrol_files() / ('a' * 32)).write_bytes(PHOTO)

    def post(self, path, data=None):
        return self.request(path, 'POST', data or {}, self.cookie, self.csrf)

    def test_genba_and_patrol_orders_include_original_photos_and_are_created_once(self):
        for kind, prefix in [('red-tag', 'GENBA'), ('patrol', 'PATROL')]:
            with self.subTest(kind=kind):
                path = f'/api/finding-orders/{kind}/1'
                self.assertEqual(self.request(path, cookie=self.cookie)[1]['order_state'], 'none')
                status, result, _ = self.post(path + '/issue', {'plant': 'sendayan'})
                self.assertEqual(status, 201, result)
                self.assertEqual(result['order_state'], 'issued')
                self.assertEqual(result['order_photo_state'], 'synced')
                body = self.create.call_args.args[2]
                self.assertEqual(body['type'], 'maintenance')
                self.assertIn(prefix + '-000001', body['issueDescription'])
                self.assertIn('guard', body['issueDescription'].lower())
                self.assertEqual(self.create.call_args.args[3], 'sendayan')
                self.assertEqual(self.upload.call_args.args[4], PHOTO)
                self.assertTrue(self.upload.call_args.args[2].startswith(prefix + '-000001-photo-1'))
                self.assertEqual(self.post(path + '/issue', {'plant': 'port-klang'})[0], 409)
                self.assertEqual(self.post(path + '/retry')[0], 400)
        self.assertEqual(self.create.call_count, 2)
        self.assertEqual(self.upload.call_count, 2)
        with server.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM finding_reports').fetchone()[0], 0)

    def test_source_permissions_csrf_and_plant_validation(self):
        path = '/api/finding-orders/red-tag/1'
        self.assertEqual(self.request(path)[0], 401)
        self.assertEqual(self.request(path + '/issue', 'POST', {'plant': 'sendayan'}, self.cookie)[0], 403)
        self.assertEqual(self.post(path + '/issue', {'plant': 'elsewhere'})[0], 400)
        self.assertEqual(self.post('/api/finding-orders/red-tag/999/issue', {'plant': 'sendayan'})[0], 400)
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE id=1")
        self.assertEqual(self.request(path, cookie=self.cookie)[0], 403)
        self.assertEqual(self.post(path + '/issue', {'plant': 'sendayan'})[0], 403)
        self.create.assert_not_called()

    def test_ambiguous_creation_links_existing_order_and_photo_failure_auto_recovers(self):
        path = '/api/finding-orders/red-tag/1'
        self.create.side_effect = CmmsError(502, 'Timed out')
        self.assertEqual(self.post(path + '/issue', {'plant': 'port-klang'})[1]['order_state'], 'uncertain')
        self.assertEqual(self.post(path + '/retry')[0], 400)
        self.remote.return_value = {'type': 'maintenance', 'title': 'GENBA-000001 hazard', 'attachments': []}
        self.upload.side_effect = CmmsError(502, 'Photo timed out')
        result = self.post(path + '/link', {'order_id': 'WO-existing'})[1]
        self.assertEqual(result['order_state'], 'issued')
        self.assertEqual(result['order_photo_state'], 'failed')
        self.upload.side_effect = None
        with server.database() as db:
            db.execute('UPDATE source_order_photos SET started_at=0')
        reporting.sync_pending_order_photos(server.database)
        self.assertEqual(self.request(path, cookie=self.cookie)[1]['order_photo_state'], 'synced')
        self.assertEqual(self.create.call_count, 1)
        self.assertEqual(self.upload.call_args.args[0], 'WO-existing')

    def test_executive_overview_uses_live_counts(self):
        status, data, _ = self.request('/api/workspace/overview', cookie=self.cookie)
        self.assertEqual(status, 200)
        self.assertEqual(data['counts'], dict(reports=0, genba=1, patrols=1))
        self.assertEqual({r['href'] for r in data['recent']}, {'#/red-tag/1', '#/daily-safety-patrol/1'})
        with server.database() as db:
            db.execute("UPDATE redtag_findings SET status='Resolved'")
            db.execute("UPDATE patrols SET followup_status='resolved'")
        self.assertEqual(self.request('/api/workspace/overview', cookie=self.cookie)[1]['counts'], dict(reports=0, genba=0, patrols=0))
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE id=1")
        self.assertEqual(self.request('/api/workspace/overview', cookie=self.cookie)[0], 403)


if __name__ == '__main__':
    unittest.main()


class CmmsVerificationClosesSheRecords(unittest.TestCase):
    """A work order verified (closed) in CMMS closes the linked patrol, Red Tag and report."""
    setUp = AccountFlowTests.setUp
    tearDown = AccountFlowTests.tearDown
    first_admin = AccountFlowTests.first_admin

    def test_closed_order_closes_patrol_redtag_and_report_but_not_hiyari(self):
        import reporting
        self.first_admin()
        with server.database() as db:
            uid = db.execute("SELECT id FROM users WHERE username='admin'").fetchone()['id']
            patrol = db.execute("INSERT INTO patrols(user_id,inspector_name,answers_json,rating,created_at,template_json,completed,followup_status) VALUES(?,?,?,?,?,?,1,'open')",
                                (uid, 'Aman', '{}', 2, 1, 'null')).lastrowid
            finding = db.execute("INSERT INTO redtag_findings(red_tag_id,user_id,finding_date,section,pic,machine,hazard,type_of_stop,rank,recommendation,status,issued_by,photo,photo_mime,request_key,request_json,created_at) VALUES('RT-1',?,'2026-11-01','Macro','PIC','Press','Guard','2','A','Fix','Open','SHE',x'00','image/png','k1','{}',1)", (uid,)).lastrowid
            for kind, source in (('patrol', patrol), ('red-tag', finding)):
                db.execute("INSERT INTO source_orders(source_kind,source_id,snapshot_json,answers_json,reporter,plant,location,photos_json,order_state,order_id) VALUES(?,?,'{}','{}','r','sendayan','l','[]','issued',?)", (kind, source, 'wo-' + kind))
            report = db.execute("INSERT INTO finding_reports(request_key,request_hash,snapshot_json,answers_json,reporter,contact,plant,location,photos_json,status,created_at,order_state,order_id) VALUES('a','h',?,'{}','r','','sendayan','l','[]','in_progress',1,'issued','wo-report')", (json.dumps({'group': 'environment', 'title': 'Spill'}),)).lastrowid
            hiyari = db.execute("INSERT INTO finding_reports(request_key,request_hash,snapshot_json,answers_json,reporter,contact,plant,location,photos_json,status,created_at,order_state,order_id) VALUES('b','h',?,'{}','r','','sendayan','l','[]','open',1,'issued','wo-hiyari')", (json.dumps({'group': 'hiyari-hatto', 'title': 'Hiyari Hatto'}),)).lastrowid
            db.commit()
        orders = [{'id': 'wo-patrol', 'number': 'WO-1', 'status': 'closed', 'responsibleDepartment': 'SHE'},
                  {'id': 'wo-red-tag', 'number': 'WO-2', 'status': 'resolved', 'responsibleDepartment': 'SHE'},
                  {'id': 'wo-report', 'number': 'WO-3', 'status': 'closed', 'responsibleDepartment': 'SHE'},
                  {'id': 'wo-hiyari', 'number': 'WO-4', 'status': 'closed', 'responsibleDepartment': 'SHE'}]
        original = reporting.bridge.call
        reporting.bridge.call = lambda path, *args, **kwargs: orders
        try:
            self.assertEqual(reporting.sync_order_statuses(server.database), 2)
            with server.database() as db:
                self.assertEqual(db.execute('SELECT followup_status FROM patrols WHERE id=?', (patrol,)).fetchone()[0], 'resolved')
                self.assertIn('WO-1', db.execute('SELECT message FROM patrol_updates WHERE patrol_id=?', (patrol,)).fetchone()[0])
                self.assertEqual(db.execute('SELECT status FROM redtag_findings WHERE id=?', (finding,)).fetchone()[0], 'Open')
                self.assertEqual(db.execute('SELECT status FROM finding_reports WHERE id=?', (report,)).fetchone()[0], 'closed')
                self.assertEqual(db.execute('SELECT status FROM finding_reports WHERE id=?', (hiyari,)).fetchone()[0], 'open')
            orders[1]['status'] = 'closed'
            self.assertEqual(reporting.sync_order_statuses(server.database), 1)
            self.assertEqual(reporting.sync_order_statuses(server.database), 0)
            with server.database() as db:
                self.assertEqual(db.execute('SELECT status FROM redtag_findings WHERE id=?', (finding,)).fetchone()[0], 'Closed')
        finally:
            reporting.bridge.call = original
