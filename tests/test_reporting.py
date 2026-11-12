"""Integration tests for public submissions, form ownership, history and CMMS recovery."""
import json
import base64
import uuid
import unittest
from unittest.mock import Mock, PropertyMock, patch
import reporting
import server
from test_server import AccountFlowTests
from cmms_bridge import CmmsError


class ReportingTests(unittest.TestCase):
    def setUp(self):
        AccountFlowTests.setUp(self)
        self.photo_upload = self.enterContext(patch.object(reporting.bridge, 'upload_photo', return_value=[]))
        self.remote_order = self.enterContext(patch.object(reporting.bridge, 'she_order', return_value={'attachments': []}))
    tearDown = AccountFlowTests.tearDown
    request = AccountFlowTests.request
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login

    def payload(self, form_id=2):
        public = self.request('/api/reporting/public')[1]
        form = next(f for f in public['forms'] if f['id'] == form_id)
        return dict(token=public['token'], request_key=str(uuid.uuid4()), form_id=form_id,
                    revision=form['revision'], reporter='Guest Person', contact='Visitor',
                    plant='port-klang', location='Production, line 2',
                    answers={q['id']: q['options'][0] if q['options'] else '2026-10-23' if q['type'] == 'date' else '1' if q['type'] == 'number' else 'A finding that needs attention' for q in form['questions']}, photos=[dict(name='Finding.png', mime='image/png', content=base64.b64encode(b'\x89PNG\r\n\x1a\n').decode())])

    def test_every_public_form_requires_photo_evidence(self):
        public = self.request('/api/reporting/public')[1]
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', return_value={'id': 'WO-photo'}):
            for form in public['forms']:
                with self.subTest(form=form['title']):
                    data = self.payload(form['id'])
                    for photos in ([], None, [data['photos'][0]] * 4):
                        status, result, _ = self.request('/api/reporting/submit', 'POST', {**data, 'photos': photos})
                        self.assertEqual(status, 400)
                        self.assertIn('at least one photo', result['error'])
                    missing = dict(data)
                    missing.pop('photos')
                    self.assertEqual(self.request('/api/reporting/submit', 'POST', missing)[0], 400)
                    self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 201)
        with server.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM finding_reports').fetchone()[0], len(public['forms']))

    def test_three_large_photos_and_size_boundary(self):
        data = self.payload()
        content = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'x' * (10_000_000 - 8)).decode()
        data['photos'] = [dict(name=f'Photo-{i}.png', mime='image/png', content=content) for i in range(3)]
        status, result, _ = self.request('/api/reporting/submit', 'POST', data)
        self.assertEqual(status, 201, result)
        with server.database() as db:
            photos = json.loads(db.execute('SELECT photos_json FROM finding_reports').fetchone()[0])
        self.assertEqual(len(photos), 3)
        self.assertTrue(all(len(base64.b64decode(p['content'])) == 10_000_000 for p in photos))
        data['request_key'] = str(uuid.uuid4())
        data['photos'] = [{**data['photos'][0], 'content': base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'x' * (10_000_001 - 8)).decode()}]
        status, result, _ = self.request('/api/reporting/submit', 'POST', data)
        self.assertEqual(status, 400)
        self.assertIn('10 MB', result['error'])

    def elevated(self, role='executive'):
        self.first_admin()
        with server.database() as db:
            db.execute('UPDATE users SET role=? WHERE username=?', (role, 'admin'))
        return self.login('admin', 'AdminPassword123!')

    def test_public_categories_privacy_tokens_origin_and_validation(self):
        public = self.request('/api/reporting/public')[1]
        self.assertEqual(len(public['forms']), 11)
        self.assertEqual({f['group'] for f in public['forms']}, set(reporting.GROUPS) - {'air-leak'})
        self.assertTrue(any('Stagnant water' in f['title'] for f in public['forms']))
        self.assertEqual(self.request('/report')[0], 200)
        self.assertEqual(self.request('/api/reporting/reports')[0], 401)
        data = self.payload()
        self.assertEqual(self.request('/api/reporting/submit', 'POST', {**data, 'token': 'bad'})[0], 403)
        self.assertEqual(self.request('/api/reporting/submit', 'POST', data, origin='https://elsewhere.example')[0], 403)
        self.assertEqual(self.request('/api/reporting/submit', 'POST', {**data, 'location': ''})[0], 400)
        self.assertEqual(self.request('/api/reporting/submit', 'POST', {**data, 'form_id': []})[0], 400)
        status, result, _ = self.request('/api/reporting/submit', 'POST', data)
        self.assertEqual(status, 201)
        self.assertEqual(result['order_state'], 'none')
        self.assertNotIn('reporter', result)
        self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 200)
        self.assertEqual(self.request('/api/reporting/submit', 'POST', {**data, 'reporter': 'Different'})[0], 409)
        with server.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM finding_reports').fetchone()[0], 1)

    def test_water_kaizen_created_once_and_standard_reports_do_not_issue_orders(self):
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she-requester'}), patch.object(reporting.bridge, 'call', return_value={'id': 'WO-42'}) as call:
            water = self.payload(1)
            first = self.request('/api/reporting/submit', 'POST', water)
            self.assertEqual(first[0], 201)
            self.assertEqual(first[1]['order_id'], 'WO-42')
            self.assertEqual(call.call_args.args[2]['type'], 'kaizen')
            self.assertEqual(call.call_args.args[2]['responsibleDepartment'], 'SHE')
            self.assertIn(first[1]['reference'], call.call_args.args[2]['issueDescription'])
            self.request('/api/reporting/submit', 'POST', water)
            self.request('/api/reporting/submit', 'POST', self.payload(2))
            self.assertEqual(call.call_count, 1)

    def test_signed_in_user_can_submit_hiyari_in_app(self):
        cookie, csrf = self.elevated('user')
        data = self.payload(9)
        with patch.object(reporting.bridge, 'call') as call:
            result = self.request('/api/reporting/submit', 'POST', data, cookie, csrf)
            self.assertEqual(result[0], 201)
            self.assertEqual(result[1]['order_state'], 'none')
            call.assert_not_called()
        report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
        self.assertIsNotNone(report['user_id'])
        self.assertEqual(report['reporter'], data['reporter'])
        self.assertEqual(report['answers'], data['answers'])

    def test_manual_orders_for_every_nonautomatic_reporting_topic(self):
        cookie, csrf = self.elevated()
        forms = self.request('/api/reporting/public')[1]['forms']
        manual = [form for form in forms if form['workflow'] == 'she']
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', return_value={'id': 'WO-topic'}) as create:
            for form in manual:
                with self.subTest(topic=form['title']):
                    saved = self.request('/api/reporting/submit', 'POST', self.payload(form['id']))[1]
                    report_id = int(saved['reference'].split('-')[1])
                    path = f'/api/reporting/reports/{report_id}/issue-order'
                    result = self.request(path, 'POST', {}, cookie, csrf)
                    self.assertEqual(result[0], 200)
                    self.assertEqual(result[1]['order_state'], 'issued')
                    self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 409)
            self.assertEqual(create.call_count, len(manual))
            self.assertEqual(self.photo_upload.call_count, len(manual))

    def test_order_photo_failure_retry_and_existing_order_repair(self):
        cookie, csrf = self.elevated()
        data = self.payload(1)
        data['photos'] *= 3
        self.photo_upload.side_effect = [[], CmmsError(502, 'Photo transfer timed out')]
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', return_value={'id': 'WO-photos'}) as create:
            result = self.request('/api/reporting/submit', 'POST', data)[1]
            self.assertEqual(result['order_state'], 'issued')
            report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
            self.assertEqual(report['order_photo_state'], 'failed')
            self.assertIn('timed out', report['order_photo_error'])
            timed_out_name = self.photo_upload.call_args.args[2]
            self.remote_order.return_value = {'attachments': [{'originalName': timed_out_name, 'kind': 'issue'}]}
            self.photo_upload.side_effect = None
            path = '/api/reporting/reports/1/sync-order-photos'
            self.assertEqual(self.request(path, 'POST', {}, cookie)[0], 403)
            self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 200)
            self.assertEqual(create.call_count, 1)
            # First photo stays saved, second reconciles remotely, third alone is uploaded.
            self.assertEqual(self.photo_upload.call_count, 3)
            args = self.photo_upload.call_args.args
            self.assertEqual(args[:2], ('WO-photos', 'port-klang'))
            self.assertEqual(args[4], base64.b64decode(data['photos'][2]['content']))
            self.assertEqual(args[-2:], ('she', 'issue'))
            self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 200)
            self.assertEqual(self.photo_upload.call_count, 3)
            report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
            self.assertEqual(report['order_photo_state'], 'synced')
            # An older linked report has no sync row. Copy to its existing order.
            with server.database() as db:
                db.execute('DELETE FROM finding_order_photos WHERE report_id=1')
            self.remote_order.return_value = {'attachments': []}
            self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 200)
            self.assertEqual(create.call_count, 1)
            self.assertEqual(self.photo_upload.call_count, 6)
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE username='admin'")
        self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 403)

    def test_cmms_photo_size_conversion_preserves_small_originals(self):
        from io import BytesIO
        from PIL import Image
        original = b'\x89PNG\r\n\x1a\n'
        self.assertEqual(reporting.cmms_photo(original, 'image/png', 'small.png'), (original, 'image/png', 'small.png'))
        output = BytesIO()
        Image.new('RGB', (1800, 1800), '#336644').save(output, format='PNG', compress_level=0)
        large = output.getvalue()
        self.assertGreater(len(large), 8 * 1024 * 1024)
        content, mime, filename = reporting.cmms_photo(large, 'image/png', 'large.png')
        self.assertLess(len(content), 8 * 1024 * 1024)
        self.assertEqual((mime, filename), ('image/jpeg', 'large.jpg'))
        self.assertTrue(content.startswith(b'\xff\xd8\xff'))

    def test_automatic_photo_catch_up_and_retry_cooldown(self):
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', return_value={'id': 'WO-old'}) as create:
            self.request('/api/reporting/submit', 'POST', self.payload(1))
            self.request('/api/reporting/submit', 'POST', self.payload(2))
            with server.database() as db:
                db.execute('DELETE FROM finding_order_photos')
            self.photo_upload.reset_mock()
            self.photo_upload.side_effect = CmmsError(502, 'CMMS offline')
            reporting.sync_pending_order_photos(server.database)
            self.assertEqual(self.photo_upload.call_count, 1)
            with server.database() as db:
                sync = db.execute('SELECT * FROM finding_order_photos').fetchone()
                self.assertEqual(sync['state'], 'failed')
                started = sync['started_at']
                self.assertEqual(db.execute('SELECT COUNT(*) FROM finding_order_photos').fetchone()[0], 1)
            reporting.sync_pending_order_photos(server.database)
            self.assertEqual(self.photo_upload.call_count, 1)
            self.photo_upload.side_effect = None
            with patch.object(reporting.time, 'time', return_value=started + 301):
                reporting.sync_pending_order_photos(server.database)
            self.assertEqual(self.photo_upload.call_count, 2)
            reporting.sync_pending_order_photos(server.database)
            self.assertEqual(self.photo_upload.call_count, 2)
            # Recover a transfer interrupted by a restart after its lease expires.
            with server.database() as db:
                db.execute("UPDATE finding_order_photos SET state='sending',started_at=0,uploaded_json='[]'")
            reporting.sync_pending_order_photos(server.database)
            self.assertEqual(self.photo_upload.call_count, 3)
            self.assertEqual(create.call_count, 1)
            self.assertEqual(self.photo_upload.call_args.args[0], 'WO-old')

    def test_linked_uncertain_order_copies_photos_and_active_copy_is_not_repeated(self):
        cookie, csrf = self.elevated()
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', side_effect=CmmsError(502, 'Timed out')) as create:
            self.assertEqual(self.request('/api/reporting/submit', 'POST', self.payload(1))[1]['order_state'], 'uncertain')
            self.remote_order.return_value = {'id': 'WO-found', 'type': 'kaizen', 'title': 'SHE-000001 Water leakage', 'attachments': []}
            path = '/api/reporting/reports/1'
            self.assertEqual(self.request(path + '/link-order', 'POST', {'order_id': 'WO-found'}, cookie, csrf)[0], 200)
            self.photo_upload.assert_called_once()
            self.assertEqual(self.photo_upload.call_args.args[0], 'WO-found')
            self.assertEqual(create.call_count, 1)
            with server.database() as db:
                db.execute("UPDATE finding_order_photos SET state='sending',uploaded_json='[]',started_at=? WHERE report_id=1", (int(reporting.time.time()),))
            self.assertEqual(self.request(path + '/sync-order-photos', 'POST', {}, cookie, csrf)[0], 200)
            self.assertEqual(self.photo_upload.call_count, 1)
            with server.database() as db:
                db.execute("UPDATE finding_order_photos SET started_at=0 WHERE report_id=1")
            self.assertEqual(self.request(path + '/sync-order-photos', 'POST', {}, cookie, csrf)[0], 200)
            self.assertEqual(self.photo_upload.call_count, 2)

    def test_hiyari_executive_receives_and_issues_order_once(self):
        cookie, csrf = self.elevated()
        data = self.payload(9)
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', return_value={'id': 'WO-HH'}) as call:
            saved = self.request('/api/reporting/submit', 'POST', data)[1]
            self.assertEqual(saved['order_state'], 'none')
            call.assert_not_called()
            notifications = self.request('/api/reporting/notifications', cookie=cookie)[1]
            self.assertEqual(notifications['unread'], 1)
            self.assertEqual(notifications['reports'][0]['reference'], saved['reference'])
            path = '/api/reporting/reports/1/issue-order'
            self.assertEqual(self.request(path, 'POST', {}, cookie)[0], 403)
            result = self.request(path, 'POST', {}, cookie, csrf)
            self.assertEqual(result[0], 200)
            self.assertEqual(result[1]['order_id'], 'WO-HH')
            payload = call.call_args.args[2]
            self.assertEqual(payload['type'], 'kaizen')
            self.assertEqual(payload['reportedByName'], data['reporter'])
            self.assertEqual(payload['responsibleDepartment'], 'SHE')
            self.assertEqual(call.call_args.args[3], data['plant'])
            for value in (saved['reference'], data['location'], data['contact'], *data['answers'].values()):
                self.assertIn(value, payload['issueDescription'])
            self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 409)
            self.assertEqual(call.call_count, 1)
        report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
        self.assertEqual(report['order_state'], 'issued')
        self.assertEqual(report['order_photo_state'], 'synced')
        self.photo_upload.assert_called_once()
        self.assertEqual(report['updates'][0]['actor'], 'Admin User')

    def test_hiyari_manual_order_permissions_and_scope(self):
        cookie, csrf = self.elevated('user')
        self.request('/api/reporting/submit', 'POST', self.payload(9))
        path = '/api/reporting/reports/1/issue-order'
        with patch.object(reporting.bridge, 'call') as call:
            self.assertEqual(self.request(path, 'POST', {}, cookie, csrf)[0], 403)
            with server.database() as db:
                db.execute("UPDATE users SET role='admin' WHERE username='admin'")
            self.request('/api/reporting/submit', 'POST', self.payload(2))
            self.assertEqual(self.request('/api/reporting/reports/2/issue-order', 'POST', {}, cookie, csrf)[0], 200)
            self.assertEqual(self.request('/api/reporting/reports/999/issue-order', 'POST', {}, cookie, csrf)[0], 404)
            call.assert_not_called()

    def test_hiyari_manual_order_failure_retry_and_uncertain_link(self):
        cookie, csrf = self.elevated()
        self.request('/api/reporting/submit', 'POST', self.payload(9))
        path = '/api/reporting/reports/1'
        with patch.object(reporting.bridge, 'identity', side_effect=CmmsError(503, 'Not configured')):
            result = self.request(path + '/issue-order', 'POST', {}, cookie, csrf)
        self.assertEqual(result[1]['order_state'], 'failed')
        self.assertEqual(self.request(path + '/issue-order', 'POST', {}, cookie, csrf)[0], 409)
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', side_effect=CmmsError(502, 'Timed out')) as call:
            self.assertEqual(self.request(path + '/retry-order', 'POST', {}, cookie, csrf)[1]['order_state'], 'uncertain')
            self.assertEqual(self.request(path + '/issue-order', 'POST', {}, cookie, csrf)[0], 409)
            self.assertEqual(self.request(path + '/retry-order', 'POST', {}, cookie, csrf)[0], 409)
            self.assertEqual(call.call_count, 1)
        with patch.object(reporting.bridge, 'she_order', return_value={'id': 'WO-HH', 'type': 'kaizen', 'title': 'SHE-000001 Hiyari Hatto'}):
            self.assertEqual(self.request(path + '/link-order', 'POST', {'order_id': 'WO-HH'}, cookie, csrf)[0], 200)

    def test_cmms_failure_saved_retry_and_ambiguous_order_never_retried(self):
        cookie, csrf = self.elevated()
        with patch.object(reporting.bridge, 'identity', side_effect=CmmsError(503, 'Not configured')):
            result = self.request('/api/reporting/submit', 'POST', self.payload(1))
        self.assertEqual(result[0], 201)
        self.assertEqual(result[1]['order_state'], 'failed')
        with patch.object(reporting.bridge, 'identity', return_value={'id': 'she'}), patch.object(reporting.bridge, 'call', side_effect=CmmsError(502, 'Timed out')) as call:
            self.assertEqual(self.request('/api/reporting/reports/1/retry-order', 'POST', {}, cookie, csrf)[1]['order_state'], 'uncertain')
            self.assertEqual(self.request('/api/reporting/reports/1/retry-order', 'POST', {}, cookie, csrf)[0], 409)
            self.assertEqual(call.call_count, 1)
        with patch.object(reporting.bridge, 'she_order', return_value={'id':'WO-1','type':'kaizen','title':'SHE-000001 Water leakage'}):
            self.assertEqual(self.request('/api/reporting/reports/1/link-order','POST',{'order_id':'WO-1'},cookie,csrf)[0],200)

    def test_executive_form_edit_delete_snapshot_and_action_history(self):
        cookie, csrf = self.elevated()
        original = self.payload()
        self.request('/api/reporting/submit', 'POST', original)
        form = self.request('/api/reporting/forms', cookie=cookie)[1]['forms'][1]
        form['title'] = 'Updated oil spill form'
        self.assertEqual(self.request('/api/reporting/forms/2', 'PATCH', form, cookie, csrf)[0], 200)
        self.assertEqual(self.request('/api/reporting/forms/2', 'PATCH', form, cookie, csrf)[0], 409)
        self.assertEqual(self.request('/api/reporting/submit', 'POST', {**original, 'request_key':str(uuid.uuid4())})[0], 409)
        report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
        self.assertEqual(report['snapshot']['title'], 'Oil / chemical spillage')
        self.assertEqual(self.request('/api/reporting/reports/1/updates', 'POST', {'revision':1,'status':'in_progress','note':'Assigned clean-up to SHE.'}, cookie, csrf)[0], 200)
        self.assertEqual(self.request('/api/reporting/reports/1/updates', 'POST', {'revision':1,'status':'closed','note':'Stale update'}, cookie, csrf)[0], 409)
        self.assertEqual(self.request('/api/reporting/forms/2/delete', 'POST', {'revision':2}, cookie, csrf)[0], 200)
        server.init_db()
        self.assertNotIn(2, [f['id'] for f in self.request('/api/reporting/public')[1]['forms']])
        report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
        self.assertEqual(report['updates'][0]['actor'], 'Admin User')
        self.assertEqual(report['status'], 'in_progress')
        self.assertEqual(report['snapshot']['title'], 'Oil / chemical spillage')
        form.pop('revision')
        self.assertEqual(self.request('/api/reporting/forms', 'POST', form, cookie, csrf)[0], 201)

    def test_operators_read_all_reports_but_cannot_manage_forms_or_followup(self):
        cookie, csrf = self.elevated('user')
        self.assertEqual(self.request('/api/reporting/submit', 'POST', self.payload())[0], 201)
        self.assertEqual(self.request('/api/reporting/forms', cookie=cookie)[0], 403)
        self.assertEqual(self.request('/api/reporting/reports', cookie=cookie)[0], 200)
        report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
        self.assertIsNone(report['user_id'])
        self.assertEqual(report['reporter'], 'Guest Person')
        self.assertEqual(self.request('/api/reporting/reports/1/updates', 'POST', {'revision':1,'status':'closed','note':'Operator action'}, cookie, csrf)[0], 403)
        self.assertEqual(self.request('/api/reporting/reports/1/retry-order', 'POST', {}, cookie, csrf)[0], 403)
        self.assertEqual(self.request('/api/reporting/reports/1/link-order', 'POST', {'order_id':'WO-1'}, cookie, csrf)[0], 403)
        self.assertEqual(self.request('/api/reporting/forms', 'POST', {}, cookie, csrf)[0], 403)
        self.assertEqual(self.request('/api/reporting/forms/1/delete', 'POST', {'revision':1}, cookie, csrf)[0], 403)

    def test_photo_evidence_and_custom_required_choice_answers(self):
        cookie, csrf = self.elevated()
        form = dict(title='Waste bin check', description='Check segregation', group='environment', icon='recycle', workflow='she',
                    questions=[dict(id='bin', label='Bin colour', type='select', required=True, options=['Blue', 'Yellow'])])
        form_id = self.request('/api/reporting/forms', 'POST', form, cookie, csrf)[1]['id']
        data = self.payload(form_id)
        data['answers'] = {'bin': 'Invalid choice'}
        self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 400)
        data['answers'] = {'bin':'Blue'}
        photo = dict(name='Finding.png', mime='image/png', content=base64.b64encode(b'\x89PNG\r\n\x1a\n').decode())
        data['photos'] = [{**photo, 'content':base64.b64encode(b'not an image').decode()}]
        self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 400)
        data['photos'] = [photo]
        self.assertEqual(self.request('/api/reporting/submit', 'POST', data)[0], 201)
        report = self.request('/api/reporting/reports/1', cookie=cookie)[1]['report']
        self.assertEqual(report['photos'][0]['content'], photo['content'])
        self.assertEqual(self.request('/api/reporting/reports/1')[0], 401)
        listed = self.request('/api/reporting/reports', cookie=cookie)[1]['reports'][0]
        self.assertNotIn('photos', listed)


class OrderPhotoWorkerTests(unittest.TestCase):
    def test_worker_runs_immediately_and_recovers_after_an_error(self):
        stop = Mock()
        stop.is_set.return_value = False
        stop.wait.side_effect = [False, True]
        database = Mock()
        with patch.object(type(reporting.bridge), 'configured', new_callable=PropertyMock, return_value=True), patch.object(reporting, 'sync_pending_order_photos', side_effect=[RuntimeError('temporary'), None]) as sync, self.assertLogs(reporting.LOG, level='ERROR'):
            reporting.run_order_photo_sync(database, stop)
        self.assertEqual(sync.call_count, 2)
        sync.assert_called_with(database, stop)
        self.assertEqual(stop.wait.call_args_list[0].args, (60,))

    def test_worker_waits_when_cmms_is_not_configured(self):
        stop = Mock()
        stop.is_set.return_value = False
        stop.wait.return_value = True
        with patch.object(type(reporting.bridge), 'configured', new_callable=PropertyMock, return_value=False), patch.object(reporting, 'sync_pending_order_photos') as sync:
            reporting.run_order_photo_sync(Mock(), stop)
        sync.assert_not_called()
        stop.wait.assert_called_once_with(60)

    def test_server_starts_and_stops_automatic_photo_worker(self):
        with patch.object(server.sys, 'argv', ['server.py']), patch.object(server, 'init_db') as init, patch.object(server, 'ThreadingHTTPServer') as http, patch.object(server, 'Thread') as thread:
            server.main()
        init.assert_called_once()
        self.assertEqual(thread.call_args.kwargs['target'], reporting.run_order_photo_sync)
        database, stop = thread.call_args.kwargs['args']
        self.assertIs(database, server.database)
        self.assertTrue(stop.is_set())
        self.assertTrue(thread.call_args.kwargs['daemon'])
        thread.return_value.start.assert_called_once()
        http.return_value.serve_forever.assert_called_once()
        http.return_value.server_close.assert_called_once()
        thread.return_value.join.assert_called_once_with(timeout=1)


if __name__ == '__main__':
    unittest.main()
