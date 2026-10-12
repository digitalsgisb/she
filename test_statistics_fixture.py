import json
import she_statistics as s
red=[]
for i in range(28):
    red.append(dict(date='2026-10-'+str(1+i%20).zfill(2),section=['FG Store','Mini Forming','Maintenance','Macro'][i%4],pic=['Fareez','Abu','Shahmy','Aman'][i%4],status=['Open','In progress',s.REVIEW,'Resolved','Closed'][i%5],rank=['A','B','C'][i%3],stop=['Immediate stop','Planned stop','No stop'][i%3],assigned_user_id=3))
env=[]
for i in range(35):
    env.append(dict(date='2026-10-'+str(1+i%20).zfill(2),category=['Water leakage','Oil / chemical spillage','Waste segregation issue','Equipment leakage'][i%4],status=['Open','In progress','Resolved','Closed'][i%4],plant=['Port Klang','Sendayan'][i%2],location=['Production line','Store','Maintenance'][i%3],area='Environment',order=['SHE review','Work order issued','Work order needs retry'][i%3]))
for rows in [red,env]: rows.append({**rows[0], 'date':'2026-09-29'})
selection=s.period({'month':['2026-10']})
def patrol_fixture():
    import sqlite3
    from datetime import datetime
    db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
    db.execute('CREATE TABLE patrols(id INTEGER PRIMARY KEY,inspector_name TEXT,answers_json TEXT,rating INTEGER,created_at INTEGER,template_json TEXT,followup_status TEXT,completed INTEGER)')
    for i in range(20):
        answers={'general_0':'not_ok' if i%3 else 'ok','general_1':'ok','ppe_0':'na'}
        db.execute('INSERT INTO patrols(inspector_name,answers_json,rating,created_at,template_json,followup_status,completed) VALUES(?,?,?,?,?,?,1)',(['Sara','Aman'][i%2],json.dumps(answers),1+i%3,int(datetime(2026,10,1+i%20,12,tzinfo=s.TZ).timestamp()),'null',['open','action_taken','resolved'][i%3]))
    result=s.patrols(db,selection);db.close();return result

if __name__ == '__main__': print(json.dumps(dict(patrol=patrol_fixture(),red=s.build(red,selection,'red-tag'),environment=dict(s.build(env,selection,'environment'),group='environment',group_label='Environment'))))
