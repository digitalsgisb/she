/* Executive dashboards: semantic SVG charts, period filters, and compact summaries. */
const SHEStats = (() => {
  const palette=['#237d59','#d18c27','#3876ab','#9963a4','#df705b','#6a9690','#a1aa67','#697a94'];
  const stateColors={'Open':'#cf6657','In progress':'#d69a33','Awaiting verification':'#4782b8','Resolved':'#4e9a72','Closed':'#21654d','No findings':'#83b89f','OK':'#237d59','NOT OK':'#cf6657','N/A':'#7d8992','1 star':'#cf6657','2 stars':'#d69a33','3 stars':'#4e9a72'};
  const esc=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed=()=>currentUser && ['executive','admin'].includes(currentUser.role);
  const month=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit'}).format(new Date());
  const number=value=>Number(value||0).toLocaleString('en-MY');
  const empty=()=>'<div class="she-chart-empty">No findings in this period.</div>';
  const header=(title,note)=>'<div class="she-chart-heading"><h3>'+esc(title)+'</h3><p title="'+esc(note)+'">'+esc(note)+'</p></div>';
  function bucket(items,limit=8) {
    const nonzero=items.filter(x=>x.count>0);
    return nonzero.length<=limit?nonzero:[...nonzero.slice(0,limit-1),{label:'Other entries',count:nonzero.slice(limit-1).reduce((s,x)=>s+x.count,0)}];
  }
  function pie(items,title,note,states=false,unit='findings') {
    const rows=bucket(items),total=rows.reduce((s,x)=>s+x.count,0);
    if(!total)return '<article class="she-chart-card">'+header(title,note)+empty()+'</article>';
    let offset=0;const circumference=2*Math.PI*74;
    const rings=rows.map((row,index)=>{const length=row.count/total*circumference,color=states?stateColors[row.label]||palette[index%palette.length]:palette[index%palette.length];const ring='<circle cx="105" cy="105" r="74" fill="none" stroke="'+color+'" stroke-width="27" stroke-dasharray="'+length+' '+(circumference-length)+'" stroke-dashoffset="'+(-offset)+'" transform="rotate(-90 105 105)"><title>'+esc(row.label)+': '+row.count+'</title></circle>';offset+=length;return ring;}).join('');
    return '<article class="she-chart-card">'+header(title,note)+'<div class="she-pie-layout"><svg viewBox="0 0 210 210" role="img" aria-label="'+esc(title)+'"><title>'+esc(title)+'</title><desc>'+esc(rows.map(r=>r.label+': '+r.count).join(', '))+'</desc>'+rings+'<text x="105" y="103" text-anchor="middle" class="she-donut-total">'+number(total)+'</text><text x="105" y="125" text-anchor="middle" class="she-donut-label">'+esc(unit)+'</text></svg><ul class="she-chart-legend">'+rows.map((row,index)=>'<li><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="'+(states?stateColors[row.label]||palette[index%palette.length]:palette[index%palette.length])+'"/></svg><span>'+esc(row.label)+'</span><strong>'+number(row.count)+'</strong><small>'+Math.round(row.count/total*100)+'%</small></li>').join('')+'</ul></div></article>';
  }
  function bars(items,title,note,limit=8) {
    const rows=bucket(items,limit),max=Math.max(...rows.map(r=>r.count),1);
    return '<article class="she-chart-card">'+header(title,note)+(rows.length?'<ul class="she-bar-list">'+rows.map((r,index)=>'<li><div><span title="'+esc(r.label)+'">'+esc(r.label)+'</span><strong>'+number(r.count)+'</strong></div><svg viewBox="0 0 300 12" role="img" aria-label="'+esc(r.label)+': '+r.count+'"><rect width="300" height="12" rx="6" fill="#edf3ef"/><rect width="'+(r.count/max*300)+'" height="12" rx="6" fill="'+palette[index%palette.length]+'"/></svg></li>').join('')+'</ul>':empty())+'</article>';
  }
  function activity(data) {
    const points=data.points,total=points.reduce((s,p)=>s+p.count,0);
    if(!total)return '<article class="she-chart-card she-chart-wide">'+header(data.title,data.note)+empty()+'</article>';
    const width=430,height=210,left=38,bottom=176,top=20,max=Math.max(...points.map(p=>p.count),1),step=(width-left-12)/points.length;
    const marks=points.map((p,i)=>{const h=p.count/max*(bottom-top),x=left+i*step+step*.14;return '<rect x="'+x+'" y="'+(bottom-h)+'" width="'+Math.max(2,step*.72)+'" height="'+h+'" rx="2" fill="#298263"><title>'+esc(p.key)+': '+p.count+' '+esc(data.unit||'findings')+'</title></rect>';}).join('');
    const labels=points.map((p,i)=>i===0||i===points.length-1||points.length<=12||i%7===0?'<text x="'+(left+(i+.5)*step)+'" y="198" text-anchor="middle" class="she-axis-text">'+esc(p.label)+'</text>':'').join('');
    const rows=[0,...(max>1?[Math.ceil(max/2)]:[]),max];
    const grid=[...new Set(rows)].map(n=>{const y=bottom-n/max*(bottom-top);return '<line x1="'+left+'" x2="422" y1="'+y+'" y2="'+y+'" stroke="#e3ebe6"/><text x="28" y="'+(y+4)+'" text-anchor="end" class="she-axis-text">'+n+'</text>';}).join('');
    return '<article class="she-chart-card she-chart-wide">'+header(data.title,data.note)+'<svg class="she-activity-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+esc(data.title)+'"><title>'+esc(data.title)+'</title><desc>'+esc(points.map(p=>p.key+': '+p.count).join(', '))+'</desc>'+grid+marks+labels+'</svg><details class="she-chart-data"><summary>View chart values</summary><div class="she-table-scroll"><table><thead><tr><th>Date</th><th>Findings</th></tr></thead><tbody>'+points.map(p=>'<tr><td>'+esc(p.key)+'</td><td>'+number(p.count)+'</td></tr>').join('')+'</tbody></table></div></details></article>';
  }
  function metrics(data) {
    const s=data.summary,red=data.kind==='red-tag';
    if(data.kind==='patrol')return '<div class="she-metrics">'+[['Patrols completed',s.total],['With findings',s.with_findings],['NOT OK items',s.not_ok_items],['OK rate',s.ok_rate===null?'—':s.ok_rate+'%']].map(([label,value],i)=>'<div class="she-metric she-metric-'+i+'"><span>'+label+'</span><strong>'+esc(typeof value==='number'?number(value):value)+'</strong><small>'+esc(data.selection.label)+'</small></div>').join('')+'</div>';
    const rows=red?[['Findings recorded',s.total],['To do',s.to_do],['Awaiting verification',s.awaiting_review],['Resolved / closed',s.completed]]:[['Reports received',s.total],['To do',s.to_do],['Resolved / closed',s.completed],['Completion rate',s.completion_rate===null?'—':s.completion_rate+'%']];
    return '<div class="she-metrics">'+rows.map(([label,value],i)=>'<div class="she-metric she-metric-'+i+'"><span>'+esc(label)+'</span><strong>'+esc(typeof value==='number'?number(value):value)+'</strong><small>'+esc(data.selection.label)+'</small></div>').join('')+'</div>';
  }
  function workload(data) {
    const rows=data.pic_workload.slice(0,10);
    return '<article class="she-chart-card she-chart-wide">'+header('PIC follow-up','Top 10 section/PIC pairs by outstanding findings in this period')+(rows.length?'<div class="she-table-scroll"><table><thead><tr><th>Section / PIC</th><th>To do</th><th>Review</th><th>Completed</th><th>Total</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><strong>'+esc(r.pic)+'</strong><small>'+esc(r.section)+'</small></td><td>'+number(r.to_do)+'</td><td>'+number(r.awaiting_review)+'</td><td>'+number(r.completed)+'</td><td>'+number(r.total)+'</td></tr>').join('')+'</tbody></table></div>':empty())+(data.unassigned?'<p class="she-stat-note">'+number(data.unassigned)+' outstanding finding(s) have no linked PIC account.</p>':'')+'</article>';
  }
  function focus(data) {
    const kind=data.kind,s=data.backlog,red=kind==='red-tag',patrol=kind==='patrol';
    const status=pie(data.statuses,patrol?'Follow-up distribution':'Status distribution',patrol?'Current follow-up for completed patrols':'Current status of selected findings',true,patrol?'patrols':'findings');
    const distribution=patrol?bars(data.sections,'NOT OK items by section','Leading sections; remaining entries grouped',5):red?bars(data.sections,'Findings by section','Leading sections; remaining entries grouped',5):bars(data.categories,'Reports by topic','Leading topics; remaining entries grouped',5);
    const sections=patrol?[
      {id:'overview',label:'Overview',charts:status+distribution+activity(data.trend)},
      {id:'quality',label:'Inspection quality',charts:pie(data.answers,'Checklist results','Status questions only; excludes text and choices',true,'answers')+pie(data.ratings,'Overall ratings','Ratings on completed inspections',true,'patrols')},
      {id:'team',label:'Inspectors & checklists',charts:bars(data.inspectors,'Patrols by inspector','Completed inspections in this period')+bars(data.checklists,'Checklist use','Original checklist names at submission')}
    ]:red?[
      {id:'overview',label:'Overview',charts:status+distribution+activity(data.trend)},
      {id:'classification',label:'Rank & stop type',charts:pie(data.ranks,'Rank distribution','Ranks recorded during genba')+bars(data.stops,'Types of stop','Recorded stop classifications')},
      {id:'followup',label:'PIC follow-up',charts:workload(data)}
    ]:[
      {id:'overview',label:'Overview',charts:status+distribution+activity(data.trend)},
      {id:'locations',label:'Factories & locations',charts:pie(data.plants,'Reports by factory','Distribution across factories')+bars(data.locations,'Reported locations','Leading locations; remaining entries grouped')},
      {id:'orders',label:'Work order follow-up',charts:bars(data.work_orders,'Work order follow-up','SHE workflow; separate from CMMS job status')}
    ];
    const note=patrol?'Completed submissions only. Original NOT OK answers count as findings; OK rate excludes N/A.':'Current status of findings recorded during the selected period. Resolved / closed counts as completed.';
    return '<p class="she-stat-period">'+esc(patrol?'Safety patrol':red?'Red Tag':data.group_label)+' · '+esc(data.selection.label)+'</p>'+metrics(data)+'<div class="she-backlog"><span>'+(patrol?'Patrols needing follow-up':'Outstanding')+' · all dates</span><strong>'+number(s.outstanding)+'</strong><small>'+number(s.to_do)+(patrol?' open':' to do')+(red||patrol?' · '+number(s.awaiting_review)+' awaiting verification':'')+'</small></div><p class="she-stat-note">'+note+'</p><div class="she-chart-tabs" role="tablist" aria-label="Dashboard views">'+sections.map((section,index)=>'<button type="button" id="'+kind+'-tab-'+section.id+'" data-stat-tab="'+section.id+'" role="tab" aria-selected="'+(index===0)+'" aria-controls="'+kind+'-panel-'+section.id+'" tabindex="'+(index===0?'0':'-1')+'">'+section.label+'</button>').join('')+'</div><div class="she-chart-panels">'+sections.map((section,index)=>'<div id="'+kind+'-panel-'+section.id+'" class="she-charts-grid" data-stat-panel="'+section.id+'" role="tabpanel" aria-labelledby="'+kind+'-tab-'+section.id+'" tabindex="0" '+(index===0?'':'hidden')+'>'+section.charts+'</div>').join('')+'</div>';
  }
  function bindTabs(body,target) {
    const tabs=[...body.querySelectorAll('[data-stat-tab]')];
    const select=(key,focus=false)=>{
      target.dataset.activeStatisticsTab=key;
      tabs.forEach(tab=>{const selected=tab.dataset.statTab===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();});
      body.querySelectorAll('[data-stat-panel]').forEach(panel=>panel.hidden=panel.dataset.statPanel!==key);
    };
    tabs.forEach((tab,index)=>{
      tab.onclick=()=>select(tab.dataset.statTab);
      tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();select(tabs[next].dataset.statTab,true);};
    });
    select(tabs.some(t=>t.dataset.statTab===target.dataset.activeStatisticsTab)?target.dataset.activeStatisticsTab:'overview');
  }
  function endpoint(kind,selection) {
    return (kind==='patrol'?'/api/patrols/statistics':kind==='red-tag'?'/api/red-tags/statistics':'/api/reporting/statistics')+'?'+new URLSearchParams(selection);
  }
  function mount(target,kind) {
    if(!allowed()||!target)return;
    const selection={period:'month',month:month(),...(kind==='environment'?{group:'environment'}:{})};
    target.className='she-statistics';
    target.innerHTML='<div class="she-stat-heading"><div><h2>'+(kind==='patrol'?'Patrol statistics':kind==='red-tag'?'Red Tag statistics':'Environmental statistics')+'</h2></div><div class="she-stat-controls"><label>Period<select data-stat-period><option value="month">Month</option><option value="year">Year</option><option value="all">All dates</option></select></label><label data-stat-month-label>Month<input type="month" data-stat-month value="'+selection.month+'" min="2000-01" max="2099-12"></label>'+(kind==='environment'?'<label>Reporting area<select data-stat-group><option value="environment">Environment</option><option value="hiyari-hatto">Hiyari Hatto</option><option value="kaizen">Kaizen</option><option value="all">All areas</option></select></label>':'')+'<button type="button" class="secondary-button" data-stat-refresh>Refresh statistics</button></div></div><div data-stat-body aria-live="polite"></div>';
    const body=target.querySelector('[data-stat-body]');let version=0,inflight=false,lastData='';
    const load=async(quiet=false)=>{
      if(!target.isConnected||!allowed())return;
      const current=++version;inflight=true;
      if(!quiet)body.innerHTML='<p class="she-chart-empty" role="status">Loading statistics…</p>';
      try{const data=await api(endpoint(kind,selection));if(current===version&&target.isConnected&&allowed()){const serialized=JSON.stringify(data);if(!quiet||serialized!==lastData){body.innerHTML=focus(data);bindTabs(body,target);lastData=serialized;}}}
      catch(error){if(current===version&&target.isConnected)body.innerHTML='<p role="alert" class="form-error">'+esc(error.message)+'</p>';}
      finally{if(current===version)inflight=false;}
    };
    target.querySelector('[data-stat-period]').onchange=e=>{selection.period=e.target.value;const label=target.querySelector('[data-stat-month-label]'),input=target.querySelector('[data-stat-month]');label.firstChild.textContent=selection.period==='year'?'Year':selection.period==='all'?'Trend ending':'Month';input.type=selection.period==='year'?'number':'month';input.min=selection.period==='year'?'2000':'2000-01';input.max=selection.period==='year'?'2099':'2099-12';input.value=selection.period==='year'?selection.month.slice(0,4):selection.month;load();};
    target.querySelector('[data-stat-month]').onchange=e=>{if(e.target.value&&e.target.checkValidity()){selection.month=selection.period==='year'?e.target.value+'-'+selection.month.slice(5):e.target.value;load();}};
    target.querySelector('[data-stat-group]')?.addEventListener('change',e=>{selection.group=e.target.value;load();});
    target.querySelector('[data-stat-refresh]').onclick=()=>load();
    const refresh=()=>{if(target.isConnected&&!document.hidden&&!inflight)load(true);};
    target.refreshStatistics=refresh;
    load();
  }
  function mainSummary(target,kind) {
    if(!allowed()||!target)return;
    const red=kind==='red-tag',patrol=kind==='patrol',link=patrol?'patrol-dashboard':red?'red-tag-dashboard':'environment-dashboard';
    target.className='she-summary-card';
    target.innerHTML='<div class="she-summary-title"><span>'+(patrol?'Safety Patrol':red?'Red Tag':'Environmental')+'</span><a href="#/'+link+'">Full statistics →</a></div><div data-summary-body role="status">Loading summary…</div>';
    let version=0;
    const load=async()=>{const current=++version;try{
      const d=await api(endpoint(kind,{period:'month',month:month(),...(kind==='environment'?{group:'environment'}:{})}));
      if(current!==version||!target.isConnected||!allowed())return;
      const last=patrol?d.summary.not_ok_items:d.summary.completed;
      target.querySelector('[data-summary-body]').innerHTML='<div class="she-summary-values"><div><strong>'+number(d.summary.total)+'</strong><span>'+(patrol?'patrols':red?'findings':'reports')+' this month</span></div><div><strong>'+number(d.backlog.outstanding)+'</strong><span>outstanding · all dates</span></div><div><strong>'+number(last)+'</strong><span>'+(patrol?'NOT OK items this month':'of these completed')+'</span></div></div><p>'+esc(d.selection.label)+(patrol||red?' · '+number(d.backlog.awaiting_review)+' awaiting SHE verification':' · Environment reports')+'</p>';
    }catch(error){if(current===version&&target.isConnected)target.querySelector('[data-summary-body]').textContent=error.message;}};
    target.refreshStatistics=load;load();
  }
  setInterval(()=>{if(!allowed()||document.hidden)return;document.querySelectorAll('.she-statistics,.she-summary-card').forEach(target=>target.refreshStatistics?.());},30000);
  return {allowed,mount,mainSummary,focus};
})();
