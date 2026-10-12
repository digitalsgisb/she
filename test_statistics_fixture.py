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
if __name__ == '__main__': print(json.dumps(dict(red=s.build(red,selection,'red-tag'),environment=dict(s.build(env,selection,'environment'),group='environment',group_label='Environment'))))
