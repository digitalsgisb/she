/* Shared entry points for finding-based Safety modules. */
function renderFindingModuleHome(key){
  const config=findingModuleHomes[key],module=config.module;
  renderSafetyModuleContent(`<div class="page inner-page finding-module-home"><section class="patrol-home-hero"><div><span class="eyebrow">CHOOSE YOUR NEXT ACTION</span><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.description)}</p><a class="primary-button" href="${config.startHref}">${icon(config.icon,19)} ${escapeHtml(config.start)} ${icon('arrow',18)}</a></div><span class="patrol-home-emblem" aria-hidden="true">${icon(config.icon,78)}</span></section><div class="patrol-home-stats"><div><span>Current active</span><strong data-module-count="active">—</strong></div><div><span>New today</span><strong data-module-count="today">—</strong></div><div><span>History</span><strong data-module-count="history">—</strong></div></div><div class="module-home-choices"><a href="#/${module}?view=active"><span class="module-home-choice-icon">${icon('alert',25)}</span><span><strong>Current active</strong><small>Follow findings and outstanding actions</small></span>${icon('chevron',20)}</a><a href="#/${module}?view=history"><span class="module-home-choice-icon">${icon('clock',25)}</span><span><strong>History</strong><small>Review completed reports and actions</small></span>${icon('chevron',20)}</a>${module==='red-tag'?`<a href="#/red-tag-pic"><span class="module-home-choice-icon">${icon('person',25)}</span><span><strong>My actions</strong><small>Findings assigned to your account</small></span>${icon('chevron',20)}</a>`:''}</div><section class="module-home-recent"><div class="exec-section-heading"><h2>Recent activity</h2><a href="#/${module}?view=active">View active →</a></div><div data-module-recent aria-live="polite"><p class="patrol-empty">Loading activity…</p></div></section><p class="form-error" data-module-home-error role="alert" hidden></p><button type="button" class="secondary-button" data-module-home-refresh>Refresh activity</button></div>`);
  const root=content.querySelector('.finding-module-home');
  root.dataset.homeKey=key;delete root.dataset.homeSnapshot;
  root.querySelector('[data-module-home-refresh]').onclick=()=>loadFindingModuleHome(key);
  loadFindingModuleHome(key);
}

async function loadFindingModuleHome(key,quiet=false){
  const root=content.querySelector('.finding-module-home'),config=findingModuleHomes[key];
  if(!root||!config||currentRoute()!==key||root.dataset.homeLoading)return;
  const userId=currentUser.id,button=root.querySelector('[data-module-home-refresh]');
  root.dataset.homeLoading='true';if(!quiet)button.disabled=true;
  try{
    const data=await api(`/api/workspace/modules/${config.module}`);
    if(!root.isConnected||currentRoute()!==key||root.dataset.homeKey!==key||currentUser?.id!==userId)return;
    const snapshot=JSON.stringify(data);
    if(root.dataset.homeSnapshot!==snapshot){
      root.dataset.homeSnapshot=snapshot;
      root.querySelectorAll('[data-module-count]').forEach(el=>el.textContent=data.counts[el.dataset.moduleCount]);
      root.querySelector('[data-module-recent]').innerHTML=data.recent.length?data.recent.map(row=>`<a class="module-home-record" href="${escapeHtml(row.href)}"><span class="module-home-record-icon">${icon(config.icon,22)}</span><span><small>${new Date(row.created_at*1000).toLocaleDateString('en-MY',{day:'numeric',month:'short',timeZone:'Asia/Kuala_Lumpur'})} · ${escapeHtml(row.reporter)}</small><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.detail)}</span><small class="patrol-status patrol-status-${row.status}">${escapeHtml(row.status_label)}</small></span>${icon('chevron',18)}</a>`).join(''):`<div class="patrol-home-empty">${icon(config.icon,27)}<strong>No records yet.</strong><p>Start with ${config.module==='red-tag'?'a new finding':'a new report'}.</p></div>`;
    }
    root.querySelector('[data-module-home-error]').hidden=true;
  }catch(error){if(root.isConnected&&currentRoute()===key){const box=root.querySelector('[data-module-home-error]');if(box){box.textContent=error.message;box.hidden=false;}}}
  finally{delete root.dataset.homeLoading;if(!quiet)button.disabled=false;}
}

setInterval(()=>{
  if(typeof currentRoute!=='function'||!currentUser||document.hidden||!navigator.onLine)return;
  const key=currentRoute();if(findingModuleHomes[key])loadFindingModuleHome(key,true);
},15000);
document.fonts?.ready.then(()=>{if(typeof currentRoute==='function'&&typeof syncModuleTabs==='function'&&currentUser)syncModuleTabs();});
