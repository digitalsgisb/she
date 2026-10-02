const icon = (name, size = 20) => {
  const paths = {
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

const routes = {
  dashboard: { title: 'Dashboard', icon: 'grid' },
  environmental: { title: 'Environmental', icon: 'leaf' },
  'red-tag': { title: 'Red Tag', icon: 'tag' },
  'hiyari-hatto': { title: 'Hiyari Hatto', icon: 'alert' },
  waste: { title: 'Waste', icon: 'waste' },
  findings: { title: 'Environmental Findings', icon: 'clipboard' },
  safety: { title: 'Safety', icon: 'shield' },
  'daily-safety-patrol': { title: 'Daily Safety Patrol Checklist', icon: 'clipboard' },
  'patrol-overview': { title: 'Patrol Overview & History', icon: 'grid' },
  health: { title: 'Health', icon: 'heart' },
  users: { title: 'User Management', icon: 'users' },
  'work-orders': { title: 'SHE Work Orders', icon: 'clipboard' },
  account: { title: 'My Account', icon: 'person' },
};

const envItems = ['red-tag', 'hiyari-hatto', 'waste', 'findings'];
const featureDescriptions = {
  'red-tag': 'A space for Red Tag records and follow-up.',
  'hiyari-hatto': 'A space to capture near misses and early warnings.',
  waste: 'A space for waste handling and segregation.',
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
const mobileMoreSheet = document.getElementById('mobileMoreSheet');
const mobileMoreBackdrop = document.getElementById('mobileMoreBackdrop');
let currentUser = null;
let csrfToken = '';
let managedUsers = [];
let envExpanded = false;
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
  return `<section class="settings-card install-card"><h2>Use SHE Digital on your phone</h2><p>Install it to your Home Screen for quick access to the Daily Safety Patrol Checklist. An internet connection is needed to sign in and submit patrols; draft answers are saved on this device while you fill the form.</p><button class="primary-button" type="button" data-install-app ${installPrompt ? '' : 'hidden'}>Install app</button><div class="install-instructions"><strong>iPhone or iPad</strong><span>Open this site in Safari, tap Share, then Add to Home Screen.</span><strong>Android</strong><span>Open this site in Chrome and use Install app or Add to Home screen from the browser menu.</span></div></section>`;
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
  const tab = active === 'dashboard' ? 'dashboard' : active === 'daily-safety-patrol' ? 'daily-safety-patrol' : active === 'patrol-overview' ? 'patrol-overview' : active === 'work-orders' ? 'work-orders' : 'more';
  mobileTabbar.innerHTML = `${mobileTab('dashboard', 'Home', 'grid', tab === 'dashboard')}${mobileTab('daily-safety-patrol', 'Patrol', 'clipboard', tab === 'daily-safety-patrol')}${mobileTab('patrol-overview', 'History', 'clock', tab === 'patrol-overview')}${mobileTab('work-orders', 'Orders', 'briefcase', tab === 'work-orders')}<button class="mobile-tab ${tab === 'more' ? 'active' : ''}" id="mobileMoreButton" type="button" data-mobile-more aria-label="More sections" aria-expanded="false" aria-controls="mobileMoreSheet">${icon('menu', 20)}<span>More</span></button>`;
  mobileMoreSheet.innerHTML = `<div class="mobile-more-heading"><div><span class="eyebrow dark-eyebrow">SHE DIGITAL</span><h2 id="mobileMoreTitle">More sections</h2></div><button type="button" class="mobile-more-close" data-mobile-more-close aria-label="Close more sections">×</button></div><div class="mobile-more-group"><small>SHE SECTIONS</small><a href="#/safety">${icon('shield', 20)}<span>Safety</span>${icon('chevron', 16)}</a><a href="#/health">${icon('heart', 20)}<span>Health</span>${icon('chevron', 16)}</a><a href="#/environmental">${icon('leaf', 20)}<span>Environmental</span>${icon('chevron', 16)}</a></div><div class="mobile-more-group"><small>WORKSPACE</small><a href="#/account">${icon('person', 20)}<span>My Account</span>${icon('chevron', 16)}</a>${currentUser?.role === 'admin' ? `<a href="#/users">${icon('users', 20)}<span>User Management</span>${icon('chevron', 16)}</a>` : ''}</div>`;
}

function closeMobileMore(restoreFocus = false) {
  const wasOpen = !mobileMoreSheet.hidden;
  mobileMoreSheet.hidden = true;
  mobileMoreBackdrop.hidden = true;
  document.body.classList.remove('mobile-more-open');
  const button = document.getElementById('mobileMoreButton');
  if (button) button.setAttribute('aria-expanded', 'false');
  if (restoreFocus && wasOpen) button?.focus();
}

function toggleMobileMore() {
  if (!mobileMoreSheet.hidden) { closeMobileMore(true); return; }
  mobileMoreBackdrop.hidden = false;
  mobileMoreSheet.hidden = false;
  document.body.classList.add('mobile-more-open');
  document.getElementById('mobileMoreButton')?.setAttribute('aria-expanded', 'true');
  mobileMoreSheet.querySelector('a')?.focus();
}

function renderNav(active) {
  nav.innerHTML = `<div class="nav-label">OVERVIEW</div>${routeLink('dashboard', `nav-link ${active === 'dashboard' ? 'active' : ''}`)}
    <div class="nav-label nav-label-spaced">SHE SECTIONS</div>
    <div class="nav-parent"><a class="nav-link ${['safety', 'daily-safety-patrol', 'patrol-overview'].includes(active) ? 'active' : ''}" href="#/safety"><span class="link-icon">${icon('shield')}</span><span>Safety</span></a><button class="nav-toggle ${safetyExpanded ? 'expanded' : ''}" id="safetyToggle" type="button" aria-label="${safetyExpanded ? 'Collapse' : 'Expand'} Safety subsections" aria-expanded="${safetyExpanded}" aria-controls="safetySubnav">${icon('chevron', 16)}</button></div>
    <div class="subnav ${safetyExpanded ? 'expanded' : ''}" id="safetySubnav" ${safetyExpanded ? '' : 'hidden'}><a class="subnav-link ${active === 'daily-safety-patrol' ? 'active' : ''}" href="#/daily-safety-patrol"><span class="subnav-dot"></span>Daily Safety Patrol Checklist</a><a class="subnav-link ${active === 'patrol-overview' ? 'active' : ''}" href="#/patrol-overview"><span class="subnav-dot"></span>Patrol Overview &amp; History</a></div>
    ${routeLink('health', `nav-link ${active === 'health' ? 'active' : ''}`)}
    <div class="nav-parent"><a class="nav-link ${active === 'environmental' || envItems.includes(active) ? 'active' : ''}" href="#/environmental"><span class="link-icon">${icon('leaf')}</span><span>Environmental</span></a><button class="nav-toggle ${envExpanded ? 'expanded' : ''}" id="envToggle" type="button" aria-label="${envExpanded ? 'Collapse' : 'Expand'} Environmental subsections" aria-expanded="${envExpanded}" aria-controls="environmentSubnav">${icon('chevron', 16)}</button></div>
    <div class="subnav ${envExpanded ? 'expanded' : ''}" id="environmentSubnav" ${envExpanded ? '' : 'hidden'}>${envItems.map(key => `<a class="subnav-link ${active === key ? 'active' : ''}" href="#/${key}"><span class="subnav-dot"></span>${routes[key].title}</a>`).join('')}</div>
    <div class="nav-label nav-label-spaced">WORKSPACE</div>
    ${routeLink('work-orders', `nav-link ${active === 'work-orders' ? 'active' : ''}`)}
    ${currentUser?.role === 'admin' ? routeLink('users', `nav-link ${active === 'users' ? 'active' : ''}`) : ''}
    ${routeLink('account', `nav-link ${active === 'account' ? 'active' : ''}`)}`;
  document.getElementById('envToggle').addEventListener('click', () => {
    envExpanded = !envExpanded;
    renderNav(currentRoute());
  });
  document.getElementById('safetyToggle').addEventListener('click', () => {
    safetyExpanded = !safetyExpanded;
    renderNav(currentRoute());
  });
}

function sectionCard(key, number, description) {
  return `<a class="section-card" href="#/${key}"><div class="section-card-top"><span class="section-icon ${key}">${icon(routes[key].icon, 25)}</span><span class="section-index">0${number} / 03</span></div><div><h3>${routes[key].title}</h3><p>${description}</p></div><span class="section-card-bottom"><span>Open ${routes[key].title} overview</span>${icon('arrow', 18)}</span></a>`;
}

function moduleCard(key, index) {
  return `<a class="module-card" href="#/${key}"><span class="module-icon">${icon(routes[key].icon, 23)}</span><span class="module-copy"><small>MODULE 0${index}</small><strong>${routes[key].title}</strong><span>${featureDescriptions[key]}</span></span><span class="module-arrow">${icon('arrow', 18)}</span></a>`;
}

function renderDashboard() {
  return `<div class="page dashboard-page"><section class="hero"><div class="hero-text"><div class="eyebrow hero-eyebrow"><span class="eyebrow-line"></span>SUGIHARA · SHE WORKSPACE</div><h1>Good day.<br /><em>Let's make every day safer.</em></h1><p>Your shared view of Safety, Health and Environmental work. Open a section to see its features and activity.</p><a class="hero-action" href="#/safety">Explore Safety ${icon('arrow', 19)}</a></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-leaf">${icon('leaf', 104)}</div><span class="art-caption">SAFETY&nbsp; · &nbsp;HEALTH&nbsp; · &nbsp;ENVIRONMENT</span></div></section>
    <div class="intro-row"><div><span class="eyebrow dark-eyebrow">ALL SHE AREAS</span><h2>One dashboard. Three areas.</h2><p>Start with an area, then open the feature you need.</p></div></div>
    <div class="section-grid">${sectionCard('safety', 1, 'Patrol checklists, monitoring and future safety tools.')}${sectionCard('health', 2, 'The home for health and wellbeing features.')}${sectionCard('environmental', 3, 'Environmental reporting areas and future tools.')}</div>
    <div class="content-heading"><div><span class="eyebrow dark-eyebrow">AT A GLANCE</span><h2>Across the workspace</h2></div></div><div class="workspace-overview-grid"><a class="workspace-overview-tile" href="#/safety"><span class="workspace-overview-icon">${icon('shield', 23)}</span><strong>Safety</strong><p id="dashboardSafetyPulse">Loading this month's patrol activity…</p><span>Open Safety ${icon('arrow', 16)}</span></a><a class="workspace-overview-tile" href="#/health"><span class="workspace-overview-icon">${icon('heart', 23)}</span><strong>Health</strong><p>Health modules are ready to be added.</p><span>Open Health ${icon('arrow', 16)}</span></a><a class="workspace-overview-tile" href="#/environmental"><span class="workspace-overview-icon">${icon('leaf', 23)}</span><strong>Environmental</strong><p>Four planned reporting areas.</p><span>Open Environmental ${icon('arrow', 16)}</span></a></div></div>`;
}

function renderSafetyHome() {
  return `<div class="page inner-page category-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / SAFETY</span><h1>Safety</h1><p>Your home for safety inspections, monitoring, and the next safety features.</p></div><section class="category-banner"><div><span class="banner-kicker">SAFETY OVERVIEW</span><h2>Inspect. Review.<br />Improve.</h2><p id="safetyHomePulse">Loading this month's patrol activity…</p></div><span class="category-banner-icon" aria-hidden="true">${icon('shield', 76)}</span></section><div class="content-heading"><div><span class="eyebrow dark-eyebrow">SAFETY FEATURES</span><h2>Choose a tool</h2></div><span class="count-pill">02 spaces</span></div><div class="module-grid"><a class="module-card" href="#/daily-safety-patrol"><span class="module-icon">${icon('clipboard', 23)}</span><span class="module-copy"><small>INSPECTION</small><strong>Daily Safety Patrol Checklist</strong><span>Complete and submit the 23-item safety patrol.</span></span><span class="module-arrow">${icon('arrow', 18)}</span></a><a class="module-card" href="#/patrol-overview"><span class="module-icon">${icon('grid', 23)}</span><span class="module-copy"><small>MONITORING</small><strong>Patrol Overview &amp; History</strong><span>Review weekly or monthly activity, findings, and saved patrols.</span></span><span class="module-arrow">${icon('arrow', 18)}</span></a></div></div>`;
}

function renderHealth() {
  return `<div class="page inner-page category-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / HEALTH</span><h1>Health</h1><p>A dedicated home for health and wellbeing work.</p></div><section class="category-banner health-banner"><div><span class="banner-kicker">HEALTH OVERVIEW</span><h2>Care for people.<br />Build healthy days.</h2><p>Health features and their activity will appear here as they are added.</p></div><span class="category-banner-icon" aria-hidden="true">${icon('heart', 76)}</span></section><div class="content-heading"><div><span class="eyebrow dark-eyebrow">HEALTH FEATURES</span><h2>Health modules</h2></div></div><div class="category-empty">No health modules have been added yet.</div></div>`;
}

async function loadSafetyPulse(targetId) {
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

function roleLabel(role) { return role === 'admin' ? 'Administrator' : role === 'executive' ? 'Executive' : 'User'; }

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
    throw new Error(data.error || `Request failed (${response.status}).`);
  }
  return data;
}

async function showLogin(message = '') {
  cmmsStop();
  closeMobileMore();
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
  cmmsStart();
  csrfToken = session.csrf_token;
  loginScreen.hidden = true;
  appShell.classList.add('app-shell');
  appShell.hidden = false;
  loginForm.reset();
  headerUser.textContent = currentUser.display_name;
  render();
}

function notify(message) {
  toastBox.textContent = message;
  toastBox.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toastBox.hidden = true; }, 4000);
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalBody.innerHTML = '';
}

function openUserModal(kind, user = null) {
  let title = '';
  let fields = '';
  if (kind === 'create') {
    title = 'Add a user';
    fields = `<label for="userName">Username</label><input id="userName" name="username" autocomplete="off" minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]+" required /><label for="displayName">Display name</label><input id="displayName" name="display_name" maxlength="80" required /><label for="userRole">Role</label><select id="userRole" name="role"><option value="user">User — own patrols</option><option value="executive">Executive — all patrols</option><option value="admin">Administrator — all access</option></select><label for="userPassword">Initial password</label><input id="userPassword" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required /><p class="field-hint">Use at least 12 characters.</p>`;
  } else if (kind === 'edit') {
    title = `Edit ${user.display_name}`;
    fields = `<label for="displayName">Display name</label><input id="displayName" name="display_name" maxlength="80" value="${escapeHtml(user.display_name)}" required /><label for="userRole">Role</label><select id="userRole" name="role"><option value="user" ${user.role === 'user' ? 'selected' : ''}>User — own patrols</option><option value="executive" ${user.role === 'executive' ? 'selected' : ''}>Executive — all patrols</option><option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator — all access</option></select><label for="userStatus">Status</label><select id="userStatus" name="active"><option value="true" ${user.active ? 'selected' : ''}>Active</option><option value="false" ${!user.active ? 'selected' : ''}>Inactive</option></select>${user.id === currentUser.id ? '<p class="field-hint">You cannot remove your own admin access.</p>' : ''}`;
  } else {
    title = `Reset password`;
    fields = `<p class="modal-description">Set a new password for ${escapeHtml(user.display_name)}. All current sessions for this user will end.</p><label for="userPassword">New password</label><input id="userPassword" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required />`;
  }
  modalBody.innerHTML = `<span class="eyebrow dark-eyebrow">USER MANAGEMENT</span><h2 id="modalTitle">${escapeHtml(title)}</h2><form id="userModalForm" class="stacked-form">${fields}<div class="form-error" id="modalError" role="alert" hidden></div><div class="modal-actions"><button class="secondary-button" type="button" id="cancelModal">Cancel</button><button class="primary-button" type="submit">${kind === 'create' ? 'Create user' : kind === 'edit' ? 'Save changes' : 'Reset password'}</button></div></form>`;
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
  const key = location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard';
  return routes[key] ? key : 'dashboard';
}

function closeMenu() {
  sidebar.classList.remove('mobile-open');
  backdrop.classList.remove('visible');
  menuButton.setAttribute('aria-expanded', 'false');
}

function render() {
  if (!currentUser) return;
  const key = currentRoute();
  if (key === 'users' && currentUser.role !== 'admin') { location.hash = '#/dashboard'; return; }
  closeMobileMore();
  renderNav(key);
  renderMobileNavigation(key);
  breadcrumb.textContent = routes[key].title;
  document.title = `${routes[key].title} · SHE Digital`;
  if (key === 'users') renderUsers();
  else if (key === 'work-orders') renderWorkOrders();
  else if (key === 'patrol-overview') renderPatrolOverview();
  else if (key === 'daily-safety-patrol') {
    const id = location.hash.split('/')[2];
    if (id && /^\d+$/.test(id)) renderPatrolDetail(id);
    else renderPatrolForm();
  }
  else content.innerHTML = key === 'dashboard' ? renderDashboard() : key === 'safety' ? renderSafetyHome() : key === 'health' ? renderHealth() : key === 'environmental' ? renderEnvironmental() : key === 'account' ? renderAccount() : renderPlaceholder(key);
  if (key === 'dashboard') loadSafetyPulse('dashboardSafetyPulse');
  if (key === 'safety') loadSafetyPulse('safetyHomePulse');
  if (key === 'account') {
    addPasswordToggles(content);
    content.querySelector('.narrow-page').insertAdjacentHTML('beforeend', installHelpCard());
  }
  window.scrollTo(0, 0);
  closeMenu();
}

menuButton.addEventListener('click', () => {
  const open = !sidebar.classList.contains('mobile-open');
  sidebar.classList.toggle('mobile-open', open);
  backdrop.classList.toggle('visible', open);
  menuButton.setAttribute('aria-expanded', String(open));
});
backdrop.addEventListener('click', closeMenu);
mobileTabbar.addEventListener('click', event => {
  if (event.target.closest('[data-mobile-more]')) toggleMobileMore();
  else if (event.target.closest('a')) closeMobileMore();
});
mobileMoreBackdrop.addEventListener('click', () => closeMobileMore(true));
mobileMoreSheet.addEventListener('click', event => {
  if (event.target.closest('[data-mobile-more-close]')) closeMobileMore(true);
  else if (event.target.closest('a')) closeMobileMore();
});
window.addEventListener('resize', () => { if (window.innerWidth > 760) closeMobileMore(); });
document.addEventListener('keydown', event => {
  if (mobileMoreSheet.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeMobileMore(true); }
  if (event.key !== 'Tab') return;
  const focusable = [...mobileMoreSheet.querySelectorAll('a,button')];
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener('hashchange', render);
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
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

async function bootstrap() {
  try { showApp(await api('/api/session')); }
  catch { await showLogin(); }
}
bootstrap();
addPasswordToggles(loginForm);
initPatrolEvents();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
