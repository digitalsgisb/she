/* Shared entry points for finding-based Safety modules. */
function renderFindingModuleHome(key){
  const config=findingModuleHomes[key],module=config.module;
  const activity=module==='red-tag'
    ? '<section class="module-home-recent red-tag-active"><div class="exec-section-heading"><h2>Active findings</h2><a href="#/red-tag-pic">Assigned to me →</a></div><div data-redtag-active class="genba-grid" aria-live="polite">'+SHEUI.skeleton('cards',3,'Loading findings')+'</div></section><section data-redtag-desktop class="red-tag-desktop-tools" hidden></section>'
    : `<div class="module-home-choices"><a href="#/${module}?view=active"><span class="module-home-choice-icon">${icon('alert',25)}</span><span><strong>Active</strong><small>Follow open cases</small></span>${icon('chevron',20)}</a><a href="#/${module}?view=history"><span class="module-home-choice-icon">${icon('clock',25)}</span><span><strong>History</strong><small>Completed cases</small></span>${icon('chevron',20)}</a></div><section class="module-home-recent"><div class="exec-section-heading"><h2>Recent activity</h2><a href="#/${module}?view=active">View active →</a></div><div data-module-recent aria-live="polite">${SHEUI.skeleton('list',3,'Loading activity')}</div></section>`;
  renderSafetyModuleContent(`<div class="page inner-page finding-module-home"><section class="patrol-home-hero"><div><h1>${escapeHtml(config.title)}</h1><a class="primary-button" href="${config.startHref}">${icon(config.icon,19)} ${escapeHtml(config.start)} ${icon('arrow',18)}</a></div><span class="patrol-home-emblem" aria-hidden="true">${icon(config.icon,78)}</span></section><div class="patrol-home-stats"><div><span>Active</span><strong data-module-count="active">—</strong></div><div><span>Today</span><strong data-module-count="today">—</strong></div><div><span>Completed</span><strong data-module-count="history">—</strong></div></div>${activity}<p class="form-error" data-module-home-error role="alert" hidden></p><button type="button" class="secondary-button" data-module-home-retry hidden>Try again</button></div>`);
  const root=content.querySelector('.finding-module-home');
  root.dataset.homeKey=key;delete root.dataset.homeSnapshot;
  root.querySelector('[data-module-home-retry]').onclick=()=>loadFindingModuleHome(key);
  if(module==='red-tag')mountRedTagDesktopTools(root);
  loadFindingModuleHome(key);
}

const recentTableDesktop=matchMedia('(min-width:761px)');
function bindHiyariOverviewEvidence(root){
  const table=root?.querySelector('[data-hiyari-recent-table]');
  if(table)SHEStats.bindEvidence(table,recentTableDesktop.matches);
}
recentTableDesktop.addEventListener('change',()=>bindHiyariOverviewEvidence(content.querySelector('.finding-module-home')));

async function loadFindingModuleHome(key,quiet=false){
  const root=content.querySelector('.finding-module-home'),config=findingModuleHomes[key];
  if(!root||!config||currentRoute()!==key||root.dataset.homeLoading||(quiet&&key==='red-tag-home'&&!modalBackdrop.hidden))return;
  const userId=currentUser.id,button=root.querySelector('[data-module-home-retry]');
  root.dataset.homeLoading='true';if(!quiet)button.disabled=true;
  try{
    const data=await api(`/api/workspace/modules/${config.module}`);
    if(!root.isConnected||currentRoute()!==key||root.dataset.homeKey!==key||currentUser?.id!==userId)return;
    const snapshot=JSON.stringify(data);
    if(root.dataset.homeSnapshot!==snapshot){
      root.dataset.homeSnapshot=snapshot;
      root.querySelectorAll('[data-module-count]').forEach(el=>el.textContent=data.counts[el.dataset.moduleCount]);
      if(config.module==='red-tag'){
        const active=data.active||[];
        root.querySelector('[data-redtag-active]').innerHTML=active.length?genbaCards(active):'<p class="patrol-empty">No active findings.</p>';
        root.querySelectorAll('[data-genba-id]').forEach(button=>button.onclick=()=>genbaDetail(button.dataset.genbaId));
      }else {
        const cards=data.recent.length?data.recent.map(row=>`<a class="module-home-record" href="${escapeHtml(row.href)}"><span class="module-home-record-icon">${icon(config.icon,22)}</span><span><small>${new Date(row.created_at*1000).toLocaleDateString('en-MY',{day:'numeric',month:'short',timeZone:'Asia/Kuala_Lumpur'})} · ${escapeHtml(row.reporter)}</small><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.detail)}</span><small class="patrol-status patrol-status-${row.status}">${escapeHtml(row.status_label)}</small></span>${issueThumbnail(row.thumbnail_url)}${icon('chevron',18)}</a>`).join(''):`<div class="patrol-home-empty">${icon(config.icon,27)}<strong>No records yet.</strong></div>`;
        const recent=root.querySelector('[data-module-recent]');
        if(config.module==='hiyari-hatto'&&data.recent.length){
          const rows=data.recent.map(row=>({...row,reference:'SHE-'+String(row.id).padStart(6,'0'),location:row.detail,description:row.description||row.reporter}));
          recent.innerHTML='<div class="hiyari-recent-cards">'+cards+'</div><div data-hiyari-recent-table>'+SHEStats.reportTable(rows)+'</div>';
          bindHiyariOverviewEvidence(root);
        }else recent.innerHTML=cards;
      }
    }
    bindIssueThumbnails(root);
    root.querySelector('[data-module-home-error]').hidden=true;
    button.hidden=true;
  }catch(error){if(root.isConnected&&currentRoute()===key){const box=root.querySelector('[data-module-home-error]');if(box){box.textContent=error.message;box.hidden=false;button.hidden=false;}}}
  finally{delete root.dataset.homeLoading;if(!quiet)button.disabled=false;}
}

const redTagDesktop=matchMedia('(min-width:1024px) and (any-pointer:fine)');
function isRedTagDesktop(){return redTagDesktop.matches;}
function mountRedTagDesktopTools(root){
  const target=root.querySelector('[data-redtag-desktop]');if(!target)return;
  target.hidden=!isRedTagDesktop();
  if(target.hidden){target.replaceChildren();return;}
  target.innerHTML=`<div class="exec-section-heading"><h2>Tools</h2><label>Date <input type="date" data-redtag-tool-date value="${genbaDate}"></label></div><div class="red-tag-tool-links"><a class="secondary-button" data-redtag-print target="_blank" rel="noopener">Print / PDF</a><a class="secondary-button" data-redtag-export>Export CSV</a>${genbaManager()?'<a class="secondary-button" href="#/red-tag-dashboard">Dashboard</a><button type="button" class="secondary-button" data-redtag-manage>Sections &amp; PICs</button>':''}</div><p class="form-error" data-redtag-tool-error hidden></p>`;
  const updateLinks=()=>{target.querySelector('[data-redtag-print]').href='/api/red-tags/print?date='+encodeURIComponent(genbaDate);target.querySelector('[data-redtag-export]').href='/api/red-tags/export?date='+encodeURIComponent(genbaDate);};
  updateLinks();target.querySelector('[data-redtag-tool-date]').onchange=event=>{if(event.target.value)genbaDate=event.target.value;else event.target.value=genbaDate;updateLinks();};
  target.querySelector('[data-redtag-manage]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{genbaSettings=await api('/api/red-tags/settings');if(currentRoute()==='red-tag-home'&&root.isConnected&&isRedTagDesktop())genbaMaster();}
    catch(error){const box=target.querySelector('[data-redtag-tool-error]');if(box){box.textContent=error.message;box.hidden=false;}}
    finally{button.disabled=false;}
  });
}
redTagDesktop.addEventListener('change',()=>{if(typeof currentRoute!=='function')return;if(!isRedTagDesktop()){if(modalBody.querySelector('#genbaMasterForm'))closeModal();if(currentRoute()==='red-tag-dashboard')location.hash='#/red-tag-home';}const root=content.querySelector('.finding-module-home');if(root&&currentRoute()==='red-tag-home')mountRedTagDesktopTools(root);});

setInterval(()=>{
  if(typeof currentRoute!=='function'||!currentUser||document.hidden||!navigator.onLine)return;
  const key=currentRoute();if(findingModuleHomes[key])loadFindingModuleHome(key,true);
},15000);
document.fonts?.ready.then(()=>{if(typeof currentRoute==='function'&&typeof syncModuleTabs==='function'&&currentUser)syncModuleTabs();});
