"""Integration tests for public submissions, form ownership, history and CMMS recovery."""
import json
import base64
import uuid
import unittest
from unittest.mock import patch
import reporting
import server
from test_server import AccountFlowTests
from cmms_bridge import CmmsError


class ReportingTests(unittest.TestCase):
    setUp = AccountFlowTests.setUp
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

    def elevated(self, role='executive'):
        self.first_admin()
        with server.database() as db:
            db.execute('UPDATE users SET role=? WHERE username=?', (role, 'admin'))
        return self.login('admin', 'AdminPassword123!')

    def test_public_categories_privacy_tokens_origin_and_validation(self):
        public = self.request('/api/reporting/public')[1]
        self.assertEqual(len(public['forms']), 10)
        self.assertEqual({f['group'] for f in public['forms']}, set(reporting.GROUPS) - {'air-leak'})
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


if __name__ == '__main__':
    unittest.main()
