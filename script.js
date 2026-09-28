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
  health: { title: 'Health', icon: 'heart' },
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

function routeLink(key, className = '') {
  const item = routes[key];
  return `<a class="${className}" href="#/${key}"><span class="link-icon">${icon(item.icon)}</span><span>${item.title}</span>${icon('chevron', 16)}</a>`;
}

function renderNav(active) {
  nav.innerHTML = `<div class="nav-label">OVERVIEW</div>${routeLink('dashboard', `nav-link ${active === 'dashboard' ? 'active' : ''}`)}
    <div class="nav-label nav-label-spaced">SHE SECTIONS</div>
    ${routeLink('safety', `nav-link ${active === 'safety' ? 'active' : ''}`)}
    ${routeLink('health', `nav-link ${active === 'health' ? 'active' : ''}`)}
    ${routeLink('environmental', `nav-link ${active === 'environmental' ? 'active' : ''}`)}
    <div class="subnav">${envItems.map(key => `<a class="subnav-link ${active === key ? 'active' : ''}" href="#/${key}"><span class="subnav-dot"></span>${routes[key].title}</a>`).join('')}</div>`;
}

function sectionCard(key, number, description) {
  return `<a class="section-card" href="#/${key}"><div class="section-card-top"><span class="section-icon ${key}">${icon(routes[key].icon, 25)}</span><span class="section-index">0${number} / 03</span></div><div><h3>${routes[key].title}</h3><p>${description}</p></div><span class="section-card-bottom"><span>${key === 'environmental' ? 'Explore section' : 'View placeholder'}</span>${icon('arrow', 18)}</span></a>`;
}

function moduleCard(key, index) {
  return `<a class="module-card" href="#/${key}"><span class="module-icon">${icon(routes[key].icon, 23)}</span><span class="module-copy"><small>MODULE 0${index}</small><strong>${routes[key].title}</strong><span>${featureDescriptions[key]}</span></span><span class="module-arrow">${icon('arrow', 18)}</span></a>`;
}

function renderDashboard() {
  return `<div class="page dashboard-page"><section class="hero"><div class="hero-text"><div class="eyebrow hero-eyebrow"><span class="eyebrow-line"></span>SUGIHARA · SHE WORKSPACE</div><h1>Good day.<br /><em>Let's make every day safer.</em></h1><p>A single home for Safety, Health and Environmental work. Your SHE journey starts here.</p><a class="hero-action" href="#/environmental">Explore Environmental ${icon('arrow', 19)}</a></div><div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="hero-leaf">${icon('leaf', 104)}</div><span class="art-caption">SAFETY&nbsp; · &nbsp;HEALTH&nbsp; · &nbsp;ENVIRONMENT</span></div></section>
    <div class="intro-row"><div><span class="eyebrow dark-eyebrow">THE WORKSPACE</span><h2>Three pillars. One direction.</h2><p>Choose an area to see its planned home in Safety Digital.</p></div><span class="phase-pill"><span></span> Initial setup</span></div>
    <div class="section-grid">${sectionCard('safety', 1, 'A dedicated space for safety initiatives and reporting.')}${sectionCard('health', 2, 'A dedicated space for health and wellbeing.')}${sectionCard('environmental', 3, 'The first area planned for environmental reporting and action.')}</div>
    <section class="dashboard-strip"><span class="strip-icon">${icon('leaf', 24)}</span><div><strong>Environmental comes first</strong><p>Explore the planned Red Tag, Hiyari Hatto, Waste and Environmental Findings areas.</p></div><a href="#/environmental">View modules ${icon('arrow', 17)}</a></section></div>`;
}

function renderEnvironmental() {
  return `<div class="page inner-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / ENVIRONMENTAL</span><h1>Environmental</h1><p>A central place for environmental awareness, reporting and follow-up.</p></div><section class="environment-banner"><div><span class="banner-kicker">OUR FIRST FOCUS AREA</span><h2>See it. Report it.<br />Improve it.</h2><p>Employees will be able to raise environmental concerns directly to the SHE team as this workspace develops.</p></div><span class="banner-icon" aria-hidden="true">${icon('leaf', 88)}</span></section><div class="content-heading"><div><span class="eyebrow dark-eyebrow">PLANNED AREAS</span><h2>Environmental modules</h2></div><span class="count-pill">04 spaces</span></div><div class="module-grid">${envItems.map((key, index) => moduleCard(key, index + 1)).join('')}</div><div class="quiet-note">These pages are placeholders. Reporting forms, workflows and live data will be added in a later phase.</div></div>`;
}

function renderPlaceholder(key) {
  const isEnv = envItems.includes(key);
  const parent = isEnv ? 'Environmental' : 'SHE section';
  const detail = isEnv ? featureDescriptions[key] : `The ${routes[key].title} area is reserved for future SHE workflows.`;
  return `<div class="page inner-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">${parent.toUpperCase()} / PLANNED SPACE</span><h1>${routes[key].title}</h1><p>${detail}</p></div><div class="placeholder-panel"><div class="placeholder-graphic"><span class="placeholder-ring"></span><span class="placeholder-symbol">${icon(routes[key].icon, 72)}</span></div><span class="placeholder-kicker">COMING IN A FUTURE PHASE</span><h2>A space ready to grow.</h2><p>This section is set up in the navigation. Its forms, records and workflows will be designed when the requirements are ready.</p><span class="placeholder-status"><span></span> Placeholder page</span></div>${key === 'findings' ? `<section class="findings-preview"><div><span class="eyebrow dark-eyebrow">REFERENCE TOPICS</span><h2>Environmental concerns</h2><p>Topics taken from the supplied environmental reporting poster.</p></div><div class="topic-grid">${findings.map(([label, symbol]) => `<div class="topic-chip">${icon(symbol, 18)}<span>${label}</span></div>`).join('')}</div></section>` : ''}<a class="back-link" href="#/${isEnv ? 'environmental' : 'dashboard'}">${icon('arrow', 17)} Back to ${isEnv ? 'Environmental' : 'Dashboard'}</a></div>`;
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
  const key = currentRoute();
  renderNav(key);
  breadcrumb.textContent = routes[key].title;
  document.title = `${routes[key].title} · Safety Digital`;
  content.innerHTML = key === 'dashboard' ? renderDashboard() : key === 'environmental' ? renderEnvironmental() : renderPlaceholder(key);
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
window.addEventListener('hashchange', render);
render();
