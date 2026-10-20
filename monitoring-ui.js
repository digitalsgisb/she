/* Monthly SHE registers and Hiyari Hatto summaries. */
const SHEMonitoring = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const configs = {
    'accident-dashboard':{kind:'accident',area:'safety',title:'Monthly accident statistic',detail:'On-job accidents by section, off-job accidents and injury frequency rate.'},
    'compound-dashboard':{kind:'compound',area:'environment',title:'No. of compound',detail:'Monthly environmental compound counts.'},
    'environmental-findings-dashboard':{kind:'environmental-findings',area:'environment',title:'No. of environmental findings',detail:'Spillage, Aedes larvae, stagnant water and other inspection findings.'},
    'hiyari-dashboard':{kind:'hiyari',area:'safety',title:'Hiyari Hatto Summary',detail:'Progress, categories, rank, STOP 6 and section follow-up.'}
  };
  const names = month => new Date(month+'-01T12:00:00+08:00').toLocaleDateString('en-MY',{month:'short',timeZone:'Asia/Kuala_Lumpur'});
  const now = () => new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',timeZone:'Asia/Kuala_Lumpur'}).format(new Date()).match(/\d{4}/)?.[0] || '2026';
  const display = value => value===null || value===undefined ? '—' : String(value);
  let generation=0;
  function download(rows,name) {
    const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
    const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function chart(items) {
    const max=Math.max(1,...items.map(r=>r.total||0));
    return '<div class="monitor-month-chart" aria-label="Monthly totals">'+items.map(r=>{const height=r.total?Math.max(3,r.total/max*154):0;return `<button type="button" data-month="${esc(r.month)}" aria-label="${names(r.month)}: ${r.total===null?'not reported':r.total}"><strong>${display(r.total)}</strong><span class="monitor-track"><svg viewBox="0 0 100 154" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="${154-height}" width="100" height="${height}" rx="4"/></svg></span><span>${names(r.month)}</span></button>`;}).join('')+'</div>';
  }
  function stats(items) {
    return '<div class="report-stats">'+items.map(([label,value])=>`<div><strong>${display(value)}</strong><span>${esc(label)}</span></div>`).join('')+'</div>';
  }
  async function mount(key) {
    const config=configs[key], root=document.getElementById('content'), version=++generation, routeKey=currentRoute();
    if(!config)return;
    let year=sessionStorage.getItem('she-monitor-year')||now(), data, selected, requestSequence=0;
    root.innerHTML=`<div class="page inner-page focused-dashboard-page">${dashboardHeader(config.area,config.title,config.detail,key)}<div id="monitorBody" aria-live="polite"></div></div>`;
    root.querySelector('[data-dashboard-controls]').innerHTML=`<label>Year<input id="monitorYear" type="number" min="2000" max="2099" value="${esc(year)}"></label><button class="secondary-button" id="monitorRefresh">Refresh</button><button class="secondary-button" id="monitorExport">Export CSV</button>`;
    bindDashboardHeader();
    const body=root.querySelector('#monitorBody');
    async function load() {
      const sequence=++requestSequence;
      body.setAttribute('aria-busy','true');
      try {
        const result=await api('/api/she-monitoring/'+config.kind+'?year='+year);
        if(version!==generation || currentRoute()!==routeKey || sequence!==requestSequence)return;
        data=result; draw();
      }catch(error){if(currentRoute()===routeKey)body.innerHTML=`<p class="form-error" role="alert">${esc(error.message)}</p>`;}
      finally{body.setAttribute('aria-busy','false');}
    }
    function draw() {
      if(config.kind==='hiyari'){drawHiyari();return;}
      const partial=data.months.some(r=>r.total!==null&&!r.complete);
      const hours=data.months.filter(r=>r.complete&&r.payload.man_hours>0);
      const allHours=hours.length===data.months.filter(r=>r.total!==null).length&&hours.length>0;
      const ifr=allHours?(hours.reduce((s,r)=>s+r.total,0)*1e6/hours.reduce((s,r)=>s+r.payload.man_hours,0)).toFixed(2):null;
      body.innerHTML=stats([['Recorded total'+(partial?' (partial)':''),data.reported_months||data.months.some(r=>r.total!==null)?data.total:null],['Complete months',data.reported_months+' / 12'],...(config.kind==='accident'?[['Off-job accidents (recorded)',data.months.some(r=>Number.isInteger(r.payload.off_job))?data.months.reduce((s,r)=>s+(Number.isInteger(r.payload.off_job)?r.payload.off_job:0),0):null],['IFR (per million hours)',ifr]]:[])])+`<section class="report-detail-card"><h2>Monthly trend · ${year}</h2><p>Blank (—) means not reported. NA means not applicable. Zero is a confirmed count. Totals include numeric entries only.</p>${chart(data.months)}</section><section class="report-detail-card"><h2>Monthly register</h2><p>Select a month to enter or correct its statistics. Changes retain the editor and history.</p><div class="monitor-table-wrap"><table class="monitor-table"><thead><tr><th scope="col">Category</th>${data.months.map(r=>`<th scope="col"><button class="monitor-month-link" data-month="${r.month}">${names(r.month)}</button></th>`).join('')}</tr></thead><tbody>${data.categories.map(c=>`<tr><th scope="row">${esc(c)}</th>${data.months.map(r=>`<td>${display(r.payload.counts[c])}</td>`).join('')}</tr>`).join('')}<tr class="monitor-total"><th scope="row">${config.kind==='accident'?'On-job total':'Total'}</th>${data.months.map(r=>`<td>${display(r.total)}${r.total!==null&&!r.complete?' *':''}</td>`).join('')}</tr>${config.kind==='accident'?['off_job','man_hours','ifr'].map((f,i)=>`<tr><th scope="row">${['Off-job accidents','Man-hours','IFR / million hours'][i]}</th>${data.months.map(r=>`<td>${display(f==='ifr'?r.ifr:r.payload[f])}</td>`).join('')}</tr>`).join(''):''}</tbody></table></div><p class="field-hint">* Partial total. IFR = on-job accidents × 1,000,000 ÷ man-hours; shown only with complete counts and positive hours.</p></section><section id="monitorEditor" class="report-detail-card"></section>`;
      body.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>{selected=b.dataset.month;editor();body.querySelector('#monitorEditor').scrollIntoView({behavior:'smooth',block:'start'});});
      selected=selected||data.months.find(r=>!r.complete)?.month||data.months[0].month;editor();
    }
    function editor() {
      const row=data.months.find(r=>r.month===selected), panel=body.querySelector('#monitorEditor');
      panel.innerHTML=`<h2>Update ${names(selected)} ${year}</h2><p>${row.actor?'Last saved by '+esc(row.actor)+' · revision '+row.revision:'No monthly entry yet.'}</p><form id="monitorForm" class="stacked-form"><div class="monitor-input-grid">${data.categories.map((c,i)=>`<div><label for="monitorCount${i}">${esc(c)}</label><input id="monitorCount${i}" data-count="${esc(c)}" value="${esc(row.payload.counts[c]??'')}" inputmode="numeric" placeholder="Blank, NA, or count" pattern="(?:NA|[0-9]+)" maxlength="7"></div>`).join('')}${config.kind==='accident'?`<div><label for="offJob">Off-job accidents</label><input id="offJob" value="${esc(row.payload.off_job??'')}" pattern="(?:NA|[0-9]+)" placeholder="Blank, NA, or count"></div><div><label for="manHours">Man-hours</label><input id="manHours" type="number" min="0" max="1000000000" step="any" value="${esc(row.payload.man_hours??'')}"></div>`:''}</div><label for="monitorNote">Source / remarks</label><textarea id="monitorNote" maxlength="2000" rows="2">${esc(row.payload.note||'')}</textarea><p class="form-error" id="monitorError" role="alert" hidden></p><button class="primary-button">Save monthly statistics</button></form><details id="monitorHistory"><summary>Saved revisions</summary><div data-history>Open to load history.</div></details>`;
      panel.querySelector('#monitorHistory').ontoggle=async e=>{if(!e.target.open)return;try{const result=await api('/api/she-monitoring/'+config.kind+'?year='+year+'&history='+selected);panel.querySelector('[data-history]').innerHTML=result.history.length?result.history.map(h=>`<article class="report-update"><strong>${esc(h.actor)}</strong><small>${new Date(h.created_at*1000).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})} MYT</small><pre>${esc(JSON.stringify(h.payload,null,2))}</pre></article>`).join(''):'<p>No saved revisions.</p>';}catch(error){panel.querySelector('[data-history]').textContent=error.message;}};
      panel.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
        const value=s=>s.trim()===''?null:s.trim()==='NA'?'NA':Number(s);
        const payload={month:selected,revision:row.revision,counts:Object.fromEntries([...e.target.querySelectorAll('[data-count]')].map(el=>[el.dataset.count,value(el.value)])),note:panel.querySelector('#monitorNote').value};
        if(config.kind==='accident'){payload.off_job=value(panel.querySelector('#offJob').value);const h=panel.querySelector('#manHours').value;payload.man_hours=h===''?null:Number(h);}
        try{await api('/api/she-monitoring/'+config.kind,'POST',payload);await load();}
        catch(error){const box=panel.querySelector('#monitorError');box.hidden=false;box.textContent=error.message;button.disabled=false;}
      };
    }
    function drawHiyari() {
      body.innerHTML=stats([['Total reports',data.total],['Open / in progress',data.open],['Resolved / closed',data.closed],['Completion',data.completion===null?'—':data.completion+'%']])+`<div class="report-admin-links"><a class="primary-button" href="/report?area=hiyari-hatto">New Hiyari Hatto form ↗</a><a class="secondary-button" href="/templates/hiyari-hatto.pdf" target="_blank" rel="noopener">FR-SH-12 blank template ↗</a><a class="secondary-button" href="#/hiyari-hatto">Available forms</a></div><section class="report-detail-card"><h2>Monthly progress · ${year}</h2><p>Uses the event date when supplied; older reports use their submission date in Malaysia. Closure is the current status of reports from each month.</p>${chart(data.months)}<div class="monitor-table-wrap"><table class="monitor-table"><thead><tr><th>Progress</th>${data.months.map(r=>`<th>${names(r.month)}</th>`).join('')}</tr></thead><tbody>${['total','open','closed'].map(f=>`<tr><th>${f}</th>${data.months.map(r=>`<td>${r[f]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section><div class="monitor-breakdowns">${Object.entries(data.categories).map(([field,values])=>`<section class="report-detail-card"><h2>${esc({category:'Status category',rank:'Rank',stop:'STOP 6',section:'Section',pic:'PIC'}[field])}</h2>${Object.keys(values).length?Object.entries(values).map(([label,n])=>`<button class="monitor-breakdown" data-filter-field="${field}" data-filter-value="${esc(label)}"><span>${esc(label)}</span><strong>${n}</strong></button>`).join(''):'<p>No reports recorded.</p>'}</section>`).join('')}</div><section class="report-detail-card"><h2>Matching reports</h2><button class="secondary-button" id="clearHiyariFilter">Show all</button><p id="hiyariFilterLabel"></p><div class="report-inbox-grid" id="hiyariRows"></div></section>`;
      function records(rows,label='All reports') {body.querySelector('#hiyariFilterLabel').textContent=label+' · '+rows.length;body.querySelector('#hiyariRows').innerHTML=rows.length?rows.map(r=>`<a class="report-inbox-card" href="#/reporting-inbox/${r.id}"><strong>${esc(r.reference)} · ${esc(r.status.replace('_',' '))}</strong><h3>${esc(r.description||r.location)}</h3><p>${esc(r.date)} · ${esc(r.section)}</p><p>Rank ${esc(r.rank)} · STOP ${esc(r.stop)} · ${esc(r.pic)}</p></a>`).join(''):'<p>No matching reports.</p>';}
      body.querySelectorAll('[data-filter-field]').forEach(b=>b.onclick=()=>records(data.records.filter(r=>r[b.dataset.filterField]===b.dataset.filterValue),b.dataset.filterField+': '+b.dataset.filterValue));
      body.querySelectorAll('[data-month]').forEach(b=>b.onclick=()=>records(data.records.filter(r=>r.date.startsWith(b.dataset.month)),names(b.dataset.month)+' '+year));
      body.querySelector('#clearHiyariFilter').onclick=()=>records(data.records);records(data.records);
    }
    root.querySelector('#monitorYear').onchange=e=>{if(e.target.checkValidity()&&/^20\d{2}$/.test(e.target.value)){year=e.target.value;selected=null;sessionStorage.setItem('she-monitor-year',year);load();}};
    root.querySelector('#monitorRefresh').onclick=load;
    root.querySelector('#monitorExport').onclick=()=>{
      if(!data)return;
      const rows=config.kind==='hiyari'?[['Reference','Date','Reporter','Section','Category','Rank','STOP','PIC','Status','Description'],...data.records.map(r=>['reference','date','reporter','section','category','rank','stop','pic','status','description'].map(k=>r[k]))]:[['Category',...data.months.map(r=>r.month)],...data.categories.map(c=>[c,...data.months.map(r=>r.payload.counts[c])]),['Total',...data.months.map(r=>r.total)],...(config.kind==='accident'?['off_job','man_hours','ifr'].map(f=>[f,...data.months.map(r=>f==='ifr'?r.ifr:r.payload[f])]):[])];
      download(rows,config.kind+'-'+year+'.csv');
    };
    await load();
  }
  return {mount,configs};
})();
