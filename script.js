const icon = (name, size = 20) => {
  const paths = {
    camera: '<path d="M14 4h-4L8 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-2-3Z"/><circle cx="12" cy="13" r="4"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12.4-2L20 8M4 16l2.1 3A7.5 7.5 0 0 0 18.5 17"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M4 12h4l2-3 3 6 2-3h5"/>',
    leaf: '<path d="M20 4c-8 0-15 2-16 10a6 6 0 0 0 6 6c8-1 10-8 10-16Z"/><path d="M4 20c3-5 7-8 12-11"/>',
    tag: '<path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V4a1 1 0 0 1 1-1h8.8L20 10.2a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v4m0 4h.01"/>',
    waste: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3h6v1.5M9 11h6m-6 4h6m-6 4h3"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    droplet: '<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>',
    recycle: '<path d="m7 4 2-2 2 2M9 2l3 5H6l-2 4m16 2 2 1-1 3m1-3h-6l3-5h-5M5 19l-3-1 1-3m-1 3h7l-3-5 3-1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18m-11 0v2h4v-2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

function issueThumbnail(url,label='Issue photo'){
  return `<span class="issue-thumbnail">${url?`<img data-issue-thumbnail src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="lazy" decoding="async">`:icon('camera',24)}</span>`;
}
function bindIssueThumbnails(root){
  root.querySelectorAll('img[data-issue-thumbnail]').forEach(img=>{
    const fallback=()=>{const box=img.parentElement;if(box){box.innerHTML=icon('camera',24);box.classList.add('issue-thumbnail-empty');}};
    img.addEventListener('error',fallback,{once:true});
    if(img.complete&&!img.naturalWidth)fallback();
  });
}

const routes = {
  home: { title: 'Home', icon: 'grid' },
  'air-leak': { title: 'Air Leak', icon: 'droplet' },
  dashboard: { title: 'Dashboard', icon: 'grid' },
  'she-summary': { title: 'SHE Summary', icon: 'shield' },
  'co2-dashboard': { title: 'CO2 Tracking', icon: 'leaf' },
  'safety-dashboard': { title: 'Safety Dashboard', icon: 'shield' },
  'health-dashboard': { title: 'Health Dashboard', icon: 'heart' },
  'dashboard-records': { title: 'Filtered Dashboard Records', icon: 'clipboard' },
  'patrol-dashboard': { title: 'Patrol Dashboard', icon: 'grid' },
  'red-tag-dashboard': { title: 'Red Tag Dashboard', icon: 'tag' },
  'accident-register': { title: 'Accident Register', icon: 'shield' },
  'accident-dashboard': { title: 'Monthly accident statistic', icon: 'shield' },
  'hiyari-dashboard': { title: 'Hiyari Hatto Summary', icon: 'alert' },
  'compound-dashboard': { title: 'Environmental Enforcement Register', icon: 'leaf' },
  'environmental-findings-dashboard': { title: 'Environmental Inspection Register', icon: 'leaf' },
  'environment-dashboard': { title: 'Environmental Dashboard', icon: 'leaf' },
  environmental: { title: 'Environmental', icon: 'leaf' },
  'red-tag': { title: 'Red Tag', icon: 'tag' },
  'red-tag-pic': { title: 'Assigned to me', icon: 'tag' },
  'hiyari-hatto': { title: 'Hiyari Hatto', icon: 'alert' },
  co2: { title: 'CO2', icon: 'leaf' },
  findings: { title: 'Environmental Findings', icon: 'clipboard' },
  kaizen: { title: 'Kaizen', icon: 'leaf' },
  'reporting-forms': { title: 'Reporting Form', icon: 'clipboard' },
  'reporting-inbox': { title: 'Inbox', icon: 'clipboard' },
  'reporting-qr': { title: 'Report to SHE QR', icon: 'camera' },
  safety: { title: 'Safety', icon: 'shield' },
  'red-tag-home': {title:'Red Tag',icon:'tag'},
  'hiyari-home': {title:'Hiyari Hatto',icon:'alert'},
  'air-leak-home': {title:'Air Leak',icon:'droplet'},
  'patrol-home': { title: 'Safety Patrol', icon: 'clipboard' },
  'daily-safety-patrol': { title: 'Safety Patrol', icon: 'clipboard' },
  'checklist-builder': { title: 'Checklist Builder', icon: 'clipboard' },
  'patrol-overview': { title: 'Patrol History', icon: 'grid' },
  health: { title: 'Health', icon: 'heart' },
  users: { title: 'User Management', icon: 'users' },
  'work-orders': { title: 'SHE Work Orders', icon: 'clipboard' },
  account: { title: 'My Account', icon: 'person' },
};


function canAccessRoute(key) {
  if (!currentUser) return false;
  if(key==='red-tag-dashboard'&&!isRedTagDesktop())return false;
  if (key === 'dashboard' || key.endsWith('-dashboard') || key === 'dashboard-records' || key === 'she-summary') return ['admin','executive'].includes(currentUser.role);
  if (['users','reporting-forms','accident-register'].includes(key)) return ['admin','executive'].includes(currentUser.role);
  return Boolean(routes[key]);
}
function filterFeatureLinks(root) {
  root.querySelectorAll('a[href^="#/"]').forEach(link => {
    if (!canAccessRoute(link.getAttribute('href').slice(2).split(/[/?]/)[0])) {
      const parent=link.closest('.nav-parent');
      if(parent){ const submenu=parent.nextElementSibling;parent.remove();if(submenu?.classList.contains('subnav'))submenu.remove(); }
      else link.remove();
    }
  });
}
const envItems = ['reporting-qr', 'reporting-inbox', 'co2', 'kaizen', 'reporting-forms'];
const safetyItems = ['daily-safety-patrol', 'red-tag', 'air-leak', 'hiyari-hatto', 'accident-register'];

const findingModuleHomes={
  'red-tag-home':{module:'red-tag',title:'Red Tag',icon:'tag',description:'Report hazards. Track action.',start:'Findings',startHref:'#/red-tag?new=1'},
  'hiyari-home':{module:'hiyari-hatto',title:'Hiyari Hatto',icon:'alert',description:'Report a near miss and follow it through to verification.',start:'New report',startHref:'#/hiyari-hatto'},
  'air-leak-home':{module:'air-leak',title:'Air Leak',icon:'droplet',description:'Report leaks and track maintenance work from one place.',start:'Report a leak',startHref:'#/air-leak'}
};
function moduleEntryRoute(key){return key==='daily-safety-patrol'?'patrol-home':Object.keys(findingModuleHomes).find(home=>findingModuleHomes[home].module===key)||key;}

function safetyModule(key = currentRoute()) {
  if (['patrol-home','daily-safety-patrol','patrol-overview','checklist-builder'].includes(key)) return 'daily-safety-patrol';
  return findingModuleHomes[key]?.module || (key === 'red-tag-pic' ? 'red-tag' : key);
}
function moduleView() {
  const view = new URLSearchParams(location.hash.split('?')[1] || '').get('view');
  return ['active','history'].includes(view) ? view : 'checklist';
}
function moduleNavigation() {
  const key = currentRoute(), module = safetyModule(key);
  if (!safetyItems.includes(module)||module==='accident-register') return '';
  const patrol = module === 'daily-safety-patrol';
  const links = patrol
    ? [['patrol-home','Overview'],['daily-safety-patrol','Checklist'],['patrol-overview','History'],['checklist-builder','Checklist Builder']]
    : module==='red-tag'
      ? [['red-tag-home','Overview'],['red-tag?new=1','Findings'],['red-tag?view=history','History'],['red-tag-pic','Assigned to me']]
      : [[moduleEntryRoute(module),'Overview'],[module,'New report'],[module+'?view=active','Current Active'],[module+'?view=history','History']];
  const selected = module==='red-tag'
    ? key==='red-tag-pic'?key:key==='red-tag-home'?'red-tag-home':moduleView()==='history'?'red-tag?view=history':new URLSearchParams(location.hash.split('?')[1]||'').get('new')==='1'?'red-tag?new=1':'red-tag-home'
    : patrol&&key==='daily-safety-patrol'&&/^\d+$/.test(location.hash.split('?')[0].split('/')[2]||'') ? (new URLSearchParams(location.hash.split('?')[1]||'').get('followup')==='1'?'patrol-home':'patrol-overview') : patrol || findingModuleHomes[key] ? key : module + (moduleView()==='checklist' ? '' : '?view='+moduleView());
  return `<nav class="module-tabs" aria-label="${routes[module].title} sections">${links.filter(([target])=>canAccessRoute(target.split('?')[0])).map(([target,label])=>`<a href="#/${target}" ${selected===target?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
}
const featureDescriptions = {
  'red-tag': 'A space for Red Tag records and follow-up.',
  'hiyari-hatto': 'A space to capture near misses and early warnings.',
  co2: 'CO2 tracking and reporting will be available here.',
  findings: 'A space for employees to report environmental concerns.',
};

const findings = [
  ['Water pipe leakage', 'droplet'],
  ['Oil or chemical spillage', 'droplet'],
  ['Improper waste disposal', 'waste'],
  ['Waste segregation issue', 'recycle'],
  ['Drainage or discharge issue', 'droplet'],
  ['Equipment leakage', 'alert'],
  ['Energy wastage', 'leaf'],
  ['Other environmental concerns', 'leaf'],
];

const nav = document.getElementById('nav');
const content = document.getElementById('content');
const breadcrumb = document.getElementById('breadcrumb');
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('backdrop');
const menuButton = document.getElementById('menuButton');
const sidebarClose = document.getElementById('sidebarClose');
const appShell = document.getElementById('appShell');
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const setupMessage = document.getElementById('setupMessage');
const headerUser = document.getElementById('headerUser');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalBody = document.getElementById('modalBody');
const toastBox = document.getElementById('toast');
const mobileTabbar = document.getElementById('mobileTabbar');
let currentUser = null;
let csrfToken = '';
let managedUsers = [];
let envExpanded = false;
let dashboardsExpanded = false;
let safetyExpanded = false;
let installPrompt = null;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function addPasswordToggles(root) {
  root.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.parentElement.classList.contains('password-field')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-toggle';
    button.textContent = 'Show';
    button.setAttribute('aria-label', `Show ${input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent.toLowerCase() || 'password' : 'password'}`);
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.textContent = visible ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} password`);
    });
    wrapper.appendChild(button);
  });
}

function installHelpCard() {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return '';
  return `<section class="settings-card install-card"><h2>Use SHE Digital on your phone</h2><p>Install it to your Home Screen for quick access to the Safety Patrol. An internet connection is needed to sign in and submit patrols; draft answers are saved on this device while you fill the form.</p><button class="primary-button" type="button" data-install-app ${installPrompt ? '' : 'hidden'}>Install app</button><div class="install-instructions"><strong>iPhone or iPad</strong><span>Open this site in Safari, tap Share, then Add to Home Screen.</span><strong>Android</strong><span>Open this site in Chrome and use Install app or Add to Home screen from the browser menu.</span></div></section>`;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  const button = document.querySelector('[data-install-app]');
  if (button) button.hidden = false;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  document.querySelector('.install-card')?.remove();
});

function routeLink(key, className = '') {
  const item = routes[key];
  return `<a class="${className}" href="#/${key}"><span class="link-icon">${icon(item.icon)}</span><span>${item.title}</span>${icon('chevron', 16)}</a>`;
}

function mobileTab(key, label, symbol, active) {
  return `<a class="mobile-tab ${active ? 'active' : ''}" href="#/${key}" ${active ? 'aria-current="page"' : ''}>${icon(symbol, 20)}<span>${label}</span></a>`;
}

function renderMobileNavigation(active) {
  mobileTabbar.classList.remove('pic-navigation');
  const committee = currentUser.role === 'safety_committee';
  mobileTabbar.classList.toggle('committee-navigation', committee);
  const tabs = committee ? [['home','Home','grid'],['red-tag-home','Red Tag','tag'],['air-leak-home','Air Leak','droplet']] : [['home','Home','grid'],['patrol-home','Patrol','clipboard'],['red-tag-home','Red Tag','tag'],['work-orders','Orders','briefcase']];
  if(isPatrolRoute(active))active='patrol-home';
  else if(safetyModule(active)==='red-tag')active='red-tag-home';
  else if(committee&&safetyModule(active)==='air-leak')active='air-leak-home';
  const more = !tabs.some(([key])=>key===active);
  const markup = tabs.map(([key,label,symbol])=>mobileTab(key,label,symbol,active===key)).join('')+`<button class="mobile-tab ${more?'active':''}" id="mobileMoreButton" type="button" data-mobile-more aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu',20)}<span>More</span></button>`;
  const layout=tabs.map(([key])=>key).join(',');
  if(mobileTabbar.dataset.layout!==layout){mobileTabbar.innerHTML=markup;mobileTabbar.dataset.layout=layout;}
  else mobileTabbar.querySelectorAll('.mobile-tab').forEach(link=>{
    const selected=link.id==='mobileMoreButton'?more:link.getAttribute('href')==='#/'+active;
    link.classList.toggle('active',selected);
    if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  });
}

function renderNav(active) {
  const previousSubnavs = [...nav.querySelectorAll('.subnav')];
  const inDashboard=active==='dashboard'||active.endsWith('-dashboard')||active==='dashboard-records';
  nav.innerHTML = `<div class="nav-label">OVERVIEW</div>${routeLink('home', `nav-link ${active==='home'?'active':''}`)}<div class="nav-parent"><a class="nav-link ${inDashboard||active==='she-summary'?'active':''}" href="#/dashboard"><span class="link-icon">${icon('grid')}</span><span>Dashboard</span></a><button class="nav-toggle ${dashboardsExpanded?'expanded':''}" id="dashboardToggle" type="button" aria-label="${dashboardsExpanded?'Collapse':'Expand'} dashboards" aria-expanded="${dashboardsExpanded}" aria-controls="dashboardSubnav">${icon('chevron',16)}</button></div>
    <div class="subnav ${dashboardsExpanded?'expanded':''}" id="dashboardSubnav"><div class="subnav-content">${['dashboard','she-summary'].filter(canAccessRoute).map(key=>`<a class="subnav-link ${(key==='dashboard'?inDashboard:active===key)?'active':''}" href="#/${key}"><span class="subnav-dot"></span>${routes[key].title}</a>`).join('')}</div></div>
    <div class="nav-label nav-label-spaced">SHE SECTIONS</div>
    <div class="nav-parent"><a class="nav-link ${(active==='safety'||safetyItems.includes(safetyModule(active))) ? 'active' : ''}" href="#/safety"><span class="link-icon">${icon('shield')}</span><span>Safety</span></a><button class="nav-toggle ${safetyExpanded ? 'expanded' : ''}" id="safetyToggle" type="button" aria-label="${safetyExpanded ? 'Collapse' : 'Expand'} Safety subsections" aria-expanded="${safetyExpanded}" aria-controls="safetySubnav">${icon('chevron', 16)}</button></div>
    <div class="subnav ${safetyExpanded ? 'expanded' : ''}" id="safetySubnav" ><div class="subnav-content">${safetyItems.filter(canAccessRoute).map(key => `<a class="subnav-link ${safetyModule(active) === key ? 'active' : ''}" href="#/${moduleEntryRoute(key)}"><span class="subnav-dot"></span>${routes[key].title}</a>`).join('')}</div></div>
    ${routeLink('health', `nav-link ${active === 'health' ? 'active' : ''}`)}
    <div class="nav-parent"><a class="nav-link ${active === 'environmental' || envItems.includes(active) ? 'active' : ''}" href="#/environmental"><span class="link-icon">${icon('leaf')}</span><span>Environmental</span></a><button class="nav-toggle ${envExpanded ? 'expanded' : ''}" id="envToggle" type="button" aria-label="${envExpanded ? 'Collapse' : 'Expand'} Environmental subsections" aria-expanded="${envExpanded}" aria-controls="environmentSubnav">${icon('chevron', 16)}</button></div>
    <div class="subnav ${envExpanded ? 'expanded' : ''}" id="environmentSubnav" ><div class="subnav-content">${envItems.filter(canAccessRoute).map(key => `<a class="subnav-link ${active === key ? 'active' : ''}" href="#/${key}"><span class="subnav-dot"></span>${routes[key].title}</a>`).join('')}</div></div>
    <div class="nav-label nav-label-spaced">WORKSPACE</div>
    ${routeLink('work-orders', `nav-link ${active === 'work-orders' ? 'active' : ''}`)}
    ${['admin','executive'].includes(currentUser?.role) ? routeLink('users', `nav-link ${active === 'users' ? 'active' : ''}`) : ''}
    ${routeLink('account', `nav-link ${active === 'account' ? 'active' : ''}`)}`;
  previousSubnavs.forEach(previous => {
    const replacement = document.getElementById(previous.id);
    if (!replacement) return;
    previous.innerHTML = replacement.innerHTML;
    replacement.replaceWith(previous);
  });
  [['dashboardSubnav', dashboardsExpanded], ['safetySubnav', safetyExpanded], ['environmentSubnav', envExpanded]].forEach(([id, expanded]) => {
    const submenu = document.getElementById(id);
    if (!submenu) return;
    submenu.getBoundingClientRect();
    submenu.classList.toggle('expanded', expanded);
    submenu.inert = !expanded;
    submenu.setAttribute('aria-hidden', String(!expanded));
  });
  document.getElementById('dashboardToggle').addEventListener('click',()=>{dashboardsExpanded=!dashboardsExpanded;renderNav(currentRoute());});
  nav.querySelector('.nav-parent a[href="#/dashboard"]').addEventListener('click',()=>{if(!dashboardsExpanded){dashboardsExpanded=true;renderNav(active);}});
  document.getElementById('envToggle').addEventListener('click', () => {
    envExpanded = !envExpanded;
    renderNav(currentRoute());
  });
  document.getElementById('safetyToggle').addEventListener('click', () => {
    safetyExpanded = !safetyExpanded;
    renderNav(currentRoute());
  });
  nav.querySelector('a[href="#/environmental"]').addEventListener('click', () => {
    if (active === 'environmental' && !envExpanded) { envExpanded = true; renderNav(active); }
  });
  nav.querySelector('a[href="#/safety"]').addEventListener('click', () => {
    if (active === 'safety' && !safetyExpanded) { safetyExpanded = true; renderNav(active); }
  });
  filterFeatureLinks(nav);
}

function renderHome() {
  if(currentUser.role==='safety_committee')return renderCommitteeHome();
  if(['admin','executive'].includes(currentUser.role))return renderExecutiveHome();
  const links = [['red-tag','Record a hazard and follow up on findings.'],['air-leak','Report a leak and issue a maintenance work order.'],['red-tag-pic','View findings assigned to you.'],['daily-safety-patrol','Complete a safety inspection.'],['patrol-overview','Review your submitted patrols.'],['hiyari-hatto','Report a near miss.'],['work-orders','Follow up on SHE work orders.']];
  return `<div class="page inner-page home-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE WORKSPACE</span><h1>Home</h1><p>Welcome, ${escapeHtml(currentUser.display_name)}. What would you like to do?</p></div><div class="home-actions">${links.map(([key,detail])=>`<a class="module-card" href="#/${moduleEntryRoute(key)}"><span class="module-icon">${icon(routes[key].icon,24)}</span><span class="module-copy"><strong>${routes[key].title}</strong><span>${detail}</span></span><span class="module-arrow">${icon('chevron',20)}</span></a>`).join('')}</div>${['admin','executive'].includes(currentUser.role)?'<a class="secondary-button home-dashboard-link" href="#/dashboard">Open dashboards →</a>':''}</div>`;
}

function renderExecutiveHome() {
  const day=new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'numeric',hourCycle:'h23'}).format(new Date()));
  const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const tools=[['daily-safety-patrol','New patrol','clipboard'],['environmental','Environment','leaf'],['dashboard','Dashboards','grid'],['reporting-qr','Reporting QR','camera']];
  return `<div class="page inner-page executive-home"><header class="exec-heading"><span class="eyebrow dark-eyebrow">YOUR SHE WORKSPACE</span><span>${escapeHtml(day)}</span></header><section class="exec-welcome"><div class="exec-welcome-copy"><span class="exec-kicker">THE NEXT ACTION STARTS HERE</span><h1>${greeting},<br>${escapeHtml(currentUser.display_name.split(' ')[0])}.</h1><p>A clearer view of your workplace.<br>Keep every finding moving towards a safer day.</p><div class="exec-hero-actions"><a href="#/reporting-inbox">Review reports ${icon('arrow',18)}</a><a href="#/work-orders">Work orders ${icon('briefcase',18)}</a></div></div><span class="exec-welcome-symbol" aria-hidden="true">${icon('shield',92)}</span><span class="exec-hero-footnote">OBSERVE · ACT · VERIFY</span></section><div class="exec-stats" aria-label="Open findings"><a href="#/reporting-inbox"><span>Reports to review</span><strong data-overview-count="reports">—</strong><small>SHE inbox ${icon('arrow',14)}</small></a><a href="#/red-tag?view=active"><span>Active Genba</span><strong data-overview-count="genba">—</strong><small>Follow up ${icon('arrow',14)}</small></a><a href="#/patrol-overview"><span>Patrol follow-ups</span><strong data-overview-count="patrols">—</strong><small>Review actions ${icon('arrow',14)}</small></a></div><section class="exec-next"><div class="exec-section-heading"><h2>Keep things moving</h2><span>YOUR DAILY TOOLS</span></div><div class="exec-action-grid"><a class="exec-action-card exec-genba" href="#/red-tag-home"><span class="exec-action-icon">${icon('tag',25)}</span><div><small>FROM FINDING TO FIX</small><h3>Genba &amp; Red Tag</h3><p>Review hazards, issue work orders<br>and follow up with your PICs.</p></div>${icon('arrow',22)}</a><a class="exec-action-card exec-orders" href="#/work-orders"><span class="exec-action-icon">${icon('briefcase',25)}</span><div><small>CLOSE THE LOOP</small><h3>SHE work orders</h3><p>Check maintenance progress<br>and verify completed work.</p></div>${icon('arrow',22)}</a></div></section><section class="exec-incoming"><div class="exec-section-heading"><h2>Needs your attention</h2><a href="#/reporting-inbox">View inbox →</a></div><div data-exec-recent aria-live="polite"><p class="exec-loading">Loading the latest open findings…</p></div></section><section class="exec-tools"><div class="exec-section-heading"><h2>Around the workspace</h2></div><div class="exec-tool-grid">${tools.filter(([route])=>canAccessRoute(route)).map(([route,label,symbol])=>`<a href="#/${route}">${icon(symbol,24)}<span>${label}</span></a>`).join('')}</div></section><p class="exec-home-note">Small actions. Better tomorrows.</p></div>`;
}

async function loadExecutiveOverview() {
  const root=content.querySelector('.executive-home'),userId=currentUser?.id;
  if(!root)return;
  try{
    const overview=await api('/api/workspace/overview');
    if(!root.isConnected||currentUser?.id!==userId)return;
    root.querySelectorAll('[data-overview-count]').forEach(el=>el.textContent=overview.counts[el.dataset.overviewCount]??'—');
    root.querySelector('[data-exec-recent]').innerHTML=overview.recent.length?overview.recent.map(r=>`<a class="exec-recent-row" href="${escapeHtml(r.href)}"><span class="exec-recent-icon">${icon(r.kind==='Genba'?'tag':r.kind==='Patrol'?'clipboard':'leaf',21)}</span><span><small>${escapeHtml(r.kind)} · ${new Date(r.created_at*1000).toLocaleDateString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short'})}</small><strong>${escapeHtml(r.title)}</strong><span>${escapeHtml(r.detail)}</span></span>${issueThumbnail(r.thumbnail_url)}${icon('chevron',18)}</a>`).join(''):'<div class="exec-empty">'+icon('shield',25)+'<strong>You’re up to date.</strong><p>No open findings or patrol follow-ups to review.</p></div>';
    bindIssueThumbnails(root);
  }catch(error){if(root.isConnected)root.querySelector('[data-exec-recent]').innerHTML=`<p class="exec-loading">${escapeHtml(error.message)} <button type="button" class="secondary-button" data-overview-retry>Refresh</button></p>`;root.querySelector('[data-overview-retry]')?.addEventListener('click',loadExecutiveOverview);}
}

function renderCommitteeHome() {
  const day=new Intl.DateTimeFormat('en-MY',{timeZone:'Asia/Kuala_Lumpur',weekday:'long',day:'numeric',month:'short'}).format(new Date());
  return `<div class="page inner-page home-page committee-page committee-home"><header class="committee-home-heading"><span class="committee-kicker">SAFETY STARTS WITH US</span><h1>Hello, ${escapeHtml(currentUser.display_name.split(' ')[0])}<span class="committee-wave" aria-hidden="true">✦</span></h1><p>${escapeHtml(day)} <span>·</span> Let’s look out for each other.</p></header><div class="home-actions committee-home-actions"><a class="committee-home-feature" href="#/red-tag-home"><span class="committee-feature-top"><span class="committee-kicker">SEE SOMETHING? SAY SOMETHING.</span>${icon('shield',32)}</span><h2>A small finding.<br>A safer tomorrow.</h2><p>Spot a hazard, add a photo,<br>and get the right person involved.</p><span class="committee-feature-cta">${icon('tag',19)} Open Red Tag ${icon('arrow',19)}</span></a><a class="committee-air-card" href="#/air-leak-home"><span class="committee-air-symbol">${icon('droplet',28)}</span><span><small>KEEP THE ENERGY IN</small><strong>Hear an air leak?</strong><span>Report it. We’ll issue the work order.</span></span>${icon('arrow',21)}</a></div><section class="committee-quick-section"><div class="committee-list-heading"><h2>Keep things moving</h2><span class="committee-kicker">YOUR TOOLS</span></div><div class="committee-quick-grid"><a href="#/red-tag-pic">${icon('tag',23)}<strong>My actions</strong><span>Follow up on assigned findings</span>${icon('arrow',16)}</a><a href="#/daily-safety-patrol">${icon('clipboard',23)}<strong>Safety patrol</strong><span>Take a closer look around</span>${icon('arrow',16)}</a></div></section><section class="committee-how"><span>${icon('shield',21)}</span><div><strong>Good observations make a difference.</strong><p>Notice it. Share it. Follow it through.<br>Everything else is a tap away in More.</p></div></section></div>`;
}

function sectionCard(key, number, description) {
  const dashboard={safety:'safety-dashboard',health:'health-dashboard',environmental:'environment-dashboard'}[key];
  const destination=SHEStats.allowed()&&canAccessRoute(dashboard)?dashboard:key;
  return `<a class="section-card" href="#/${destination}"><div class="section-card-top"><span class="section-icon ${key}">${icon(routes[key].icon, 25)}</span><span class="section-index">0${number} / 03</span></div><div><h3>${routes[key].title}</h3><p>${description}</p></div><span class="section-card-bottom"><span>Open ${routes[key].title} overview</span>${icon('arrow', 18)}</span></a>`;
}

function moduleCard(key, index) {
  return `<a class="module-card" href="#/${key}"><span class="module-icon">${icon(routes[key].icon, 23)}</span><span class="module-copy"><small>MODULE 0${index}</small><strong>${routes[key].title}</strong><span>${featureDescriptions[key]}</span></span><span class="module-arrow">${icon('arrow', 18)}</span></a>`;
}

function renderStatsDashboard(key) {
  if(key==='safety-dashboard')key=['accident-dashboard','red-tag-dashboard','hiyari-dashboard'].find(canAccessRoute);
  if(SHEMonitoring.configs[key]){SHEMonitoring.mount(key);return;}
  if(key==='co2-dashboard'){
    content.innerHTML='<div class="page inner-page focused-dashboard-page">'+dashboardHeader('environment','CO2 Tracking','Carbon emission tracking for the SHE programme.','co2-dashboard')+'<div class="placeholder-panel"><div class="placeholder-graphic"><span class="placeholder-ring"></span><span class="placeholder-symbol">'+icon('leaf',72)+'</span></div><span class="placeholder-kicker">PLACEHOLDER · COMING SOON</span><h2>CO2 tracking dashboard</h2><p>Emission figures, monthly trends and reduction targets will appear here once the CO2 data source is connected.</p><span class="placeholder-status"><span></span> Placeholder page</span></div></div>';
    bindDashboardHeader();return;
  }
  if(key==='health-dashboard'){
    content.innerHTML='<div class="page inner-page focused-dashboard-page">'+dashboardHeader('health','Health Dashboard','Health and wellbeing monitoring.')+'<section class="category-empty">No health modules have been added yet.</section></div>';
    bindDashboardHeader();return;
  }
  const config={
    'patrol-dashboard':{kind:'patrol',detail:'Monitor completed inspections, checklist findings, and patrol follow-up.',link:'patrol-overview',action:'Open patrol history'},
    'red-tag-dashboard':{kind:'red-tag',detail:'SSFM (Redtag) Gemba summary: findings, rank, STOP 6, section and PIC follow-up.',link:'red-tag',action:'Open genba findings'},
    'environment-dashboard':{kind:'environment',detail:'Monitor reporting topics, locations, activity, and work-order follow-up.',link:'reporting-inbox',action:'Open SHE reporting inbox'}
  }[key];
  const area=config.kind==='environment'?'environment':'safety';
  content.innerHTML='<div class="page inner-page focused-dashboard-page">'+dashboardHeader(area,area==='safety'?'Safety Dashboard':'Environment Dashboard','',key)+'<section id="focusStatistics"></section></div>';
  SHEStats.mount(document.getElementById('focusStatistics'),config.kind);
  const controls=content.querySelector('.she-stat-controls');content.querySelector('[data-dashboard-controls]').append(controls);
  bindDashboardHeader();
}

async function renderSheSummary() {
  const requestedHash=location.hash;
  content.innerHTML=`<div class="page inner-page she-summary-page"><div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SUGIHARA · SHE MONITORING</span><h1>SHE Summary</h1><p>One combined view across every SHE module — all dates.</p></div><button class="secondary-button" type="button" id="sheSummaryRefresh">Refresh</button></div><div class="she-overview-grid" id="sheSummaryBody" aria-live="polite"><div class="loading-panel">Loading SHE summary…</div></div><section class="she-summary-records" id="sheSummaryRecords"></section></div>`;
  const sources=[
    {title:'Safety Patrol',icon:'clipboard',link:canAccessRoute('patrol-dashboard')?'patrol-dashboard':'patrol-overview',url:'/api/patrols/statistics?period=all',patrol:true},
    {title:'Red Tag / Genba',icon:'tag',link:canAccessRoute('red-tag-dashboard')?'red-tag-dashboard':'red-tag-home',url:'/api/red-tags/statistics?period=all'},
    {title:'Hiyari Hatto',icon:'alert',link:'hiyari-dashboard',url:'/api/reporting/statistics?period=all&group=hiyari-hatto'},
    {title:'Air Leak',icon:'droplet',link:'air-leak-home',url:'/api/reporting/statistics?period=all&group=air-leak'},
    {title:'Green Eyes Event',icon:'leaf',link:'environment-dashboard',url:'/api/reporting/statistics?period=all&group=environment'},
    {title:'Kaizen',icon:'leaf',link:'reporting-inbox?area=kaizen',url:'/api/reporting/statistics?period=all&group=kaizen'}
  ];
  const results=await Promise.allSettled(sources.map(s=>api(s.url)));
  if(location.hash!==requestedHash||currentRoute()!=='she-summary')return;
  const body=document.getElementById('sheSummaryBody');
  body.innerHTML=sources.map((s,i)=>{
    const r=results[i];
    if(r.status==='rejected')return `<div class="she-overview-card she-overview-error"><span class="she-overview-icon">${icon(s.icon,22)}</span><strong>${escapeHtml(s.title)}</strong><p>${escapeHtml(r.reason?.message||'Unavailable')}</p></div>`;
    const d=r.value,sm=d.summary;
    const figures=s.patrol
      ?[[sm.total,'patrols'],[sm.with_findings,'with findings'],[d.backlog.outstanding,'need follow-up']]
      :[[sm.total,'total'],[d.backlog.outstanding,'outstanding'],[sm.completed,'resolved / closed']];
    const foot=s.patrol?(sm.ok_rate===null?'No checklist answers yet':`OK rate ${sm.ok_rate}%`):(sm.completion_rate===null?'No records yet':`${sm.completion_rate}% completed`);
    return `<a class="she-overview-card" href="#/${s.link}"><span class="she-overview-icon">${icon(s.icon,22)}</span><strong>${escapeHtml(s.title)}</strong><div class="she-overview-figures">${figures.map(([value,label])=>`<div><strong>${Number(value||0).toLocaleString('en-MY')}</strong><span>${label}</span></div>`).join('')}</div><small>${escapeHtml(foot)} · Open dashboard →</small></a>`;
  }).join('');
  const records=document.getElementById('sheSummaryRecords');
  const available=sources.filter((_,i)=>results[i].status==='fulfilled');
  if(available.length){
    records.innerHTML='<div class="she-record-heading"><h2>Overview table</h2><label>Module <select data-summary-module>'+available.map((source,index)=>'<option value="'+index+'">'+escapeHtml(source.title)+'</option>').join('')+'</select></label></div><div data-summary-records aria-live="polite"></div>';
    const select=records.querySelector('[data-summary-module]');
    const draw=()=>{
      const source=available[Number(select.value)];
      const kind=source.patrol?'patrol':source.url.startsWith('/api/red-tags/')?'red-tag':'environment';
      const target=document.createElement('div');
      records.querySelector('[data-summary-records]').replaceChildren(target);
      SHEStats.mountRecordResults(target,kind,new URLSearchParams(source.url.split('?')[1]));
    };
    select.onchange=draw;
    draw();
  }
  document.getElementById('sheSummaryRefresh')?.addEventListener('click',renderSheSummary);
}

function dashboardHeader(area,title,detail,key='') {
  const areas=[['safety','safety-dashboard','Safety'],['health','health-dashboard','Health'],['environment','environment-dashboard','Environment']];
  const modules=area==='safety'?['accident-dashboard','red-tag-dashboard','hiyari-dashboard','patrol-dashboard']:area==='environment'?['environment-dashboard','compound-dashboard','environmental-findings-dashboard','co2-dashboard']:[];
  const labels={'accident-dashboard':'Monthly accident statistic','red-tag-dashboard':'SSFM (Redtag) Gemba summary','hiyari-dashboard':'Hiyari Hatto Summary','patrol-dashboard':'Safety Patrol','compound-dashboard':'Environmental Enforcement Register','environmental-findings-dashboard':'Environmental Inspection Register','co2-dashboard':'CO2 tracking','environment-dashboard':'Green Eyes Event'};
  return '<section class="dashboard-hero"><div class="dashboard-area-tabs" aria-label="Dashboard areas">'+areas.filter(([,route])=>canAccessRoute(route)).map(([id,route,label])=>'<a href="#/'+route+'" '+(id===area?'aria-current="page"':'')+'>'+label+'</a>').join('')+'</div><h1>'+title+'</h1>'+(detail?'<p>'+detail+'</p>':'')+'<div class="dashboard-hero-controls">'+(modules.length?'<label>'+ (area==='safety'?'Safety':'Environment')+' module<select data-dashboard-module>'+modules.filter(canAccessRoute).map(route=>'<option value="'+route+'" '+(route===key?'selected':'')+'>'+labels[route]+'</option>').join('')+'</select></label>':'')+'<div data-dashboard-controls></div></div></section>';
}
function bindDashboardHeader(){content.querySelector('[data-dashboard-module]')?.addEventListener('change',e=>{location.hash='#/'+e.target.value;});}

function renderSafetyHome() {
  const descriptions = {
    'accident-register':'Update monthly accident counts, man-hours, and review saved revisions.',
    'daily-safety-patrol':'Complete a checklist, review patrol history, or build a checklist.',
    'red-tag':'Record findings, follow current actions, and review history.',
    'air-leak':'Report leaks, track current active reports, and review history.',
    'hiyari-hatto':'Complete a near-miss report, follow current cases, and review history.'
  };
  return `<div class="page inner-page category-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / SAFETY</span><h1>Safety</h1><p>Choose a tool to report, follow up, or review past records.</p></div><div class="module-grid">${safetyItems.filter(canAccessRoute).map(key=>`<a class="module-card" href="#/${moduleEntryRoute(key)}"><span class="module-icon">${icon(routes[key].icon,23)}</span><span class="module-copy"><strong>${routes[key].title}</strong><span>${descriptions[key]}</span></span><span class="module-arrow">${icon('arrow',18)}</span></a>`).join('')}</div></div>`;
}

function renderHealth() {
  return `<div class="page inner-page category-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / HEALTH</span><h1>Health</h1><p>A dedicated home for health and wellbeing work.</p></div><section class="category-banner health-banner"><div><span class="banner-kicker">HEALTH OVERVIEW</span><h2>Care for people.<br />Build healthy days.</h2><p>Health features and their activity will appear here as they are added.</p></div><span class="category-banner-icon" aria-hidden="true">${icon('heart', 76)}</span></section><div class="content-heading"><div><span class="eyebrow dark-eyebrow">HEALTH FEATURES</span><h2>Health modules</h2></div></div><div class="category-empty">No health modules have been added yet.</div></div>`;
}

async function loadSafetyPulse(targetId) {
  if(!document.getElementById(targetId))return;
  if(!SHEStats.allowed()){const target=document.getElementById(targetId);if(target)target.textContent='Open the tools available to your account.';return;}
  if (!canAccessRoute('daily-safety-patrol')) { const target=document.getElementById(targetId); if(target) target.textContent='Open Red Tag to record and review safety genba findings.'; return; }
  const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  try {
    const {patrols} = await api(`/api/patrols?start=${Math.floor(start.getTime() / 1000)}&end=${Math.floor(end.getTime() / 1000)}`);
    const target = document.getElementById(targetId);
    if (!target) return;
    const findings = patrols.reduce((sum, row) => sum + row.counts.not_ok, 0);
    target.textContent = `${patrols.length} ${patrols.length === 1 ? 'patrol' : 'patrols'} this month · ${findings} NOT OK ${findings === 1 ? 'item' : 'items'}`;
  } catch {
    const target = document.getElementById(targetId);
    if (target) target.textContent = 'Patrol activity is unavailable right now.';
  }
}

function renderEnvironmental() {
  return `<div class="page inner-page category-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / ENVIRONMENTAL</span><h1>Environmental</h1><p>A central place for environmental awareness, reporting and follow-up.</p></div><section class="environment-banner"><div><span class="banner-kicker">ENVIRONMENTAL OVERVIEW</span><h2>See it. Report it.<br />Improve it.</h2><p>Environmental features and their activity will appear here as they are added.</p></div><span class="banner-icon" aria-hidden="true">${icon('leaf', 88)}</span></section><div class="content-heading"><div><span class="eyebrow dark-eyebrow">PLANNED AREAS</span><h2>Environmental modules</h2></div><span class="count-pill">04 spaces</span></div><div class="module-grid">${envItems.map((key, index) => moduleCard(key, index + 1)).join('')}</div><div class="quiet-note">These pages are placeholders. Reporting forms, workflows and live data will be added in a later phase.</div></div>`;
}

function renderPlaceholder(key) {
  const isEnv = envItems.includes(key);
  const parent = isEnv ? 'Environmental' : 'SHE section';
  const detail = isEnv ? featureDescriptions[key] : `The ${routes[key].title} area is reserved for future SHE workflows.`;
  return `<div class="page inner-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">${parent.toUpperCase()} / PLANNED SPACE</span><h1>${routes[key].title}</h1><p>${detail}</p></div><div class="placeholder-panel"><div class="placeholder-graphic"><span class="placeholder-ring"></span><span class="placeholder-symbol">${icon(routes[key].icon, 72)}</span></div><span class="placeholder-kicker">COMING IN A FUTURE PHASE</span><h2>A space ready to grow.</h2><p>This section is set up in the navigation. Its forms, records and workflows will be designed when the requirements are ready.</p><span class="placeholder-status"><span></span> Placeholder page</span></div>${key === 'findings' ? `<section class="findings-preview"><div><span class="eyebrow dark-eyebrow">REFERENCE TOPICS</span><h2>Environmental concerns</h2><p>Topics taken from the supplied environmental reporting poster.</p></div><div class="topic-grid">${findings.map(([label, symbol]) => `<div class="topic-chip">${icon(symbol, 18)}<span>${label}</span></div>`).join('')}</div></section>` : ''}<a class="back-link" href="#/${isEnv ? 'environmental' : 'dashboard'}">${icon('arrow', 17)} Back to ${isEnv ? 'Environmental' : 'Dashboard'}</a></div>`;
}

function roleLabel(role) { return role === 'admin' ? 'Administrator' : role === 'executive' ? 'Executive' : role === 'safety_committee' ? 'Safety Committee' : 'User'; }

function renderAccount() {
  return `<div class="page inner-page narrow-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">WORKSPACE / ACCOUNT</span><h1>My Account</h1><p>Manage your SHE Digital sign-in details.</p></div><section class="settings-card"><div class="account-identity"><span class="account-avatar">${escapeHtml(currentUser.display_name.charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(currentUser.display_name)}</strong><span>@${escapeHtml(currentUser.username)} · ${roleLabel(currentUser.role)}</span></div></div><h2>Change password</h2><p>Use at least 12 characters. You will need to sign in again after changing it.</p><form id="passwordForm" class="stacked-form"><label for="currentPassword">Current password</label><input id="currentPassword" name="current_password" type="password" autocomplete="current-password" required /><label for="newPassword">New password</label><input id="newPassword" name="new_password" type="password" autocomplete="new-password" minlength="12" required /><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirm_password" type="password" autocomplete="new-password" minlength="12" required /><div class="form-error" id="accountError" role="alert" hidden></div><button class="primary-button" type="submit">Update password</button></form></section></div>`;
}

function renderUserRow(user) {
  const self = user.id === currentUser.id;
  return `<div class="user-row"><span class="user-avatar">${escapeHtml(user.display_name.charAt(0).toUpperCase())}</span><div class="user-primary"><strong>${escapeHtml(user.display_name)}${self ? ' <small>(you)</small>' : ''}</strong><span>@${escapeHtml(user.username)}</span></div><span class="role-badge">${roleLabel(user.role)}</span><span class="state-badge ${user.active ? 'enabled' : 'disabled'}"><i></i>${user.active ? 'Active' : 'Inactive'}</span><div class="user-actions"><button type="button" data-edit-user="${user.id}">Edit</button><button type="button" data-reset-user="${user.id}">Reset password</button></div></div>`;
}

async function renderUsers() {
  content.innerHTML = `<div class="page inner-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">WORKSPACE / ADMINISTRATION</span><h1>User Management</h1><p>Manage access to the SHE Digital workspace.</p></div><div class="loading-panel">Loading users…</div></div>`;
  try {
    const result = await api('/api/users');
    if (currentRoute() !== 'users') return;
    managedUsers = result.users;
    content.innerHTML = `<div class="page inner-page"><div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">WORKSPACE / ADMINISTRATION</span><h1>User Management</h1><p>Create accounts, update roles, and control access.</p></div><button class="primary-button" type="button" data-create-user>+ Add user</button></div><div class="users-summary"><span class="users-summary-icon">${icon('users', 23)}</span><div><strong>${managedUsers.length} ${managedUsers.length === 1 ? 'account' : 'accounts'}</strong><span>${managedUsers.filter(user => user.active).length} active in this workspace</span></div></div><section class="users-list"><div class="users-list-heading"><span>TEAM MEMBERS</span><span>ACCESS & STATUS</span></div>${managedUsers.map(renderUserRow).join('')}</section><p class="users-help">New users sign in with the password you set. Share it with them through your approved internal channel. Password resets sign the user out of all sessions.</p></div>`;
  } catch (error) {
    content.innerHTML = `<div class="page inner-page"><div class="form-error">${escapeHtml(error.message)}</div></div>`;
  }
}

async function api(path, method = 'GET', body = null) {
  const options = {method, credentials: 'same-origin', headers: {}};
  if (body !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  if (method !== 'GET' && path !== '/api/login') options.headers['X-CSRF-Token'] = csrfToken;
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login' && path !== '/api/session') showLogin();
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function showLogin(message = '') {
  SHEReportAlerts.stop();
  cmmsStop();
  closeMenu();
  currentUser = null;
  csrfToken = '';
  appShell.hidden = true;
  appShell.classList.remove('app-shell');
  loginScreen.hidden = false;
  document.title = 'Sign in · SHE Digital';
  loginError.hidden = !message;
  loginError.textContent = message;
  loginError.classList.toggle('success', message.startsWith('Password updated'));
  try {
    const setup = await api('/api/setup-status');
    setupMessage.hidden = !setup.needs_admin;
  } catch {
    setupMessage.hidden = true;
  }
}

function showApp(session) {
  currentUser = session.user;
  document.body.classList.toggle('committee-app',currentUser.role==='safety_committee');
  if (canAccessRoute('work-orders')) cmmsStart();
  csrfToken = session.csrf_token;
  if (!document.getElementById('reportNotificationButton')) {
    const button=document.createElement('button'); button.id='reportNotificationButton'; button.type='button'; button.className='secondary-button report-notification-button';
    document.querySelector('.topbar-right').prepend(button);
  }
  SHEReportAlerts.start();
  loginScreen.hidden = true;
  appShell.classList.add('app-shell');
  appShell.hidden = false;
  loginForm.reset();
  headerUser.textContent = currentUser.display_name;
  document.getElementById('headerAvatar').textContent=currentUser.display_name.trim().charAt(0).toUpperCase();
  document.getElementById('headerProfileRole').textContent=roleLabel(currentUser.role);
  if (!canAccessRoute(currentRoute())) location.hash='#/home';
  render();
}

function notify(message) {
  toastBox.textContent = message;
  toastBox.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toastBox.hidden = true; }, 4000);
}

let modalEditedContent = null;
function dismissModal() {
  modalBackdrop.hidden = true;
  modalBody.innerHTML = '';
  modalEditedContent = null;
}
function modalHasEdits() {
  return Boolean(modalEditedContent) && modalEditedContent === modalBody.firstElementChild;
}

function closeModal() {
  const findingForm=Boolean(modalBody.querySelector('#genbaForm'));
  dismissModal();
  if(findingForm&&currentRoute()==='red-tag'&&new URLSearchParams(location.hash.split('?')[1]||'').get('new')==='1')location.hash='#/red-tag-home';
}

function openUserModal(kind, user = null) {
  let title = '';
  let fields = '';
  if (kind === 'create') {
    title = 'Add a user';
    fields = `<label for="userName">Username</label><input id="userName" name="username" autocomplete="off" minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" required /><label for="displayName">Display name</label><input id="displayName" name="display_name" maxlength="80" required /><label for="userRole">Role</label><select id="userRole" name="role"><option value="user">User — own patrols</option><option value="safety_committee">Safety Committee — own patrols</option><option value="executive">Executive — all patrols</option><option value="admin">Administrator — all access</option></select><label for="userPassword">Initial password</label><input id="userPassword" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><p class="field-hint">Use at least 12 characters.</p>`;
  } else if (kind === 'edit') {
    title = `Edit ${user.display_name}`;
    fields = `<label for="displayName">Display name</label><input id="displayName" name="display_name" maxlength="80" value="${escapeHtml(user.display_name)}" required /><label for="userRole">Role</label><select id="userRole" name="role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>User — own patrols</option><option value="safety_committee" ${user.role === 'safety_committee' ? 'selected' : ''}>Safety Committee — own patrols</option><option value="executive" ${user.role === 'executive' ? 'selected' : ''}>Executive — all patrols</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator — all access</option></select><label for="userStatus">Status</label><select id="userStatus" name="active"><option value="true" ${user.active ? 'selected' : ''}>Active</option><option value="false" ${!user.active ? 'selected' : ''}>Inactive</option></select>${user.id === currentUser.id ? '<p class="field-hint">You cannot remove your own admin access.</p>' : ''}`;
  } else {
    title = `Reset password`;
    fields = `<p class="modal-description">Set a new password for ${escapeHtml(user.display_name)}. All current sessions for this user will end.</p><label for="userPassword">New password</label><input id="userPassword" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />`;
  }
  modalBody.innerHTML = `<span class="eyebrow dark-eyebrow">USER MANAGEMENT</span><h2 id="modalTitle">${escapeHtml(title)}</h2><form id="userModalForm" class="stacked-form">${fields}<div class="form-error" id="modalError" role="alert" hidden></div><div class="modal-actions"><button class="secondary-button" type="button" id="cancelModal">Cancel</button><button class="primary-button" type="submit">${kind === 'create' ? 'Create user' : kind === 'edit' ? 'Save changes' : 'Reset password'}</button></div></form>`;
  if(currentUser.role === 'executive') { modalBody.querySelectorAll('#userRole option').forEach(o => { if(o.value !== 'user') o.remove(); }); }
  addPasswordToggles(modalBody);
  modalBackdrop.hidden = false;
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  document.getElementById('userModalForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    if (kind === 'edit') data.active = data.active === 'true';
    submit.disabled = true;
    try {
      if (kind === 'create') await api('/api/users', 'POST', data);
      if (kind === 'edit') {
        const result = await api(`/api/users/${user.id}`, 'PATCH', data);
        if (user.id === currentUser.id) { currentUser = result.user; headerUser.textContent = currentUser.display_name; }
      }
      if (kind === 'reset') await api(`/api/users/${user.id}/reset-password`, 'POST', data);
      closeModal();
      if (kind === 'reset' && user.id === currentUser.id) { await showLogin('Password updated. Please sign in again.'); return; }
      notify(kind === 'create' ? 'User created.' : kind === 'edit' ? 'User updated.' : 'Password reset.');
      await renderUsers();
    } catch (error) {
      const output = document.getElementById('modalError');
      if (output) { output.hidden = false; output.textContent = error.message; }
    } finally { submit.disabled = false; }
  });
  modalBody.querySelector('input,select')?.focus();
}

function currentRoute() {
  const key = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || (['admin','executive'].includes(currentUser?.role)?'dashboard':'home');
  return routes[key] ? key : 'home';
}

function closeMenu() {
  sidebar.classList.remove('mobile-open');
  backdrop.classList.remove('visible');
  document.body.classList.remove('mobile-sidebar-open');
  menuButton.setAttribute('aria-expanded', 'false');
  document.getElementById('mobileMoreButton')?.setAttribute('aria-expanded', 'false');
}

function toggleMenu() {
  const open = !sidebar.classList.contains('mobile-open');
  sidebar.classList.toggle('mobile-open', open);
  backdrop.classList.toggle('visible', open);
  document.body.classList.toggle('mobile-sidebar-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  document.getElementById('mobileMoreButton')?.setAttribute('aria-expanded', String(open));
  if (open) sidebarClose.focus();
}

let dashboardTransition=null;
let lastRenderedHash='';
function render() {
  if(!currentUser)return;
  if(!modalBackdrop.hidden)dismissModal();
  const hash=location.hash;
  const dashboardRoute=value=>/^#\/(?:dashboard(?:$|[/?])|(?:patrol|red-tag|environment|co2)-dashboard|dashboard-records|she-summary)/.test(value);
  const changing=lastRenderedHash&&lastRenderedHash!==hash&&(dashboardRoute(hash)||dashboardRoute(lastRenderedHash));
  lastRenderedHash=hash;SHEStats.hideTooltip();
  if(dashboardTransition)dashboardTransition.skipTransition();
  if(changing&&document.startViewTransition&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.body.classList.add('dashboard-transition-active');
    const transition=document.startViewTransition(()=>{if(location.hash===hash)renderPage();});dashboardTransition=transition;
    transition.ready.catch(()=>{});transition.finished.catch(()=>{}).finally(()=>{if(dashboardTransition===transition){dashboardTransition=null;document.body.classList.remove('dashboard-transition-active');}});
  }else renderPage();
}

function renderPage() {
  if (!currentUser) return;
  const key = currentRoute();
  document.getElementById('headerProfile').open=false;
  SHEStats.hideTooltip();
  dashboardsExpanded=key==='dashboard'||key.endsWith('-dashboard')||key==='dashboard-records'||key==='she-summary';
  safetyExpanded = (key==='safety'||safetyItems.includes(safetyModule(key)));
  envExpanded = key === 'environmental' || envItems.includes(key) || key.startsWith('reporting-');
  if (!canAccessRoute(key)) { location.hash = '#/home'; return; }
  renderNav(key);
  renderMobileNavigation(key);
  breadcrumb.textContent = routes[key].title;
  document.title = `${routes[key].title} · SHE Digital`;
  if(isSafetyModuleRoute(key))syncModuleTabs();
  if (key === 'home') {content.innerHTML = renderHome();loadExecutiveOverview();}
  else if (key === 'patrol-home') renderPatrolHome();
  else if(findingModuleHomes[key])renderFindingModuleHome(key);
  else if (key === 'air-leak') renderAirLeak();
  else if (key === 'users') renderUsers();
  else if(key==='dashboard-records')SHEStats.renderRecords();
  else if(key==='she-summary')renderSheSummary();
  else if(key==='accident-register')SHEMonitoring.mount('accident-dashboard',true);
  else if(key==='dashboard'||key.endsWith('-dashboard'))renderStatsDashboard(key==='dashboard'?'safety-dashboard':key);
  else if (['red-tag','red-tag-pic'].includes(key)) renderGenba().then(()=>{const id=location.hash.split('/')[2];if(currentRoute()===key&&/^\d+$/.test(id||''))genbaDetail(id);else if(currentRoute()===key&&new URLSearchParams(location.hash.split('?')[1]||'').get('new')==='1')genbaNew();});
  else if (key === 'work-orders') renderWorkOrders();
  else if (key === 'checklist-builder') renderChecklistBuilder();
  else if (key === 'patrol-overview') renderPatrolOverview();
  else if (key === 'daily-safety-patrol') {
    const id = location.hash.split('?')[0].split('/')[2];
    if (id && /^\d+$/.test(id)) renderPatrolDetail(id);
    else renderPatrolForm();
  }
  else if (['environmental', 'reporting-qr', 'findings', 'hiyari-hatto', 'kaizen', 'reporting-forms', 'reporting-inbox'].includes(key)) SHEReporting.renderStaff(key).then(()=>{if(currentRoute()===key)filterFeatureLinks(content);});
  else content.innerHTML = key === 'safety' ? renderSafetyHome() : key === 'health' ? renderHealth() : key === 'account' ? renderAccount() : renderPlaceholder(key);
  filterFeatureLinks(content);
  filterFeatureLinks(mobileTabbar);
  if (key === 'dashboard') loadSafetyPulse('dashboardSafetyPulse');
  if (key === 'safety') loadSafetyPulse('safetyHomePulse');
  if (key === 'account') {
    addPasswordToggles(content);
    content.querySelector('.narrow-page').insertAdjacentHTML('beforeend', installHelpCard());
  }
  window.scrollTo(0, 0);
  closeMenu();
}

menuButton.addEventListener('click', toggleMenu);
sidebarClose.addEventListener('click', () => { closeMenu(); document.getElementById('mobileMoreButton')?.focus(); });
backdrop.addEventListener('click', closeMenu);
mobileTabbar.addEventListener('click', event => {
  if (event.target.closest('[data-mobile-more]')) toggleMenu();
});
nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMenu();syncModuleTabs(); });
document.addEventListener('keydown', event => {
  if (!sidebar.classList.contains('mobile-open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeMenu(); document.getElementById('mobileMoreButton')?.focus(); }
  if (event.key !== 'Tab') return;
  const focusable = [...sidebar.querySelectorAll('a,button')].filter(item => !item.closest('[hidden]') && item.getClientRects().length);
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener('hashchange', render);
modalBody.addEventListener('input', event => { if (event.isTrusted) modalEditedContent = modalBody.firstElementChild; });
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop && !modalHasEdits()) closeModal(); });
document.getElementById('modalClose').addEventListener('click', closeModal);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modalBackdrop.hidden) closeModal(); });

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const submit = loginForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  loginError.hidden = true;
  try {
    const session = await api('/api/login', 'POST', {username: loginForm.username.value, password: loginForm.password.value});
    showApp(session);
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally { submit.disabled = false; }
});

document.getElementById('signOutButton').addEventListener('click', async () => {
  try { await api('/api/logout', 'POST', {}); } catch { /* Expired sessions still leave the UI. */ }
  closeModal();
  showLogin();
});

content.addEventListener('click', event => {
  if (event.target.closest('[data-install-app]') && installPrompt) {
    installPrompt.prompt();
    installPrompt = null;
    event.target.closest('[data-install-app]').hidden = true;
  }
  if (event.target.closest('[data-create-user]')) openUserModal('create');
  const edit = event.target.closest('[data-edit-user]');
  if (edit) openUserModal('edit', managedUsers.find(user => user.id === Number(edit.dataset.editUser)));
  const reset = event.target.closest('[data-reset-user]');
  if (reset) openUserModal('reset', managedUsers.find(user => user.id === Number(reset.dataset.resetUser)));
});

content.addEventListener('submit', async event => {
  if (event.target.id !== 'passwordForm') return;
  event.preventDefault();
  const form = event.target;
  const output = document.getElementById('accountError');
  const data = Object.fromEntries(new FormData(form));
  output.hidden = true;
  if (data.new_password !== data.confirm_password) {
    output.textContent = 'New passwords do not match.';
    output.hidden = false;
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/me/password', 'POST', {current_password: data.current_password, new_password: data.new_password});
    await showLogin('Password updated. Please sign in again.');
  } catch (error) {
    output.textContent = error.message;
    output.hidden = false;
  } finally { button.disabled = false; }
});

const headerProfile=document.getElementById('headerProfile');
document.addEventListener('click',event=>{if(!headerProfile.contains(event.target))headerProfile.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&headerProfile.open){headerProfile.open=false;headerProfile.querySelector('summary').focus();}});
document.getElementById('headerMyProfile').addEventListener('click',()=>{headerProfile.open=false;});
document.getElementById('signOutButton').addEventListener('click',()=>{headerProfile.open=false;});

async function bootstrap() {
  try { showApp(await api('/api/session')); }
  catch { await showLogin(); }
}
bootstrap();
addPasswordToggles(loginForm);
initPatrolEvents();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
