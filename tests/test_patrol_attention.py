"""Older unresolved patrols stay actionable, with photos and original context."""
import json
import unittest
from test_patrol_home import PatrolHomeTests
import server


class PatrolAttentionTests(unittest.TestCase):
    setUp=PatrolHomeTests.setUp
    tearDown=PatrolHomeTests.tearDown
    request=PatrolHomeTests.request
    first_admin=PatrolHomeTests.first_admin
    login=PatrolHomeTests.login
    prepare=PatrolHomeTests.prepare

    def test_yesterdays_issue_keeps_context_and_disappears_only_after_resolution(self):
        self.prepare()
        cookie,csrf=self.login('admin','AdminPassword123!')
        identifier='b'*32
        with server.database() as db:
            original=db.execute('SELECT created_at FROM patrols WHERE id=2').fetchone()[0]
            db.execute("INSERT INTO patrol_attachments(id,patrol_id,filename,mime_type,size,created_at) VALUES(?,2,'issue.png','image/png',8,1)",(identifier,))
        server.patrol_files().mkdir(exist_ok=True)
        (server.patrol_files()/identifier).write_bytes(b'\x89PNG\r\n\x1a\n')
        summary=self.request('/api/patrols/summary',cookie=cookie)[1]
        item=next(row for row in summary['attention'] if row['id']==2)
        self.assertEqual(item['created_at'],original)
        self.assertEqual(item['issues'][0]['label'],'Check')
        self.assertEqual(item['thumbnail_url'],f'/api/patrols/2/attachments/{identifier}')
        self.assertEqual(summary['attention_total'],3)
        status,result,_=self.request('/api/patrols/2/updates','POST',{'message':'Inspected and verified the repair.','status':'resolved','expected_status':'action_taken'},cookie,csrf)
        self.assertEqual(status,201,result)
        summary=self.request('/api/patrols/summary',cookie=cookie)[1]
        self.assertNotIn(2,[row['id'] for row in summary['attention']])
        detail=self.request('/api/patrols/2',cookie=cookie)[1]['patrol']
        self.assertEqual(detail['created_at'],original)
        self.assertEqual(detail['updates'][0]['message'],'Inspected and verified the repair.')
        self.assertTrue(detail['issues'])

    def test_attention_includes_old_items_and_excludes_clear_or_text_only_not_ok(self):
        self.prepare()
        with server.database() as db:
            template=json.dumps({'title':'Guard check','questions':[{'id':'guard','type':'status','label':'Machine guard secure?'},{'id':'note','type':'text','label':'Notes'}]})
            db.execute("INSERT INTO patrols(user_id,inspector_name,answers_json,rating,remarks,created_at,completed,template_json,item_remarks_json) VALUES(1,'Inspector','{\"guard\":\"not_ok\",\"note\":\"not_ok\"}',2,'',1,1,?,?)",(template,json.dumps({'guard':'Guard missing at line 2'})))
            old_id=db.execute('SELECT last_insert_rowid()').fetchone()[0]
            db.execute("INSERT INTO patrols(user_id,inspector_name,answers_json,rating,remarks,created_at,completed) VALUES(1,'Inspector','{\"check\":\"ok\"}',3,'',3,1)")
            clear_id=db.execute('SELECT last_insert_rowid()').fetchone()[0]
        summary=self.request('/api/patrols/summary',cookie=self.cookie)[1]
        old=next(row for row in summary['attention'] if row['id']==old_id)
        self.assertEqual(old['findings'],1)
        self.assertEqual(old['issues'][0]['label'],'Machine guard secure?')
        self.assertEqual(old['issues'][0]['remark'],'Guard missing at line 2')
        self.assertNotIn(clear_id,[row['id'] for row in summary['attention']])

    def test_all_history_pages_have_no_gaps_and_keep_owner_visibility(self):
        self.prepare()
        def pages(cookie):
            seen=[];cursor=None
            while True:
                path='/api/patrols?history=1&limit=2'+('&cursor='+cursor if cursor else '')
                status,data,_=self.request(path,cookie=cookie)
                self.assertEqual(status,200)
                seen.extend(row['id'] for row in data['patrols'])
                cursor=data['next_cursor']
                if not cursor:return seen
        self.assertEqual(set(pages(self.cookie)),{1,2,3,4})
        with server.database() as db:db.execute("UPDATE users SET role='user' WHERE id=1")
        self.assertEqual(set(pages(self.cookie)),{1,2,3})
        own=self.request('/api/patrols/summary',cookie=self.cookie)[1]
        self.assertEqual({row['id'] for row in own['attention']},{1,2})
        for query in ('cursor=invalid','limit=0','limit=1000','cursor=-1:2'):
            self.assertEqual(self.request('/api/patrols?history=1&'+query,cookie=self.cookie)[0],400)


if __name__=='__main__':unittest.main()
