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
const patrolView = {mode: 'day', anchor: new Date(), rows: [], search: '', findingsOnly: false};
let patrolTemplates = [];
let activePatrolTemplate = null;
let builderTemplate = null;

function patrolPhotoMarkup(id, files, label = '') {
  if (!files.length) return '<p class="patrol-empty">No photos or attachments.</p>';
  return `<div class="patrol-photo-gallery">${files.map(file => {
    const url = `/api/patrols/${id}/attachments/${file.id}`;
    const preview = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mime_type);
    return `<a class="patrol-photo" href="${url}" target="_blank" rel="noopener">${preview ? `<img src="${url}" alt="${escapeHtml(label || file.filename)}" loading="lazy" />` : '<span class="patrol-file-icon">Open file</span>'}<span>${escapeHtml(file.filename)}</span></a>`;
  }).join('')}</div>`;
}

function customPatrolQuestions(template, answers = null, attachments = [], patrolId = null) {
  return template.questions.map(q => `<div class="patrol-field"><label for="${q.id}">${escapeHtml(q.label)} ${q.required ? '<span class="required">*</span>' : ''}</label>${answers ? q.type === 'photo' ? patrolPhotoMarkup(patrolId, attachments.filter(f => f.question_id === q.id), q.label) || 'No photos' : `<p class="patrol-answer">${escapeHtml(q.type === 'status' ? ({ok: 'OK', not_ok: 'NOT OK', na: 'N/A'}[answers[q.id]] || 'No answer') : answers[q.id] || 'No answer')}</p>` : q.type === 'photo' ? `<input id="${q.id}" type="file" data-photo-question="${q.id}" multiple accept=".jpg,.jpeg,.png,.gif,.webp,.heic" ${q.required ? 'required' : ''} /><small>Upload photos or take a picture on your phone.</small>` : q.type === 'text' ? `<textarea id="${q.id}" name="${q.id}" rows="3" maxlength="5000" ${q.required ? 'required' : ''}></textarea>` : `<select id="${q.id}" name="${q.id}" ${q.required ? 'required' : ''}><option value="">Choose an answer</option>${(q.type === 'status' ? [['ok', 'OK'], ['not_ok', 'NOT OK'], ['na', 'N/A']] : q.options.map(o => [o, o])).map(([v,l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`).join('')}</select>`}</div>`).join('');
}

async function renderChecklistBuilder() {
  content.innerHTML = '<div class="loading-panel">Loading checklist builder…</div>';
  try {
    const {templates} = await api('/api/patrol-templates');
    if (currentRoute() !== 'checklist-builder') return;
    patrolTemplates = templates;
    const id = Number(location.hash.split('/')[2]);
    const found = templates.find(t => t.id === id);
    builderTemplate = found ? structuredClone(found) : {title: '', description: '', questions: []};
    if (found && found.user_id !== currentUser.id && currentUser.role === 'user') throw new Error('You can edit your own checklists.');
    content.innerHTML = `<div class="page inner-page patrol-page"><a class="category-back" href="#/daily-safety-patrol">${icon('arrow', 16)} Back to patrol</a><div class="page-heading"><span class="eyebrow dark-eyebrow">CHECKLIST BUILDER</span><h1>${found ? 'Edit checklist' : 'Create a checklist'}</h1><p>Add inspection checks, written answers, multiple choice questions, and photo uploads. Saved checklists are available to the team.</p></div><form id="checklistBuilder" class="patrol-card"><div class="patrol-field"><label for="checklistTitle">Checklist title</label><input id="checklistTitle" maxlength="120" required value="${escapeHtml(builderTemplate.title)}" /></div><div class="patrol-field"><label for="checklistDescription">Description</label><textarea id="checklistDescription" rows="2" maxlength="2000">${escapeHtml(builderTemplate.description)}</textarea></div><div class="patrol-field"><label for="builderItemJump">Choose an item to edit</label><select id="builderItemJump"><option value="">Choose an item</option></select><small>Select an item to jump straight to its wording, answer type, and required setting.</small></div><div id="builderQuestions"></div><button type="button" class="secondary-button" data-add-question>+ Add question</button><div class="form-error" id="builderError" hidden role="alert"></div><div class="patrol-actions"><a class="secondary-button" href="#/daily-safety-patrol">Cancel</a><button class="primary-button" type="submit">Save checklist</button></div></form></div>`;
    renderBuilderQuestions();
  } catch (error) { content.innerHTML = `<div class="page inner-page"><p class="form-error">${escapeHtml(error.message)}</p></div>`; }
}

function renderBuilderQuestions() {
  document.getElementById('builderItemJump').innerHTML = '<option value="">Choose an item</option>' + builderTemplate.questions.map((q,i) => `<option value="${i}">${i+1}. ${escapeHtml(q.label || 'New question')}</option>`).join('');
  document.getElementById('builderQuestions').innerHTML = builderTemplate.questions.map((q, i) => `<section class="builder-question" data-question-index="${i}"><div class="builder-question-heading"><strong>Question ${i + 1}</strong><div><button type="button" data-move-question="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move question up">↑</button><button type="button" data-move-question="1" ${i === builderTemplate.questions.length - 1 ? 'disabled' : ''} aria-label="Move question down">↓</button><button type="button" data-remove-question aria-label="Remove question">Remove</button></div></div><div class="patrol-field"><label for="builderLabel${i}">Question</label><input id="builderLabel${i}" data-builder-field="label" value="${escapeHtml(q.label)}" maxlength="500" required /></div><div class="builder-question-settings"><label>Answer type<select data-builder-field="type">${[['status', 'OK / NOT OK / N/A'], ['text', 'Written answer'], ['choice', 'Multiple choice'], ['photo', 'Photo upload']].map(([type,label]) => `<option value="${type}" ${q.type === type ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label><input type="checkbox" data-builder-field="required" ${q.required ? 'checked' : ''} /> Required</label></div>${q.type === 'choice' ? `<div class="patrol-field"><label for="builderOptions${i}">Options (one per line)</label><textarea id="builderOptions${i}" data-builder-field="options" rows="3" required>${escapeHtml(q.options.join('\n'))}</textarea></div>` : ''}</section>`).join('');
}

function patrolLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function patrolDailyReportMarkup(rows) {
  const filtered = rows.filter(row => (!patrolView.findingsOnly || row.counts.not_ok > 0) && (!patrolView.search.trim() || [row.inspector_name, row.submitted_by, String(row.id), row.title].some(v => v.toLowerCase().includes(patrolView.search.trim().toLowerCase()))));
  const days = new Map();
  filtered.forEach(row => { const day = patrolLocalDate(new Date(row.created_at * 1000)); if (!days.has(day)) days.set(day, []); days.get(day).push(row); });
  return `<section class="patrol-card" id="patrolDailyReports"><h2>Daily reports &amp; findings photos</h2><p class="patrol-chart-note">Open any photo to see it full size. Photos include the patrol's uploaded evidence.</p>${days.size ? [...days].map(([day, records]) => `<div class="patrol-report-day"><h3>${escapeHtml(new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'}))}</h3><p>${records.length} ${records.length === 1 ? 'patrol' : 'patrols'} · ${records.reduce((sum,r) => sum + r.counts.not_ok, 0)} NOT OK items</p>${records.map(row => `<article class="patrol-report-record"><div><a href="#/daily-safety-patrol/${row.id}"><strong>#${row.id} · ${escapeHtml(row.title)}</strong></a><span>${escapeHtml(row.inspector_name)} · ${new Date(row.created_at * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${row.counts.not_ok} NOT OK</span></div>${row.remarks ? `<p class="patrol-answer">${escapeHtml(row.remarks)}</p>` : ''}${patrolPhotoMarkup(row.id, row.attachments)}</article>`).join('')}</div>`).join('') : '<p class="patrol-empty">No patrols for this period.</p>'}</section>`;
}

let patrolRefreshBusy = false;
async function refreshPatrolLive() {
  if (!currentUser || document.hidden || patrolRefreshBusy || !navigator.onLine) return;
  const route = currentRoute();
  if (!['patrol-overview', 'daily-safety-patrol', 'dashboard', 'safety'].includes(route)) return;
  patrolRefreshBusy = true;
  try {
    if (route === 'patrol-overview') {
      const {start, end} = patrolRange();
      const {patrols} = await api(`/api/patrols?start=${Math.floor(start.getTime()/1000)}&end=${Math.floor(end.getTime()/1000)}`);
      if (currentRoute() !== route || start.getTime() !== patrolRange().start.getTime()) return;
      if (JSON.stringify(patrols) !== JSON.stringify(patrolView.rows)) {
        const focused = document.activeElement;
        const focusId = focused?.id;
        const selection = focused?.selectionStart;
        const scrollY = window.scrollY;
        patrolView.rows = patrols; renderPatrolOverviewPage();
        if (focusId) { const next = document.getElementById(focusId); next?.focus({preventScroll:true}); if (next?.type === 'search' && selection !== null) next.setSelectionRange(selection, selection); }
        window.scrollTo(0, scrollY);
      }
      const status = document.getElementById('patrolSyncStatus');
      if (status) status.textContent = `Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}`;
    } else if (route === 'daily-safety-patrol') {
      const id = location.hash.split('/')[2];
      if (/^\d+$/.test(id || '')) {
        const {patrol} = await api(`/api/patrols/${id}`);
        if (currentRoute() === route && location.hash.split('/')[2] === id && patrol.completed && content.dataset.patrolSnapshot !== JSON.stringify(patrol) && !document.getElementById('patrolMoreFiles')?.files.length) {
          const scrollY = window.scrollY;
          await renderPatrolDetail(id);
          window.scrollTo(0, scrollY);
        }
      } else {
        const {templates} = await api('/api/patrol-templates');
        if (currentRoute() !== route) return;
        if (JSON.stringify(templates) !== JSON.stringify(patrolTemplates)) {
          patrolTemplates = templates;
          const select = document.getElementById('patrolTemplateSelect');
          if (select) select.innerHTML = `${templates.map(t => `<option value="${t.id}" ${t.id === activePatrolTemplate?.id ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}`;
        }
      }
    } else await loadSafetyPulse(route === 'dashboard' ? 'dashboardSafetyPulse' : 'safetyHomePulse');
  } catch {
    const status = document.getElementById('patrolSyncStatus');
    if (status) status.textContent = 'Reconnecting…';
  } finally { patrolRefreshBusy = false; }
}

function patrolRange() {
  const date = patrolView.anchor;
  let start;
  let end;
  if (patrolView.mode === 'day') {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    end = new Date(start); end.setDate(end.getDate() + 1);
  } else if (patrolView.mode === 'week') {
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
  if (patrolView.mode === 'day') return new Intl.DateTimeFormat(undefined, {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'}).format(start);
  if (patrolView.mode === 'month') return new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric'}).format(start);
  const last = new Date(end.getTime() - 86_400_000);
  const fmt = new Intl.DateTimeFormat(undefined, {month: 'short', day: 'numeric'});
  return `${fmt.format(start)} – ${fmt.format(last)}, ${last.getFullYear()}`;
}

function patrolHistoryMarkup() {
  const search = patrolView.search.trim().toLowerCase();
  const rows = patrolView.rows.filter(row => (!patrolView.findingsOnly || row.counts.not_ok > 0) &&
    (!search || [row.inspector_name, row.submitted_by, row.title, String(row.id)].some(value => value.toLowerCase().includes(search))));
  return `<div class="patrol-history-count">${rows.length} ${rows.length === 1 ? 'patrol' : 'patrols'} shown</div>${rows.length ? `<div class="patrol-list">${rows.map(row => `<a href="#/daily-safety-patrol/${row.id}" class="patrol-list-row"><span><strong>#${row.id} · ${escapeHtml(row.inspector_name)}</strong><small>${escapeHtml(row.title)}</small><small>${new Date(row.created_at * 1000).toLocaleString()} · Submitted by ${escapeHtml(row.submitted_by)}</small></span><span class="patrol-list-meta">${row.counts.not_ok ? `<b class="patrol-finding-pill">${row.counts.not_ok} NOT OK</b>` : '<b class="patrol-clear-pill">All clear</b>'}<span aria-label="${row.rating} of 3 stars">${'★'.repeat(row.rating)}${'☆'.repeat(3 - row.rating)}</span>${icon('chevron', 16)}</span></a>`).join('')}</div>` : '<p class="patrol-empty">No patrols match this view.</p>'}`;
}

function patrolTrendMarkup(rows, start, end) {
  const buckets = [];
  if (patrolView.mode === 'day') {
    buckets.push({label: start.toLocaleDateString(undefined, {day:'numeric', month:'short'}), count: rows.length, findings: rows.reduce((sum,row) => sum + row.counts.not_ok, 0)});
  } else if (patrolView.mode === 'week') {
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

function renderPatrolOverviewPage() {
  const {start, end} = patrolRange();
  const rows = patrolView.rows;
  const patrolCount = rows.length;
  const ok = rows.reduce((sum, row) => sum + row.counts.ok, 0);
  const notOk = rows.reduce((sum, row) => sum + row.counts.not_ok, 0);
  const na = rows.reduce((sum, row) => sum + row.counts.na, 0);
  const withFindings = rows.filter(row => row.counts.not_ok > 0).length;
  const compliance = ok + notOk ? Math.round(ok / (ok + notOk) * 100) : null;
  const groups = patrolSections.map(([key, title]) => ({title, count: rows.reduce((sum, row) => sum + row.not_ok_by_section[key], 0)}));
  const customFindings = notOk - groups.reduce((sum, group) => sum + group.count, 0);
  if (customFindings) groups.push({title: 'Custom checklists', count: customFindings});
  const maxGroup = Math.max(1, ...groups.map(group => group.count));
  const currentStart = patrolView.mode === 'day' ? new Date(new Date().setHours(0,0,0,0)) : patrolView.mode === 'week' ? (() => { const day = new Date(); day.setHours(0,0,0,0); day.setDate(day.getDate() - (day.getDay() + 6) % 7); return day; })() : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  content.innerHTML = `<div class="page inner-page patrol-page"><a class="category-back" href="#/safety">${icon('arrow', 16)} Safety overview</a><div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SHE / SAFETY / MONITORING</span><h1>Patrol Overview &amp; History</h1><p>${currentUser.role === 'user' ? 'Review your inspection activity, findings, and past Daily Safety Patrol Checklists.' : 'Review inspection activity across the team, monitor findings, and open past Daily Safety Patrol Checklists.'}</p></div><a class="primary-button" href="#/daily-safety-patrol">+ New patrol</a></div>
    <div class="patrol-period-bar"><div class="patrol-period-modes" role="group" aria-label="View by period"><button type="button" data-patrol-mode="day" class="${patrolView.mode === 'day' ? 'active' : ''}" aria-pressed="${patrolView.mode === 'day'}">Day</button><button type="button" data-patrol-mode="week" class="${patrolView.mode === 'week' ? 'active' : ''}" aria-pressed="${patrolView.mode === 'week'}">Week</button><button type="button" data-patrol-mode="month" class="${patrolView.mode === 'month' ? 'active' : ''}" aria-pressed="${patrolView.mode === 'month'}">Month</button></div><input id="patrolDate" type="date" aria-label="Report date" value="${patrolLocalDate(patrolView.anchor)}" /><span id="patrolSyncStatus" role="status">Updates every 5 seconds</span><div class="patrol-period-nav"><button type="button" data-patrol-shift="-1" aria-label="Previous ${patrolView.mode}">‹</button><strong>${escapeHtml(patrolPeriodLabel(start, end))}</strong><button type="button" data-patrol-shift="1" aria-label="Next ${patrolView.mode}" ${start >= currentStart ? 'disabled' : ''}>›</button></div></div>
    <div class="patrol-metrics"><div><small>PATROLS COMPLETED</small><strong>${patrolCount}</strong><span>in the selected ${patrolView.mode}</span></div><div><small>WITH FINDINGS</small><strong>${withFindings}</strong><span>patrols with NOT OK answers</span></div><div><small>NOT OK ITEMS</small><strong>${notOk}</strong><span>across all checklist sections</span></div><div><small>OK RATE</small><strong>${compliance === null ? '—' : `${compliance}%`}</strong><span>${ok} OK · ${na} N/A excluded</span></div></div>
    ${patrolDailyReportMarkup(rows)}<div class="patrol-overview-grid"><section class="patrol-card"><h2>Patrol activity</h2>${patrolTrendMarkup(rows, start, end)}</section><section class="patrol-card"><h2>Findings by section</h2><div class="patrol-section-bars">${groups.map(group => `<div><span>${escapeHtml(group.title)}</span><progress class="patrol-trend-track" max="${maxGroup}" value="${group.count}" aria-label="${group.count} NOT OK answers"></progress><strong>${group.count}</strong></div>`).join('')}</div><p class="patrol-chart-note">Based on NOT OK answers. Review the patrol record for remarks and attachments.</p></section></div>
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

function patrolDraftKey() { return `she-patrol-draft-${currentUser.id}-${activePatrolTemplate?.id || 'default'}-${activePatrolTemplate?.revision || 1}`; }

function savePatrolDraft() {
  const form = document.getElementById('patrolForm');
  if (!form) return;
  const data = new FormData(form);
  const draft = {inspector: data.get('inspector'), other_name: data.get('other_name'), rating: data.get('rating'), remarks: data.get('remarks'), answers: {}};
  patrolSections.forEach(([group, , items]) => items.forEach((_, index) => {
    const key = `${group}_${index}`;
    draft.answers[key] = data.get(key);
  }));
  if (activePatrolTemplate) activePatrolTemplate.questions.filter(q => q.type !== 'photo').forEach(q => { draft.answers[q.id] = data.get(q.id); });
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
    if (activePatrolTemplate?.questions.some(q => q.id === key && q.type !== 'photo')) { form.elements.namedItem(key).value = value || ''; return; }
    if (!/^(general|machinery|ppe|hazards|others)_\d+$/.test(key) || !['ok', 'not_ok', 'na'].includes(value)) return;
    const input = form.querySelector(`input[name="${key}"][value="${value}"]`);
    if (input) input.checked = true;
  });
  const rating = form.querySelector(`input[name="rating"][value="${draft.rating}"]`);
  if (rating) rating.checked = true;
  form.elements.remarks.value = draft.remarks || '';
  document.getElementById('patrolDraftNote').textContent = 'Draft restored from this device. Attachments must be selected again.';
}

async function renderPatrolForm() {
  content.innerHTML = '<div class="loading-panel">Loading checklists…</div>';
  try { patrolTemplates = (await api('/api/patrol-templates')).templates; }
  catch (error) { content.innerHTML = '<div class="form-error">' + escapeHtml(error.message) + '</div>'; return; }
  if (currentRoute() !== 'daily-safety-patrol' || /^\d+$/.test(location.hash.split('/')[2] || '')) return;
  activePatrolTemplate = patrolTemplates.find(t => String(t.id) === location.hash.split('/')[2]?.replace('template-', '')) || patrolTemplates.find(t => t.is_default) || null;
  content.innerHTML = `<div class="page inner-page patrol-page">${activePatrolTemplate ? `<div class="page-heading"><h1>${escapeHtml(activePatrolTemplate.title)}</h1><p>${escapeHtml(activePatrolTemplate.description)}</p></div>` : patrolHeading('<a class="secondary-button" href="#/patrol-overview">Patrol history</a>')}<div class="patrol-checklist-bar"><label>Checklist<select id="patrolTemplateSelect">${patrolTemplates.map(t => `<option value="${t.id}" ${activePatrolTemplate?.id === t.id ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}</select></label><a class="secondary-button" href="#/checklist-builder">+ Create checklist</a>${activePatrolTemplate && (activePatrolTemplate.user_id === currentUser.id || currentUser.role !== 'user') ? `<a class="secondary-button" href="#/checklist-builder/${activePatrolTemplate.id}">Edit checklist</a>` : ''}</div><form id="patrolForm" class="patrol-card">
    <fieldset class="patrol-section patrol-inspector"><legend>Inspector's Name <span class="required">*</span></legend><div class="patrol-inspector-options"><label><input type="radio" name="inspector" value="Sara" required /> Sara</label><label><input type="radio" name="inspector" value="Aman" /> Aman</label><label><input type="radio" name="inspector" value="Other" /> Other</label><input id="patrolOtherName" name="other_name" type="text" maxlength="80" placeholder="Enter inspector name" disabled /></div></fieldset>
    ${activePatrolTemplate ? customPatrolQuestions(activePatrolTemplate) : patrolSections.map(([group, title, items]) => patrolGrid(group, title, items)).join('')}
    <fieldset class="patrol-section"><legend>Overall Rating <span class="required">*</span></legend><div class="patrol-stars" role="radiogroup" aria-label="Overall rating">${[1, 2, 3].map(value => `<label><input type="radio" name="rating" value="${value}" required /><span aria-hidden="true">☆</span><span class="sr-only">${value} ${value === 1 ? 'star' : 'stars'}</span></label>`).join('')}</div></fieldset>
    <div class="patrol-field"><label for="patrolRemarks">Remarks</label><textarea id="patrolRemarks" name="remarks" rows="4" maxlength="5000" placeholder="Add findings or follow-up notes"></textarea></div>
    <div class="patrol-field"><label for="patrolFiles">Attachments</label><input id="patrolFiles" name="files" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*,video/*,audio/*" /><small>Up to 10 files, 1 GB each. Word, Excel, PowerPoint, PDF, image, video, or audio.</small></div>
    <p class="patrol-draft-note" id="patrolDraftNote">Your answers are saved on this device as you fill the form. Submission needs an internet connection.</p><div class="form-error" id="patrolError" role="alert" hidden></div><div class="patrol-actions"><a class="secondary-button" href="#/safety">Cancel</a><button class="primary-button" type="submit">Submit patrol</button></div>
  </form></div>`;
  restorePatrolDraft();
}

async function renderPatrolOverview() {
  content.innerHTML = `<div class="page inner-page patrol-page"><div class="loading-panel">Loading patrol overview…</div></div>`;
  try {
    const {start, end} = patrolRange();
    const mode = patrolView.mode;
    const {patrols} = await api(`/api/patrols?start=${Math.floor(start.getTime() / 1000)}&end=${Math.floor(end.getTime() / 1000)}`);
    if (currentRoute() !== 'patrol-overview' || mode !== patrolView.mode || start.getTime() !== patrolRange().start.getTime()) return;
    patrolView.rows = patrols;
    renderPatrolOverviewPage();
  } catch (error) {
    if (currentRoute() !== 'patrol-overview') return;
    content.innerHTML = `<div class="page inner-page"><div class="form-error">${escapeHtml(error.message)}</div></div>`;
  }
}

async function renderPatrolDetail(id) {
  content.innerHTML = `<div class="page inner-page patrol-page"><div class="loading-panel">Loading patrol…</div></div>`;
  try {
    const {patrol} = await api(`/api/patrols/${id}`);
    if (currentRoute() !== 'daily-safety-patrol' || location.hash.split('/')[2] !== String(id)) return;
    content.dataset.patrolSnapshot = JSON.stringify(patrol);
    content.innerHTML = `<div class="page inner-page patrol-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / SAFETY / PATROL #${patrol.id}</span><h1>${escapeHtml(patrol.template?.title || 'Daily Safety Patrol Checklist')}</h1><p>${patrol.completed ? 'Submitted' : 'Saved pending photos'} ${new Date(patrol.created_at * 1000).toLocaleString()} by ${escapeHtml(patrol.submitted_by)}</p></div><div class="patrol-card"><div class="patrol-summary"><div><small>INSPECTOR</small><strong>${escapeHtml(patrol.inspector_name)}</strong></div><div><small>OVERALL RATING</small><strong>${'★'.repeat(patrol.rating)}${'☆'.repeat(3 - patrol.rating)}</strong></div></div>${!patrol.completed ? '<p class="form-error">This patrol is awaiting required photo uploads. Add them below, then finish submission.</p>' : ''}${patrol.template ? customPatrolQuestions(patrol.template, patrol.answers, patrol.attachments, id) : patrolSections.map(([group, title, items]) => patrolGrid(group, title, items, patrol.answers)).join('')}<div class="patrol-field"><strong>Remarks</strong><p>${escapeHtml(patrol.remarks || 'No remarks')}</p></div><div class="patrol-field"><strong>Attachments</strong><div class="patrol-attachments">${patrolPhotoMarkup(id, patrol.attachments)}</div>${!patrol.completed ? `<label>Photo question<select id="patrolUploadQuestion"><option value="">General attachment</option>${patrol.template.questions.filter(q => q.type === 'photo').map(q => `<option value="${q.id}">${escapeHtml(q.label)}</option>`).join('')}</select></label><button type="button" class="primary-button" data-complete-patrol="${id}">Finish submission</button>` : ''}<label for="patrolMoreFiles" class="secondary-button">Add attachments</label><input id="patrolMoreFiles" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*,video/*,audio/*" /><div class="form-error" id="patrolUploadError" role="alert" hidden></div></div><a class="back-link" href="#/patrol-overview">${icon('arrow', 17)} Back to Patrol Overview</a></div></div>`;
  } catch (error) {
    if (currentRoute() !== 'daily-safety-patrol' || location.hash.split('/')[2] !== String(id)) return;
    content.innerHTML = `<div class="page inner-page"><div class="form-error">${escapeHtml(error.message)}</div><a class="back-link" href="#/patrol-overview">Back to Patrol Overview</a></div>`;
  }
}

async function uploadPatrolFiles(id, files, questionId = '') {
  validatePatrolFiles(files);
  for (const file of files) {
    const response = await fetch(`/api/patrols/${id}/attachments`, {method: 'POST', credentials: 'same-origin', headers: {'X-CSRF-Token': csrfToken, 'X-Question-Id': questionId, 'X-File-Name': encodeURIComponent(file.name), 'Content-Type': 'application/octet-stream'}, body: file});
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
  setInterval(refreshPatrolLive, 5000);
  document.addEventListener('visibilitychange', refreshPatrolLive);
  window.addEventListener('online', refreshPatrolLive);
  content.addEventListener('input', event => {
    const field = event.target.dataset.builderField;
    if (!field) return;
    const q = builderTemplate.questions[Number(event.target.closest('[data-question-index]').dataset.questionIndex)];
    q[field] = field === 'required' ? event.target.checked : field === 'options' ? event.target.value.split('\n').map(v => v.trim()).filter(Boolean) : event.target.value;
    if (field === 'type') renderBuilderQuestions();
  });
  content.addEventListener('click', async event => {
    if (event.target.closest('[data-add-question]')) {
      if (builderTemplate.questions.length >= 100) { notify('Use up to 100 questions.'); return; }
      builderTemplate.questions.push({id: `q_${crypto.randomUUID().replaceAll('-', '')}`, label: '', type: 'status', required: true, options: []});
      renderBuilderQuestions();
      document.querySelector('#builderQuestions section:last-child input')?.focus();
    }
    const remove = event.target.closest('[data-remove-question]');
    const move = event.target.closest('[data-move-question]');
    if (remove || move) {
      const i = Number((remove || move).closest('[data-question-index]').dataset.questionIndex);
      if (remove) builderTemplate.questions.splice(i, 1);
      else { const j = i + Number(move.dataset.moveQuestion); [builderTemplate.questions[i], builderTemplate.questions[j]] = [builderTemplate.questions[j], builderTemplate.questions[i]]; }
      renderBuilderQuestions();
    }
    const complete = event.target.closest('[data-complete-patrol]');
    if (complete) {
      complete.disabled = true;
      try { await api(`/api/patrols/${complete.dataset.completePatrol}/complete`, 'POST', {}); notify('Patrol submitted.'); await renderPatrolDetail(complete.dataset.completePatrol); }
      catch (error) { notify(error.message); complete.disabled = false; }
    }
  });
  content.addEventListener('submit', async event => {
    if (event.target.id !== 'checklistBuilder') return;
    event.preventDefault();
    const button = event.target.querySelector('[type="submit"]');
    const output = document.getElementById('builderError');
    button.disabled = true; output.hidden = true;
    try {
      const definition = {...builderTemplate, title: document.getElementById('checklistTitle').value, description: document.getElementById('checklistDescription').value};
      const {id} = await api(`/api/patrol-templates${definition.id !== undefined ? `/${definition.id}` : ''}`, definition.id !== undefined ? 'PATCH' : 'POST', definition);
      notify('Checklist saved for the team.'); location.hash = `#/daily-safety-patrol/template-${id}`;
    } catch (error) { output.textContent = error.message; output.hidden = false; }
    finally { button.disabled = false; }
  });
  content.addEventListener('input', event => { if (event.target.closest('#patrolForm')) savePatrolDraft(); });
  content.addEventListener('click', event => {
    const mode = event.target.closest('[data-patrol-mode]');
    if (mode) {
      patrolView.mode = mode.dataset.patrolMode;
      patrolView.anchor = new Date();
      patrolView.search = '';
      patrolView.findingsOnly = false;
      renderPatrolOverview();
    }
    const shift = event.target.closest('[data-patrol-shift]');
    if (shift) {
      const amount = Number(shift.dataset.patrolShift);
      const anchor = patrolView.anchor;
      patrolView.anchor = patrolView.mode === 'day' ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + amount) : patrolView.mode === 'week'
        ? new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + amount * 7)
        : new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1);
      renderPatrolOverview();
    }
  });
  content.addEventListener('input', event => {
    if (event.target.id !== 'patrolSearch') return;
    patrolView.search = event.target.value;
    document.getElementById('patrolHistoryResults').innerHTML = patrolHistoryMarkup();
      document.getElementById('patrolDailyReports').outerHTML = patrolDailyReportMarkup(patrolView.rows);
  });
  content.addEventListener('change', async event => {
    if (event.target.id === 'builderItemJump' && event.target.value !== '') { const item = document.querySelector(`[data-question-index="${Number(event.target.value)}"]`); item?.scrollIntoView({behavior:'smooth', block:'center'}); item?.querySelector('input')?.focus({preventScroll:true}); }
    if (event.target.id === 'patrolTemplateSelect') { savePatrolDraft(); location.hash = `#/daily-safety-patrol${event.target.value ? `/template-${event.target.value}` : ''}`; }
    if (event.target.id === 'patrolDate' && event.target.value) { patrolView.anchor = new Date(`${event.target.value}T12:00:00`); renderPatrolOverview(); }
    if (event.target.closest('#patrolForm')) savePatrolDraft();
    if (event.target.id === 'patrolFindingsOnly') {
      patrolView.findingsOnly = event.target.checked;
      document.getElementById('patrolHistoryResults').innerHTML = patrolHistoryMarkup();
      document.getElementById('patrolDailyReports').outerHTML = patrolDailyReportMarkup(patrolView.rows);
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
        await uploadPatrolFiles(id, [...event.target.files], document.getElementById('patrolUploadQuestion')?.value || '');
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
    const answers = activePatrolTemplate ? Object.fromEntries(activePatrolTemplate.questions.filter(q => q.type !== 'photo').map(q => [q.id, data.get(q.id) || ''])) : Object.fromEntries(patrolSections.flatMap(([group, , items]) => items.map((_, index) => [`${group}_${index}`, data.get(`${group}_${index}`)])));
    if (!activePatrolTemplate && Object.values(answers).some(value => !value)) {
      output.textContent = 'Answer every inspection item.';
      output.hidden = false;
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const photoInputs = [...form.querySelectorAll('[data-photo-question]')];
      validatePatrolFiles([...files, ...photoInputs.flatMap(input => [...input.files])]);
      const {id} = await api('/api/patrols', 'POST', {template_id: activePatrolTemplate?.id, template_revision: activePatrolTemplate?.revision, inspector_name: data.get('inspector') === 'Other' ? data.get('other_name') : data.get('inspector'), answers, rating: Number(data.get('rating')), remarks: data.get('remarks')});
      try {
        await uploadPatrolFiles(id, files);
        for (const input of photoInputs) await uploadPatrolFiles(id, [...input.files], input.dataset.photoQuestion);
        if (activePatrolTemplate) await api(`/api/patrols/${id}/complete`, 'POST', {});
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
