/* SHE work orders, backed by the CMMS through Safety Digital's authenticated API. */
const cmmsState = {config: null, plant: 'port-klang', orders: [], master: null, timer: null, known: null};
let cmmsInstallEvent = null;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); cmmsInstallEvent = event; });
const cmmsStatus = {open:'Open', acknowledged:'Acknowledged', in_progress:'In progress', pending_material:'Pending material', resolved:'Ready to verify', closed:'Closed', returned:'Returned', cancelled:'Cancelled'};
const cmmsDate = value => value ? new Date(value).toLocaleString() : '—';
const cmmsQuery = () => `?plant=${encodeURIComponent(cmmsState.plant)}`;
const cmmsPath = () => location.hash.replace(/^#\/?/, '').split('/');

function cmmsShell(title, action = '') {
  return `<div class="page inner-page cmms-page"><div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SHE / CMMS</span><h1>${title}</h1><p>Issue, follow up, and verify SHE work orders.</p></div><div class="cmms-actions">${action}</div></div><div id="cmmsBody" class="loading-panel">Loading work orders…</div></div>`;
}

async function cmmsEnsureConfig() {
  const config = await api('/api/cmms/config');
  cmmsState.config = config;
  if (config.plants?.length && !config.plants.includes(cmmsState.plant)) cmmsState.plant = config.plants[0];
  return config;
}

function cmmsError(error) {
  const body = document.getElementById('cmmsBody');
  if (body) body.innerHTML = `<div class="cmms-empty" role="alert">${escapeHtml(error.message)} <button class="secondary-button" id="cmmsRetry">Try again</button></div>`;
  document.getElementById('cmmsRetry')?.addEventListener('click', renderWorkOrders);
}

function cmmsPlantControl() {
  const plants = cmmsState.config?.plants || [];
  if (plants.length < 2) return `<span class="count-pill">${plants[0] === 'sendayan' ? 'Sendayan' : 'Port Klang'}</span>`;
  return `<label class="cmms-plant">Plant <select id="cmmsPlant"><option value="port-klang" ${cmmsState.plant === 'port-klang' ? 'selected' : ''}>Port Klang</option><option value="sendayan" ${cmmsState.plant === 'sendayan' ? 'selected' : ''}>Sendayan</option></select></label>`;
}

async function renderWorkOrders() {
  const segments = cmmsPath();
  const action = `${cmmsPlantControl()} <button class="secondary-button cmms-install-button" type="button">Install app</button> <button class="secondary-button cmms-push-button" type="button">Enable alerts</button> <a class="primary-button" href="#/work-orders/new">Issue work order</a>`;
  content.innerHTML = cmmsShell(segments[1] === 'new' ? 'Issue SHE work order' : segments[1] ? 'Work order detail' : 'SHE Work Orders', action);
  try {
    const config = await cmmsEnsureConfig();
    if (!config.configured) {
      document.querySelector('.cmms-actions').innerHTML = '';
      document.getElementById('cmmsBody').innerHTML = '<div class="cmms-empty">CMMS connection is not configured yet. An administrator needs to set the connection details on the Safety Digital server.</div>';
      return;
    }
    document.querySelector('.cmms-actions').innerHTML = `${cmmsPlantControl()} <button class="secondary-button cmms-install-button" type="button">Install app</button> <button class="secondary-button cmms-push-button" type="button">Enable alerts</button> <a class="primary-button" href="#/work-orders/new">Issue work order</a>`;
    document.getElementById('cmmsPlant')?.addEventListener('change', event => { cmmsState.plant = event.target.value; cmmsState.known = null; renderWorkOrders(); });
    document.querySelector('.cmms-install-button')?.addEventListener('click', cmmsInstall);
    document.querySelector('.cmms-push-button')?.addEventListener('click', cmmsEnablePush);
    if (segments[1] === 'new') await cmmsRenderCreate();
    else if (segments[1]) await cmmsRenderDetail(segments[1]);
    else await cmmsRenderList();
  } catch (error) { cmmsError(error); }
}

function cmmsOrderCard(order) {
  return `<a class="cmms-order" href="#/work-orders/${encodeURIComponent(order.id)}"><div class="cmms-order-top"><strong>${escapeHtml(order.number)}</strong><span class="cmms-status cmms-status-${escapeHtml(order.status)}">${escapeHtml(cmmsStatus[order.status] || order.status)}</span></div><h3>${escapeHtml(order.title)}</h3><p>${escapeHtml(order.issueDescription || order.description)}</p><div class="cmms-order-meta"><span>${escapeHtml(order.machineName || 'Equipment')}</span><span>${escapeHtml(order.priority)} priority</span><span>${escapeHtml(cmmsDate(order.createdAt))}</span></div></a>`;
}

async function cmmsRenderList() {
  const orders = await api(`/api/cmms/work-orders${cmmsQuery()}`);
  cmmsState.orders = orders;
  const body = document.getElementById('cmmsBody');
  if (!body || cmmsPath()[1]) return;
  const counts = {active: orders.filter(o => !['closed','cancelled'].includes(o.status)).length, verify: orders.filter(o => o.status === 'resolved').length};
  body.className = '';
  body.innerHTML = `<div class="cmms-metrics"><div><strong>${counts.active}</strong><span>Active</span></div><div><strong>${counts.verify}</strong><span>Ready to verify</span></div><div><strong>${orders.length}</strong><span>All SHE orders</span></div></div><div class="cmms-toolbar"><input id="cmmsSearch" type="search" placeholder="Search number, equipment, or issue" aria-label="Search work orders"><select id="cmmsFilter" aria-label="Filter status"><option value="active">Active orders</option><option value="verify">Ready to verify</option><option value="all">All orders</option></select></div><div id="cmmsList" class="cmms-list"></div>`;
  const update = () => {
    const q = document.getElementById('cmmsSearch').value.toLowerCase();
    const filter = document.getElementById('cmmsFilter').value;
    const rows = orders.filter(o => (filter === 'all' || (filter === 'verify' ? o.status === 'resolved' : !['closed','cancelled'].includes(o.status))) && `${o.number} ${o.title} ${o.issueDescription} ${o.machineName}`.toLowerCase().includes(q));
    document.getElementById('cmmsList').innerHTML = rows.length ? rows.map(cmmsOrderCard).join('') : '<div class="cmms-empty">No matching SHE work orders.</div>';
  };
  document.getElementById('cmmsSearch').addEventListener('input', update);
  document.getElementById('cmmsFilter').addEventListener('change', update);
  update();
}

function cmmsOptions(rows, label) {
  return `<option value="">${label}</option>${rows.filter(row => row.active).map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join('')}`;
}

async function cmmsRenderCreate() {
  const master = await api(`/api/cmms/master-data${cmmsQuery()}`);
  cmmsState.master = master;
  const body = document.getElementById('cmmsBody');
  if (!body || cmmsPath()[1] !== 'new') return;
  body.className = 'cmms-form-card';
  body.innerHTML = `<form id="cmmsCreate" class="cmms-form"><label>Work type<select name="type"><option value="maintenance">Maintenance</option><option value="office">Office</option><option value="project">Project</option><option value="kaizen">Kaizen</option></select></label><label>Priority<select name="priority"><option value="medium">Medium</option><option value="low">Low</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Section<select name="sectionId" id="cmmsSection">${cmmsOptions(master.sections, 'Choose a section or describe below')}</select></label><label>Section or location<input name="location" maxlength="100" placeholder="e.g. SHE office"></label><label>Area<input name="area" maxlength="100" placeholder="e.g. West corridor" required></label><label>Machine or equipment<select name="machineId" id="cmmsMachine">${cmmsOptions(master.machines, 'Choose equipment or describe below')}</select></label><label>Equipment name<input name="machineName" maxlength="100" placeholder="e.g. Exhaust fan" required></label><label>Issue category<select name="issueCategoryId" id="cmmsCategory">${cmmsOptions(master.issueCategories, 'Choose a category or describe below')}</select></label><label>Category name<input name="issueCategoryName" maxlength="100" placeholder="e.g. Air Leak" required></label><label class="cmms-full">Describe the work needed<textarea name="issueDescription" rows="5" minlength="5" maxlength="5000" required></textarea></label><label class="cmms-full">Issue photo (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="cmmsFormError" class="form-error cmms-full" hidden></div><div class="cmms-full cmms-form-actions"><button class="primary-button" type="submit">Issue work order</button></div></form>`;
  const form = document.getElementById('cmmsCreate');
  const sections = master.sections; const machines = master.machines; const categories = master.issueCategories;
  form.sectionId.addEventListener('change', () => {
    const section = sections.find(row => row.id === form.sectionId.value);
    if (section) form.location.value = section.name;
    form.machineId.innerHTML = cmmsOptions(machines.filter(row => !section || row.sectionId === section.id), 'Choose equipment or describe below');
  });
  form.machineId.addEventListener('change', () => {
    const machine = machines.find(row => row.id === form.machineId.value);
    if (machine) { form.machineName.value = machine.name; form.area.value = machine.area; }
  });
  form.issueCategoryId.addEventListener('change', () => { const category = categories.find(row => row.id === form.issueCategoryId.value); if (category) form.issueCategoryName.value = category.name; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'); const error = document.getElementById('cmmsFormError');
    button.disabled = true; error.hidden = true;
    try {
      const payload = Object.fromEntries(new FormData(form)); delete payload.photo;
      payload.plant = cmmsState.plant;
      const order = await api('/api/cmms/work-orders', 'POST', payload);
      const photo = form.photo.files[0];
      if (photo) {
        try { await cmmsUploadPhoto(order.id, photo, 'issue'); }
        catch (uploadError) { notify(`Work order ${order.number} was issued, but the photo failed: ${uploadError.message}`); location.hash = `#/work-orders/${order.id}`; return; }
      }
      notify(`Work order ${order.number} issued.`);
      location.hash = `#/work-orders/${order.id}`;
    } catch (failure) { error.textContent = failure.message; error.hidden = false; }
    finally { button.disabled = false; }
  });
}

function cmmsPhotoUrl(attachment) {
  const match = String(attachment.url || '').match(/^\/uploads\/work-orders\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9._-]+)$/);
  return match ? `/api/cmms/media/${match[1]}/${match[2]}${cmmsQuery()}` : '';
}

async function cmmsRenderDetail(id) {
  const detail = await api(`/api/cmms/work-orders/${encodeURIComponent(id)}${cmmsQuery()}`);
  const body = document.getElementById('cmmsBody');
  if (!body || cmmsPath()[1] !== id) return;
  body.className = 'cmms-detail';
  const photos = (detail.attachments || []).filter(a => cmmsPhotoUrl(a));
  body.innerHTML = `<a href="#/work-orders" class="cmms-back">← All SHE work orders</a><div class="cmms-detail-card"><div class="cmms-order-top"><strong>${escapeHtml(detail.number)}</strong><span class="cmms-status cmms-status-${escapeHtml(detail.status)}">${escapeHtml(cmmsStatus[detail.status] || detail.status)}</span></div><h2>${escapeHtml(detail.title)}</h2><p>${escapeHtml(detail.issueDescription || detail.description)}</p><div class="cmms-facts"><span><b>Plant</b>${detail.plantId === 'sendayan' ? 'Sendayan' : 'Port Klang'}</span><span><b>Priority</b>${escapeHtml(detail.priority)}</span><span><b>Equipment</b>${escapeHtml(detail.machineName)}</span><span><b>Area</b>${escapeHtml(detail.area)}</span><span><b>Issued by</b>${escapeHtml(detail.reportedByName)}</span><span><b>Assigned to</b>${escapeHtml(detail.assignedTo?.name || 'Not assigned')}</span><span><b>Created</b>${escapeHtml(cmmsDate(detail.createdAt))}</span><span><b>Updated</b>${escapeHtml(cmmsDate(detail.updatedAt))}</span></div></div><div class="cmms-detail-grid"><section class="cmms-detail-card"><h3>Work and evidence</h3><p><b>Maintenance summary:</b> ${escapeHtml(detail.completionNote || 'Awaiting completion')}</p><div class="cmms-photos">${photos.map(a => `<a href="${cmmsPhotoUrl(a)}" target="_blank" rel="noopener"><img src="${cmmsPhotoUrl(a)}" alt="${escapeHtml(a.kind)} photo"><span>${escapeHtml(a.kind.replace('_',' '))}</span></a>`).join('') || '<p>No photos attached yet.</p>'}</div><form id="cmmsPhotoForm" class="cmms-inline-form"><label>Add an issue or return photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="secondary-button" type="submit">Upload photo</button></form></section><section class="cmms-detail-card"><h3>Activity</h3><div class="cmms-activity">${(detail.activities || []).map(a => `<div><strong>${escapeHtml(a.action.replace('_',' '))}</strong><small>${escapeHtml(cmmsDate(a.createdAt))}</small><p>${escapeHtml(a.message)}</p></div>`).join('') || '<p>No updates yet.</p>'}</div><form id="cmmsCommentForm" class="cmms-inline-form"><label>Add a follow-up note<textarea name="message" rows="3" maxlength="2000" required></textarea></label><button class="secondary-button" type="submit">Add note</button></form></section></div>${detail.status === 'resolved' ? `<section class="cmms-detail-card cmms-verify"><h3>Verify completed work</h3><p>Review the maintenance summary and photos. Close the job if complete, or return it with a reason.</p><textarea id="cmmsVerifyNote" rows="3" placeholder="Verification note or reason for return"></textarea><div class="cmms-actions"><button class="primary-button" data-verify="closed">Verify and close</button><button class="secondary-button" data-verify="returned">Return for more work</button></div></section>` : ''}<p id="cmmsDetailError" class="form-error" role="alert" hidden></p>`;
  body.querySelector('.cmms-back').insertAdjacentHTML('afterend', '<button class="secondary-button cmms-refresh" type="button">Refresh</button>');
  body.querySelector('.cmms-refresh').addEventListener('click', () => cmmsRenderDetail(id).catch(cmmsError));
  document.getElementById('cmmsCommentForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget;
    await cmmsAction(async () => api(`/api/cmms/work-orders/${id}/comments`, 'POST', {plant: cmmsState.plant, message: form.message.value}), id);
  });
  document.getElementById('cmmsPhotoForm').addEventListener('submit', async event => {
    event.preventDefault(); const photo = event.currentTarget.photo.files[0];
    await cmmsAction(() => cmmsUploadPhoto(id, photo, detail.status === 'returned' ? 'return_evidence' : 'issue'), id);
  });
  body.querySelectorAll('[data-verify]').forEach(button => button.addEventListener('click', async () => {
    const status = button.dataset.verify; const note = document.getElementById('cmmsVerifyNote').value.trim();
    await cmmsAction(() => api(`/api/cmms/work-orders/${id}/verification`, 'PATCH', {plant: cmmsState.plant, status, note}), id);
  }));
}

async function cmmsAction(action, id) {
  const error = document.getElementById('cmmsDetailError');
  try { await action(); notify('CMMS work order updated.'); await cmmsRenderDetail(id); }
  catch (failure) { if (error) { error.textContent = failure.message; error.hidden = false; } }
}

async function cmmsUploadPhoto(id, file, kind) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5_000_000) throw new Error('Use a JPEG, PNG, or WebP photo smaller than 5 MB.');
  const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Cannot read photo.')); reader.readAsDataURL(file); });
  return api(`/api/cmms/work-orders/${id}/attachments`, 'POST', {plant: cmmsState.plant, kind, filename: file.name, mimeType: file.type, content});
}

async function cmmsEnablePush() {
  try {
    if (!window.isSecureContext || !('PushManager' in window) || !('serviceWorker' in navigator)) throw new Error('Push alerts require HTTPS and a supported browser.');
    if (!cmmsState.config?.push?.enabled) throw new Error('CMMS push alerts are not configured yet.');
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches) throw new Error('On iPhone, add Safety Digital to the Home Screen first.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');
    const key = cmmsState.config.push.publicKey;
    const raw = atob((key + '='.repeat((4 - key.length % 4) % 4)).replace(/-/g,'+').replace(/_/g,'/'));
    const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (subscription?.options.applicationServerKey) {
      const saved = new Uint8Array(subscription.options.applicationServerKey);
      if (saved.length !== bytes.length || saved.some((value, index) => value !== bytes[index])) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    subscription ||= await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: bytes});
    await api('/api/cmms/push/subscriptions', 'POST', {plant: cmmsState.plant, subscription: subscription.toJSON()});
    notify('Push alerts enabled on this device.');
  } catch (error) { notify(error.message); }
}

async function cmmsInstall() {
  if (cmmsInstallEvent) {
    await cmmsInstallEvent.prompt();
    cmmsInstallEvent = null;
  } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    notify('In Safari, tap Share, then Add to Home Screen.');
  } else {
    notify('Use your browser menu to install Safety Digital.');
  }
}

async function cmmsPoll() {
  if (!currentUser || !cmmsState.config?.configured) return;
  try {
    const orders = await api(`/api/cmms/work-orders${cmmsQuery()}`);
    const ids = new Set(orders.map(order => order.id));
    if (cmmsState.known) {
      const added = orders.filter(order => !cmmsState.known.has(order.id));
      if (added.length) notify(`${added.length} new SHE work order${added.length === 1 ? '' : 's'} issued.`);
    }
    cmmsState.known = ids;
    if (cmmsPath()[0] === 'work-orders' && !cmmsPath()[1]) cmmsRenderList().catch(() => {});
  } catch { /* The page shows connection errors when opened. */ }
}

function cmmsStart() {
  if (cmmsState.timer) return;
  cmmsEnsureConfig().then(() => { cmmsPoll(); }).catch(() => {});
  cmmsState.timer = setInterval(cmmsPoll, 30000);
}

function cmmsStop() { clearInterval(cmmsState.timer); cmmsState.timer = null; cmmsState.known = null; }
