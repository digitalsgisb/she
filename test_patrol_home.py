"""Patrol overview counts, local-day boundaries and per-user visibility."""
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import server
from test_server import AccountFlowTests


class PatrolHomeTests(unittest.TestCase):
    setUp = AccountFlowTests.setUp
    tearDown = AccountFlowTests.tearDown
    request = AccountFlowTests.request
    first_admin = AccountFlowTests.first_admin
    login = AccountFlowTests.login

    def prepare(self):
        self.first_admin()
        self.cookie, _ = self.login('admin', 'AdminPassword123!')
        today = datetime(2026, 11, 5, tzinfo=timezone(timedelta(hours=8)))
        start = int(today.timestamp())
        with server.database() as db:
            db.execute("INSERT INTO users(username,display_name,password_hash,role,active,created_at) SELECT 'other','Other inspector',password_hash,'user',1,1 FROM users WHERE id=1")
            for user_id, when, status, completed in [(1,start+60,'open',1),(1,start-1,'action_taken',1),(1,int(today.replace(month=10,day=31).timestamp()),'resolved',1),(2,start+120,'open',1),(1,start+180,'open',0)]:
                db.execute('INSERT INTO patrols(user_id,inspector_name,answers_json,rating,remarks,created_at,followup_status,completed) VALUES(?,?,?,2,?,?,?,?)',
                           (user_id, f'Inspector {user_id}', json.dumps({'check':'not_ok'}), 'Needs action', when, status, completed))
        self.clock = self.enterContext(patch.object(server, 'datetime'))
        self.clock.now.return_value = today + timedelta(minutes=30)

    def test_team_summary_uses_malaysian_day_and_excludes_pending_submissions(self):
        self.prepare()
        status, data, _ = self.request('/api/patrols/summary', cookie=self.cookie)
        self.assertEqual(status, 200)
        self.assertEqual(data['date'], '2026-11-05')
        self.assertEqual(data['scope'], 'team')
        self.assertEqual(data['counts'], dict(today=2,month=3,open=2,awaiting_review=1))
        self.assertEqual(len(data['recent']), 4)
        self.assertTrue(all(row['findings']==1 for row in data['recent']))
        self.assertEqual([day['count'] for day in data['week']], [0,1,0,0,0,1,2])

    def test_regular_users_only_receive_their_own_summary(self):
        self.prepare()
        with server.database() as db:
            db.execute("UPDATE users SET role='user' WHERE id=1")
        data = self.request('/api/patrols/summary', cookie=self.cookie)[1]
        self.assertEqual(data['scope'], 'mine')
        self.assertEqual(data['counts'], dict(today=1,month=2,open=1,awaiting_review=1))
        self.assertEqual(len(data['recent']), 3)
        self.assertEqual(sum(day['count'] for day in data['week']), 3)
        self.assertTrue(all(row['inspector']=='Inspector 1' for row in data['recent']))

    def test_empty_summary_and_authentication(self):
        self.assertEqual(self.request('/api/patrols/summary')[0], 401)
        self.first_admin()
        cookie, _ = self.login('admin', 'AdminPassword123!')
        data = self.request('/api/patrols/summary', cookie=cookie)[1]
        self.assertEqual(data['counts'], dict(today=0,month=0,open=0,awaiting_review=0))
        self.assertEqual(data['recent'], [])
        self.assertEqual(len(data['week']), 7)
        self.assertTrue(all(day['count']==0 for day in data['week']))


if __name__ == '__main__':
    unittest.main()
