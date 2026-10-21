"""Executive deletion: permissions, concurrency, cleanup and printed references."""
import unittest
import server
import test_redtag as fixtures


class RedTagDeleteTests(unittest.TestCase):
    setUp=fixtures.GenbaTests.setUp
    tearDown=fixtures.GenbaTests.tearDown
    first_admin=fixtures.GenbaTests.first_admin
    login=fixtures.GenbaTests.login
    request=fixtures.GenbaTests.request
    setup_accounts=fixtures.GenbaTests.setup_accounts
    payload=fixtures.GenbaTests.payload
    create=fixtures.GenbaTests.create

    def test_executive_delete_cleans_evidence_and_reserves_reference(self):
        self.setup_accounts()
        original=self.payload()
        finding=self.create(original)
        executive,csrf=self.login('executive','PasswordForTest123!')
        path='/api/red-tags/'+str(finding['id'])
        self.assertEqual(self.request(path,'PATCH',dict(status='In progress',note='Work started',revision=1,
            after_photo=fixtures.PHOTO),self.pic,self.pic_csrf)[0],200)
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),executive,csrf)[0],409)
        self.assertEqual(self.request(path,cookie=executive)[0],200)
        self.assertEqual(self.request(path,'DELETE',dict(revision=2),executive,csrf)[0],200)
        for target in (path,path+'/photo',path+'/updates/1/photo'):
            self.assertEqual(self.request(target,cookie=executive)[0],404)
        self.assertEqual(self.request('/api/red-tags?date=2026-10-13',cookie=executive)[1]['findings'],[])
        self.assertEqual(self.request('/api/red-tags?inbox=1',cookie=self.pic)[1]['findings'],[])
        for target in ('/api/red-tags/export?date=2026-10-13','/api/red-tags/print?date=2026-10-13'):
            self.assertNotIn(finding['red_tag_id'],self.request(target,cookie=executive)[1])
        self.assertEqual(self.request('/api/red-tags/statistics?month=2026-10',cookie=executive)[1]['summary']['total'],0)
        with server.database() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM redtag_updates').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT deleted_by FROM redtag_deletions').fetchone()[0],self.exec_id)
            self.assertFalse(db.execute('PRAGMA foreign_key_check').fetchall())
        self.assertEqual(self.request('/api/red-tags','POST',original,self.admin,self.csrf)[0],409)
        new=self.create()
        self.assertEqual(new['red_tag_id'],'RT2610-002')
        self.assertGreater(new['id'],finding['id'])

    def test_delete_requires_privileged_role_csrf_and_same_origin(self):
        self.setup_accounts()
        finding=self.create()
        path='/api/red-tags/'+str(finding['id'])
        executive,csrf=self.login('executive','PasswordForTest123!')
        self.assertEqual(self.request(path,'DELETE',dict(revision=1))[0],401)
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),executive)[0],403)
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),executive,csrf,origin='https://other.example')[0],403)
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),self.pic,self.pic_csrf)[0],403)
        self.request('/api/users','POST',dict(username='committee',display_name='Committee',role='safety_committee',
            password='CommitteePassword123!'),self.admin,self.csrf)
        committee,committee_csrf=self.login('committee','CommitteePassword123!')
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),committee,committee_csrf)[0],403)
        self.assertEqual(self.request(path,'DELETE',{},executive,csrf)[0],409)
        self.assertEqual(self.request(path,cookie=executive)[0],200)

    def test_admin_can_delete_closed_finding_and_unknown_tag_returns_404(self):
        self.setup_accounts()
        data=self.payload();data['status']='Closed'
        finding=self.create(data)
        path='/api/red-tags/'+str(finding['id'])
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),self.admin,self.csrf)[0],200)
        self.assertEqual(self.request(path,'DELETE',dict(revision=1),self.admin,self.csrf)[0],404)
