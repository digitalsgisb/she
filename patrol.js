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

function patrolGrid(group, title, items, answers = null) {
  return `<fieldset class="patrol-section"><legend>${escapeHtml(title)} <span class="required">*</span></legend><div class="patrol-grid"><div class="patrol-grid-header"><span>Inspection item</span><span>OK</span><span>NOT OK</span><span>N/A</span></div>${items.map((label, index) => {
    const key = `${group}_${index}`;
    return `<div class="patrol-grid-row"><div class="patrol-item">${String.fromCharCode(97 + index)}) ${escapeHtml(label)}</div>${['ok', 'not_ok', 'na'].map(status => answers ? `<span class="patrol-result ${answers[key] === status ? 'selected' : ''}">${answers[key] === status ? '●' : '—'}</span>` : `<label class="patrol-choice"><input type="radio" name="${key}" value="${status}" aria-label="${escapeHtml(label)}: ${status === 'not_ok' ? 'NOT OK' : status.toUpperCase()}" required /><span></span></label>`).join('')}</div>`;
  }).join('')}</div></fieldset>`;
}

function patrolHeading(extra = '') {
  return `<div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SHE / SAFETY</span><h1>Daily Safety Patrol Checklist</h1><p>${patrolIntro}</p></div>${extra}</div>`;
}

function renderPatrolForm() {
  content.innerHTML = `<div class="page inner-page patrol-page">${patrolHeading('<a class="secondary-button" href="#/safety">Past patrols</a>')}<form id="patrolForm" class="patrol-card">
    <fieldset class="patrol-section patrol-inspector"><legend>Inspector's Name <span class="required">*</span></legend><div class="patrol-inspector-options"><label><input type="radio" name="inspector" value="Sara" required /> Sara</label><label><input type="radio" name="inspector" value="Aman" /> Aman</label><label><input type="radio" name="inspector" value="Other" /> Other</label><input id="patrolOtherName" name="other_name" type="text" maxlength="80" placeholder="Enter inspector name" disabled /></div></fieldset>
    ${patrolSections.map(([group, title, items]) => patrolGrid(group, title, items)).join('')}
    <fieldset class="patrol-section"><legend>Overall Rating <span class="required">*</span></legend><div class="patrol-stars" role="radiogroup" aria-label="Overall rating">${[1, 2, 3].map(value => `<label><input type="radio" name="rating" value="${value}" required /><span aria-hidden="true">☆</span><span class="sr-only">${value} ${value === 1 ? 'star' : 'stars'}</span></label>`).join('')}</div></fieldset>
    <div class="patrol-field"><label for="patrolRemarks">Remarks</label><textarea id="patrolRemarks" name="remarks" rows="4" maxlength="5000" placeholder="Add findings or follow-up notes"></textarea></div>
    <div class="patrol-field"><label for="patrolFiles">Attachments</label><input id="patrolFiles" name="files" type="file" multiple accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,image/*,video/*,audio/*" /><small>Up to 10 files, 1 GB each. Word, Excel, PowerPoint, PDF, image, video, or audio.</small></div>
    <div class="form-error" id="patrolError" role="alert" hidden></div><div class="patrol-actions"><a class="secondary-button" href="#/safety">Cancel</a><button class="primary-button" type="submit">Submit patrol</button></div>
  </form></div>`;
}

async function renderSafety() {
  content.innerHTML = `<div class="page inner-page patrol-page">${patrolHeading('<a class="primary-button" href="#/daily-safety-patrol">+ New patrol</a>')}<div class="loading-panel">Loading patrols…</div></div>`;
  try {
    const {patrols} = await api('/api/patrols');
    if (currentRoute() !== 'safety') return;
    content.innerHTML = `<div class="page inner-page patrol-page">${patrolHeading('<a class="primary-button" href="#/daily-safety-patrol">+ New patrol</a>')}<section class="patrol-card"><h2>Past patrols</h2>${patrols.length ? `<div class="patrol-list">${patrols.map(row => `<a href="#/daily-safety-patrol/${row.id}" class="patrol-list-row"><span><strong>#${row.id} · ${escapeHtml(row.inspector_name)}</strong><small>${new Date(row.created_at * 1000).toLocaleString()} · Submitted by ${escapeHtml(row.submitted_by)}</small></span><span>${'★'.repeat(row.rating)}${'☆'.repeat(3 - row.rating)} ${icon('chevron', 16)}</span></a>`).join('')}</div>` : '<p class="patrol-empty">No patrols submitted yet. Start the first checklist.</p>'}</section></div>`;
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
  content.addEventListener('change', async event => {
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
    } catch (error) {
      output.textContent = error.message;
      output.hidden = false;
    } finally { button.disabled = false; }
  });
}
