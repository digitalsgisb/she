const patrolSections = [
  ['general', 'General Safety', [
    'Housekeeping is maintained (clean and tidy work areas)',
    'Emergency exits are clear and accessible',
    'Fire extinguishers are in place and accessible',
    'First aid kits are available and stocked',
    'Proper signage (warning, PPE, emergency) is visible',
  ]],
  ['machinery', 'Machinery and Equipment', [
    'Equipment/machinery is in good condition',
    'Safety guards are in place and functional',
    'Lock-out/tag-out procedures followed',
    'All safety devices on the machine are checked and covered in the daily machine checklist',
  ]],
  ['ppe', 'PPE (Personal Protective Equipment)', [
    'Workers wearing appropriate PPE',
    'PPE in good condition (no damage/defects)',
  ]],
  ['hazards', 'Hazards / Observations', [
    'Are all moving parts of machinery properly guarded and secured?',
    'Are heavy objects stored and handled safely to prevent injury or collapse?',
    'Is there a clear separation between vehicle and pedestrian pathways?',
    'Are all elevated work areas protected with guardrails or fall protection?',
    'Are all electrical cables and connections in good condition and insulated?',
    'Spills/leaks are properly managed',
    'Trip/fall hazards (wires, objects, uneven surfaces)',
    'Chemicals properly labeled and stored',
    'Are sharp tools or edges properly stored, covered, or marked to prevent injury?',
  ]],
  ['others', 'Others', [
    'Area cleaned and no potential breeding sources identified?',
    'Schedule waste properly segregated according to types?',
    'Forklift in good condition?',
  ]],
];

const patrolIntro = 'This checklist is used to conduct routine safety inspections across the workplace to identify and correct unsafe conditions, behaviors, or hazards. The objective is to maintain a safe working environment, ensure compliance with safety standards, and prevent incidents or injuries. The patrol should be carried out by authorized personnel, and any findings must be reported to the relevant department for prompt corrective action.';
const patrolView = {mode: 'month', anchor: new Date(), rows: [], search: '', findingsOnly: false};

function patrolRange() {
  const date = patrolView.anchor;
  let start;
  let end;
  if (patrolView.mode === 'week') {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  }
  return {start, end};
}

function patrolPeriodLabel(start, end) {
  if (patrolView.mode === 'month') return new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric'}).format(start);
  const last = new Date(end.getTime() - 86_400_000);
  const fmt = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'});
  return `${fmt.format(start)} – ${fmt.format(last)}, ${last.getFullYear()}`;
}

function patrolHistoryMarkup() {
  const search = patrolView.search.trim().toLowerCase();
  const rows = patrolView.rows.filter(row => (!patrolView.findingsOnly || row.counts.not_ok > 0) &&
    (!search || [row.inspector_name, row.submitted_by, String(row.id)].some(value => value.toLowerCase().includes(search))));
  return `<div class="patrol-history-count">${rows.length} ${rows.length === 1 ? 'patrol' : 'patrols'} shown</div>${rows.length ? `<div class="patrol-list">${rows.map(row => `<a href="#/daily-safety-patrol/${row.id}" class="patrol-list-row"><span><strong>#${row.id} · ${escapeHtml(row.inspector_name)}</strong><small>${new Date(row.created_at * 1000).toLocaleString()} · Submitted by ${escapeHtml(row.submitted_by)}</small></span><span class="patrol-list-meta">${row.counts.not_ok ? `<b class="patrol-finding-pill">${row.counts.not_ok} NOT OK</b>` : '<b class="patrol-clear-pill">All clear</b>'}<span aria-label="${row.rating} of 3 stars">${'★'.repeat(row.rating)}${'☆'.repeat(3 - row.rating)}</span>${icon('chevron', 16)}</span></a>`).join('')}</div>` : '<p class="patrol-empty">No patrols match this view.</p>'}`;
}

function patrolTrendMarkup(rows, start, end) {
  const buckets = [];
  if (patrolView.mode === 'week') {
    for (let index = 0; index < 7; index++) {
      const day = new Date(start);
      day.setDate(day.getDate() + index);
      buckets.push({label: new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(day), count: 0, findings: 0, day: day.toDateString()});
    }
    rows.forEach(row => {
      const bucket = buckets.find(item => item.day === new Date(row.created_at * 1000).toDateString());
      if (bucket) { bucket.count++; bucket.findings += row.counts.not_ok; }
    });
  } else {
    const days = new Date(end.getTime() - 86_400_000).getDate();
    for (let first = 1; first <= days; first += 7) buckets.push({label: `${first}–${Math.min(first + 6, days)}`, count: 0, findings: 0});
    rows.forEach(row => {
      const date = new Date(row.created_at * 1000);
      const bucket = buckets[Math.floor((date.getDate() - 1) / 7)];
      if (bucket) { bucket.count++; bucket.findings += row.counts.not_ok; }
    });
  }
  const max = Math.max(1, ...buckets.map(bucket => bucket.count));
  return `<div class="patrol-trend">${buckets.map(bucket => `<div class="patrol-trend-row"><span>${bucket.label}</span><progress class="patrol-trend-track" max="${max}" value="${bucket.count}" aria-label="${bucket.count} patrols"></progress><strong>${bucket.count}</strong><small>${bucket.findings ? `${bucket.findings} NOT OK` : ''}</small></div>`).join('')}</div><p class="patrol-chart-note">Bars show completed patrols; counts at right show NOT OK checklist answers.</p>`;
}

function renderSafetyPage() {
  const {start, end} = patrolRange();
  const rows = patrolView.rows;
  const patrolCount = rows.length;
  const ok = rows.reduce((sum, row) => sum + row.counts.ok, 0);
  const notOk = rows.reduce((sum, row) => sum + row.counts.not_ok, 0);
  const na = rows.reduce((sum, row) => sum + row.counts.na, 0);
  const withFindings = rows.filter(row => row.counts.not_ok > 0).length;
  const compliance = ok + notOk ? Math.round(ok / (ok + notOk) * 100) : null;
  const groups = patrolSections.map(([key, title]) => ({title, count: rows.reduce((sum, row) => sum + row.not_ok_by_section[key], 0)}));
  const maxGroup = Math.max(1, ...groups.map(group => group.count));
  const currentStart = patrolView.mode === 'week' ? (() => { const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate() - (day.getDay() + 6) % 7); return day; })() : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  content.innerHTML = `<div class="page inner-page patrol-page"><div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SHE / SAFETY</span><h1>Safety patrol overview</h1><p>${currentUser.role === 'user' ? 'Review your inspection activity, findings, and past Daily Safety Patrol Checklists.' : 'Review inspection activity across the team, monitor findings, and open past Daily Safety Patrol Checklists.'}</p></div><a class="primary-button" href="#/daily-safety-patrol">+ New patrol</a></div>
    <div class="patrol-period-bar"><div class="patrol-period-modes" role="group" aria-label="View by period"><button type="button" data-patrol-mode="week" class="${patrolView.mode === 'week' ? 'active' : ''}" aria-pressed="${patrolView.mode === 'week'}">Week</button><button type="button" data-patrol-mode="month" class="${patrolView.mode === 'month' ? 'active' : ''}" aria-pressed="${patrolView.mode === 'month'}">Month</button></div><div class="patrol-period-nav"><button type="button" data-patrol-shift="-1" aria-label="Previous ${patrolView.mode}">‹</button><strong>${escapeHtml(patrolPeriodLabel(start, end))}</strong><button type="button" data-patrol-shift="1" aria-label="Next ${patrolView.mode}" ${start >= currentStart ? 'disabled' : ''}>›</button></div></div>
    <div class="patrol-metrics"><div><small>PATROLS COMPLETED</small><strong>${patrolCount}</strong><span>in this ${patrolView.mode}</span></div><div><small>WITH FINDINGS</small><strong>${withFindings}</strong><span>patrols with NOT OK answers</span></div><div><small>NOT OK ITEMS</small><strong>${notOk}</strong><span>across all checklist sections</span></div><div><small>OK RATE</small><strong>${compliance === null ? '—' : `${compliance}%`}</strong><span>${ok} OK · ${na} N/A excluded</span></div></div>
    <div class="patrol-overview-grid"><section class="patrol-card"><h2>Patrol activity</h2>${patrolTrendMarkup(rows, start, end)}</section><section class="patrol-card"><h2>Findings by section</h2><div class="patrol-section-bars">${groups.map(group => `<div><span>${escapeHtml(group.title)}</span><progress class="patrol-trend-track" max="${maxGroup}" value="${group.count}" aria-label="${group.count} NOT OK answers"></progress><strong>${group.count}</strong></div>`).join('')}</div><p class="patrol-chart-note">Based on NOT OK answers. Review the patrol record for remarks and attachments.</p></section></div>
    <section class="patrol-card patrol-history"><div class="patrol-history-heading"><div><span class="eyebrow dark-eyebrow">HISTORY</span><h2>${currentUser.role === 'user' ? 'My past patrols' : 'Past patrols'}</h2></div><div class="patrol-history-filters"><input id="patrolSearch" type="search" value="${escapeHtml(patrolView.search)}" placeholder="Search inspector or ID" aria-label="Search patrol history" /><label><input id="patrolFindingsOnly" type="checkbox" ${patrolView.findingsOnly ? 'checked' : ''} /> With findings only</label></div></div><div id="patrolHistoryResults">${patrolHistoryMarkup()}</div></section></div>`;
}

function patrolGrid(group, title, items, answers = null) {
  return `<fieldset class="patrol-section"><legend>${escapeHtml(title)} <span class="required">*</span></legend><div class="patrol-grid"><div class="patrol-grid-header"><span>Inspection item</span><span>OK</span><span>NOT OK</span><span>N/A</span></div>${items.map((label, index) => {
    const key = `${group}_${index}`;
    return `<div class="patrol-grid-row"><div class="patrol-item">${String.fromCharCode(97 + index)}) ${escapeHtml(label)}</div>${['ok', 'not_ok', 'na'].map(status => answers ? `<span class="patrol-result ${answers[key] === status ? 'selected' : ''}">${answers[key] === status ? '●' : '—'}</span>` : `<label class="patrol-choice"><input type="radio" name="${key}" value="${status}" aria-label="${escapeHtml(label)}: ${status === 'not_ok' ? 'NOT OK' : status.toUpperCase()}" required /><span></span></label>`).join('')}</div>`;
  }).join('')}</div></fieldset>`;
}

function patrolHeading(extra = '') {
  return `<div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SHE / SAFETY</span><h1>Daily Safety Patrol Checklist</h1><p>${patrolIntro}</p></div>${extra}</div>`;
}

function patrolDraftKey() { return `she-patrol-draft-${currentUser.id}`; }

function savePatrolDraft() {
  const form = document.getElementById('patrolForm');
  if (!form) return;
  const data = new FormData(form);
  const draft = {inspector: data.get('inspector'), other_name: data.get('other_name'), rating: data.get('rating'), remarks: data.get('remarks'), answers: {}};
  patrolSections.forEach(([group, , items]) => items.forEach((_, index) => {
    const key = `${group}_${index}`;
    draft.answers[key] = data.get(key);
  }));
  localStorage.setItem(patrolDraftKey(), JSON.stringify(draft));
  const note = document.getElementById('patrolDraftNote');
  if (note) note.textContent = 'Draft saved on this device. Attachments must be selected again.';
}

function restorePatrolDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(patrolDraftKey()) || 'null'); } catch { return; }
  if (!draft) return;
  const form = document.getElementById('patrolForm');
  if (['Sara', 'Aman', 'Other'].includes(draft.inspector)) {
    const choice = form.querySelector(`input[name="inspector"][value="${draft.inspector}"]`);
    choice.checked = true;
    const other = document.getElementById('patrolOtherName');
    other.disabled = draft.inspector !== 'Other';
    other.required = !other.disabled;
    other.value = draft.other_name || '';
  }
  Object.entries(draft.answers || {}).forEach(([key, value]) => {
    if (!/^(general|machinery|ppe|hazards|others)_\d+$/.test(key) || !['ok', 'not_ok', 'na'].includes(value)) return;
    const input = form.querySelector(`input[name="${key}"][value="${value}"]`);
    if (input) input.checked = true;
  });
  const rating = form.querySelector(`input[name="rating"][value="${draft.rating}"]`);
  if (rating) rating.checked = true;
  form.elements.remarks.value = draft.remarks || '';
  document.getElementById('patrolDraftNote').textContent = 'Draft restored from this device. Attachments must be selected again.';
}

function renderPatrolForm() {
  content.innerHTML = `<div class="page inner-page patrol-page">${patrolHeading('<a class="secondary-button" href="#/safety">Past patrols</a>')}<form id="patrolForm" class="patrol-card">
    <fieldset class="patrol-section patrol-inspector"><legend>Inspector's Name <span class="required">*</span></legend><div class="patrol-inspector-options"><label><input type="radio" name="inspector" value="Sara" required /> Sara</label><label><input type="radio" name="inspector" value="Aman" /> Aman</label><label><input type="radio" name="inspector" value="Other" /> Other</label><input id="patrolOtherName" name="other_name" type="text" maxlength="80" placeholder="Enter inspector name" disabled /></div></fieldset>
    ${patrolSections.map(([group, title, items]) => patrolGrid(group, title, items)).join('')}
    <fieldset class="patrol-section"><legend>Overall Rating <span class="required">*</span></legend><div class="patrol-stars" role="radiogroup" aria-label="Overall rating">${[1, 2, 3].map(value => `<label><input type="radio" name="rating" value="${value}" required /><span aria-hidden="true">☆</span><span class="sr-only">${value} ${value === 1 ? 'star' : 'stars'}</span></label>`).join('')}</div></fieldset>
    <div class="patrol-field"><label for="patrolRemarks">Remarks</label><textarea id="patrolRemarks" name="remarks" rows="4" maxlength="5000" placeholder="Add findings or follow-up notes"></textarea></div>
    <div class="patrol-field"><label for="patrolFiles">Attachments</label><input id="patrolFiles" name="files" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*,video/*,audio/*" /><small>Up to 10 files, 1 GB each. Word, Excel, PowerPoint, PDF, image, video, or audio.</small></div>
    <p class="patrol-draft-note" id="patrolDraftNote">Your answers are saved on this device as you fill the form. Submission needs an internet connection.</p><div class="form-error" id="patrolError" role="alert" hidden></div><div class="patrol-actions"><a class="secondary-button" href="#/safety">Cancel</a><button class="primary-button" type="submit">Submit patrol</button></div>
  </form></div>`;
  restorePatrolDraft();
}

async function renderSafety() {
  content.innerHTML = `<div class="page inner-page patrol-page"><div class="loading-panel">Loading patrol overview…</div></div>`;
  try {
    const {start, end} = patrolRange();
    const mode = patrolView.mode;
    const {patrols} = await api(`/api/patrols?start=${Math.floor(start.getTime() / 1000)}&end=${Math.floor(end.getTime() / 1000)}`);
    if (currentRoute() !== 'safety' || mode !== patrolView.mode || start.getTime() !== patrolRange().start.getTime()) return;
    patrolView.rows = patrols;
    renderSafetyPage();
  } catch (error) {
    content.innerHTML = `<div class="page inner-page"><div class="form-error">${escapeHtml(error.message)}</div></div>`;
  }
}

async function renderPatrolDetail(id) {
  content.innerHTML = `<div class="page inner-page patrol-page"><div class="loading-panel">Loading patrol…</div></div>`;
  try {
    const {patrol} = await api(`/api/patrols/${id}`);
    if (currentRoute() !== 'daily-safety-patrol' || location.hash.split('/')[2] !== String(id)) return;
    content.innerHTML = `<div class="page inner-page patrol-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / SAFETY / PATROL #${patrol.id}</span><h1>Daily Safety Patrol Checklist</h1><p>Submitted ${new Date(patrol.created_at * 1000).toLocaleString()} by ${escapeHtml(patrol.submitted_by)}</p></div><div class="patrol-card"><div class="patrol-summary"><div><small>INSPECTOR</small><strong>${escapeHtml(patrol.inspector_name)}</strong></div><div><small>OVERALL RATING</small><strong>${'★'.repeat(patrol.rating)}${'☆'.repeat(3 - patrol.rating)}</strong></div></div>${patrolSections.map(([group, title, items]) => patrolGrid(group, title, items, patrol.answers)).join('')}<div class="patrol-field"><strong>Remarks</strong><p>${escapeHtml(patrol.remarks || 'No remarks')}</p></div><div class="patrol-field"><strong>Attachments</strong><div class="patrol-attachments">${patrol.attachments.length ? patrol.attachments.map(file => `<a href="/api/patrols/${id}/attachments/${file.id}">${escapeHtml(file.filename)} <small>(${(file.size / 1024 / 1024).toFixed(1)} MB)</small></a>`).join('') : '<span>No attachments</span>'}</div><label for="patrolMoreFiles" class="secondary-button">Add attachments</label><input id="patrolMoreFiles" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*,video/*,audio/*" /><div class="form-error" id="patrolUploadError" role="alert" hidden></div></div><a class="back-link" href="#/safety">${icon('arrow', 17)} Back to Safety</a></div></div>`;
  } catch (error) {
    content.innerHTML = `<div class="page inner-page"><div class="form-error">${escapeHtml(error.message)}</div><a class="back-link" href="#/safety">Back to Safety</a></div>`;
  }
}

async function uploadPatrolFiles(id, files) {
  validatePatrolFiles(files);
  for (const file of files) {
    const response = await fetch(`/api/patrols/${id}/attachments`, {method: 'POST', credentials: 'same-origin', headers: {'X-CSRF-Token': csrfToken, 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream'}, body: file});
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(`${file.name}: ${data.error || `Upload failed (${response.status}).`}`);
    }
  }
}

function validatePatrolFiles(files) {
  const allowed = /\.(docx?|xlsx?|pptx?|pdf|jpe?g|png|gif|webp|heic|mp4|mov|webm|mp3|wav|m4a)$/i;
  if (files.length > 10) throw new Error('Choose up to 10 attachments.');
  for (const file of files) {
    if (!allowed.test(file.name) || file.size < 1 || file.size > 1_000_000_000) throw new Error(`Invalid attachment: ${file.name}`);
  }
}

function initPatrolEvents() {
  content.addEventListener('input', event => { if (event.target.closest('#patrolForm')) savePatrolDraft(); });
  content.addEventListener('click', event => {
    const mode = event.target.closest('[data-patrol-mode]');
    if (mode) {
      patrolView.mode = mode.dataset.patrolMode;
      patrolView.anchor = new Date();
      patrolView.search = '';
      patrolView.findingsOnly = false;
      renderSafety();
    }
    const shift = event.target.closest('[data-patrol-shift]');
    if (shift) {
      const amount = Number(shift.dataset.patrolShift);
      const anchor = patrolView.anchor;
      patrolView.anchor = patrolView.mode === 'week'
        ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + amount * 7)
        : new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1);
      renderSafety();
    }
  });
  content.addEventListener('input', event => {
    if (event.target.id !== 'patrolSearch') return;
    patrolView.search = event.target.value;
    document.getElementById('patrolHistoryResults').innerHTML = patrolHistoryMarkup();
  });
  content.addEventListener('change', async event => {
    if (event.target.closest('#patrolForm')) savePatrolDraft();
    if (event.target.id === 'patrolFindingsOnly') {
      patrolView.findingsOnly = event.target.checked;
      document.getElementById('patrolHistoryResults').innerHTML = patrolHistoryMarkup();
    }
    if (event.target.name === 'inspector') {
      const other = document.getElementById('patrolOtherName');
      other.disabled = event.target.value !== 'Other';
      other.required = !other.disabled;
      if (other.disabled) other.value = '';
      else other.focus();
    }
    if (event.target.id === 'patrolMoreFiles') {
      const id = location.hash.split('/')[2];
      const errorBox = document.getElementById('patrolUploadError');
      errorBox.hidden = true;
      try {
        const {patrol} = await api(`/api/patrols/${id}`);
        if (patrol.attachments.length + event.target.files.length > 10) throw new Error('A patrol can have up to 10 attachments.');
        await uploadPatrolFiles(id, [...event.target.files]);
        notify('Attachments added.');
        renderPatrolDetail(id);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
    }
  });
  content.addEventListener('submit', async event => {
    if (event.target.id !== 'patrolForm') return;
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const files = [...form.elements.files.files];
    const output = document.getElementById('patrolError');
    output.hidden = true;
    const answers = Object.fromEntries(patrolSections.flatMap(([group, , items]) => items.map((_, index) => [`${group}_${index}`, data.get(`${group}_${index}`)])));
    if (Object.values(answers).some(value => !value)) {
      output.textContent = 'Answer every inspection item.';
      output.hidden = false;
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      validatePatrolFiles(files);
      const {id} = await api('/api/patrols', 'POST', {inspector_name: data.get('inspector') === 'Other' ? data.get('other_name') : data.get('inspector'), answers, rating: Number(data.get('rating')), remarks: data.get('remarks')});
      try {
        await uploadPatrolFiles(id, files);
        notify('Patrol submitted.');
      } catch (error) {
        notify(`Patrol saved, but attachment upload failed: ${error.message}`);
      }
      location.hash = `#/daily-safety-patrol/${id}`;
      localStorage.removeItem(patrolDraftKey());
    } catch (error) {
      output.textContent = error.message;
      output.hidden = false;
    } finally { button.disabled = false; }
  });
}
