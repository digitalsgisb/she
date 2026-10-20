"""Integration coverage for the five-dashboard addition and FR-SH-12 workflow."""
import json
import unittest
from urllib.request import urlopen
from test_server import AccountFlowTests
import server
import she_monitoring as monitoring


class MonitoringTests(unittest.TestCase):
    setUp = AccountFlowTests.setUp
    tearDown = AccountFlowTests.tearDown
    request = AccountFlowTests.request
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login

    def admin(self):
        self.first_admin()
        return self.login('admin', 'AdminPassword123!')

    def test_monthly_counts_missing_na_ifr_history_conflicts_and_permissions(self):
        cookie, csrf = self.admin()
        path = '/api/she-monitoring/accident'
        self.assertEqual(self.request(path)[0],401)
        result=self.request(path+'?year=2026',cookie=cookie)[1]
        self.assertIsNone(result['months'][0]['total'])
        counts={s:0 for s in monitoring.SECTIONS};counts['Maintenance']=2
        data=dict(month='2026-03', revision=0, counts=counts,off_job=1,man_hours=500000,note='Checked monthly sheet')
        self.assertEqual(self.request(path,'POST',data,cookie,csrf)[0],200)
        self.assertEqual(self.request(path,'POST',data,cookie,csrf)[0],409)
        row=self.request(path+'?year=2026',cookie=cookie)[1]['months'][2]
        self.assertEqual(row['total'],2);self.assertEqual(row['ifr'],4)
        self.assertEqual(self.request(path,'POST',{**data,'revision':1,'counts':{**counts,'Store':-1}},cookie,csrf)[0],400)
        self.assertEqual(self.request(path,'POST',{**data,'revision':1,'counts':{**counts,'Store':True}},cookie,csrf)[0],400)
        self.assertEqual(self.request(path,'POST',{**data,'revision':1,'counts':{**counts,'Store':'NA'}},cookie,csrf)[0],200)
        row=self.request(path+'?year=2026',cookie=cookie)[1]['months'][2]
        self.assertFalse(row['complete']);self.assertIsNone(row['ifr'])
        history=self.request(path+'?year=2026&history=2026-03',cookie=cookie)[1]['history']
        self.assertEqual(len(history),2);self.assertEqual(history[-1]['payload']['counts']['Store'],0)
        self.assertEqual(self.request(path+'?year=bad',cookie=cookie)[0],400)
        with server.database() as db:db.execute("UPDATE users SET feature_access='[\"reporting\"]' WHERE username='admin'");db.execute("UPDATE users SET role='executive' WHERE username='admin'")
        self.assertEqual(self.request(path,cookie=cookie)[0],403)
        self.assertEqual(self.request('/api/she-monitoring/compound?year=2026',cookie=cookie)[0],200)
        with server.database() as db:db.execute("UPDATE users SET role='user' WHERE username='admin'")
        self.assertEqual(self.request('/api/she-monitoring/compound',cookie=cookie)[0],403)

    def test_environment_categories_do_not_count_hiyari_or_kaizen(self):
        cookie,csrf=self.admin()
        for kind,counts in [('compound',{'Compound':1}),('environmental-findings',{c:0 for c in monitoring.ENV_CATEGORIES})]:
            data=dict(month='2026-08',revision=0,counts=counts,note='Source sheet')
            self.assertEqual(self.request('/api/she-monitoring/'+kind,'POST',data,cookie,csrf)[0],200)
            result=self.request('/api/she-monitoring/'+kind+'?year=2026',cookie=cookie)[1]
            self.assertEqual(result['reported_months'],1)
            self.assertEqual(result['months'][7]['total'],sum(counts.values()))

    def test_hiyari_template_review_rank_a_closure_and_summary(self):
        cookie,csrf=self.admin()
        public=self.request('/api/reporting/public')[1]
        form=next(f for f in public['forms'] if f['group']=='hiyari-hatto')
        answers={q['id']:q['options'][0] if q['options'] else '2026-10-19' if q['type']=='date' else 'Example' for q in form['questions']}
        answers.update(category='Near Miss',section='Maintenance',stop='5')
        data=dict(token=public['token'],request_key='12345678-1234-1234-1234-123456789012',form_id=form['id'],revision=form['revision'],reporter='Team member',contact='',plant='port-klang',location='Line 2',answers=answers,photos=[])
        self.assertEqual(self.request('/api/reporting/submit','POST',data)[0],201)
        review={k:'Reviewed person' for k in monitoring.REVIEW_FIELDS};review.update(rank='A',stop='5',target_date='2026-10-25',manager='')
        path='/api/reporting/reports/1/hiyari-review'
        self.assertEqual(self.request(path,'POST',dict(revision=1,status='closed',review=review),cookie,csrf)[0],400)
        self.assertEqual(self.request('/api/reporting/reports/1/updates','POST',dict(revision=1,status='closed',note='Bypass'),cookie,csrf)[0],400)
        review['manager']='Manager name'
        self.assertEqual(self.request(path,'POST',dict(revision=1,status='closed',review=review),cookie,csrf)[0],200)
        self.assertEqual(self.request(path,'POST',dict(revision=1,status='closed',review=review),cookie,csrf)[0],409)
        result=self.request('/api/she-monitoring/hiyari?year=2026',cookie=cookie)[1]
        self.assertEqual((result['total'],result['closed'],result['completion']),(1,1,100))
        self.assertEqual(result['categories']['rank'],{'A':1})
        detail=self.request('/api/reporting/reports/1',cookie=cookie)[1]['report']
        self.assertEqual(detail['hiyari_review']['manager'],'Manager name');self.assertEqual(len(detail['updates']),1)
        with urlopen(self.base+'/templates/hiyari-hatto.pdf') as response:
            self.assertEqual(response.status,200)
            self.assertTrue(response.read().startswith(b'%PDF'))

    def test_template_migration_preserves_custom_forms_and_report_snapshots(self):
        with server.database() as db:
            before=db.execute('SELECT COUNT(*) FROM reporting_forms').fetchone()[0]
            monitoring.init(db)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reporting_forms').fetchone()[0],before)
            db.execute("DELETE FROM she_migrations WHERE name='fr-sh-12-v1'")
            custom=monitoring.hiyari_template();custom['title']='My custom form'
            db.execute('UPDATE reporting_forms SET definition_json=? WHERE id=9',(json.dumps(custom),))
            monitoring.init(db)
            self.assertEqual(json.loads(db.execute('SELECT definition_json FROM reporting_forms WHERE id=9').fetchone()[0])['title'],'My custom form')
            self.assertEqual(db.execute('SELECT COUNT(*) FROM reporting_forms').fetchone()[0],before+1)


if __name__=='__main__':unittest.main()
