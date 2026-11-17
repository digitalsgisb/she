/* One clear finding at a time: shared detail view for every dashboard record table.
   SHEFinding.bind(target, rows, kind) makes each table row / card open the finding in place;
   "Back to dashboard" (or the browser/phone back button) restores the page exactly as it was. */
const SHEFinding = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const when = seconds => new Date(seconds * 1000).toLocaleString('en-MY', {timeZone:'Asia/Kuala_Lumpur', day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit'});
  const day = iso => iso ? new Date(iso + 'T12:00:00+08:00').toLocaleDateString('en-MY', {timeZone:'Asia/Kuala_Lumpur', day:'numeric', month:'short', year:'numeric'}) : '';
  const isImage = mime => /^image\//.test(mime || '');
  const done = status => /^(resolved|closed|close)$/i.test(String(status || ''));
  const badge = status => `<span class="she-record-badge ${done(status) ? 'is-complete' : ''}">${esc(String(status || '—').replaceAll('_', ' '))}</span>`;
  const plants = {'port-klang':'Port Klang', sendayan:'Sendayan'};
  const backLabels = {'patrol-item':'Back to dashboard', patrol:'Back to dashboard', 'red-tag':'Back to dashboard', report:'Back to dashboard'};
  let state = null;

  function photos(list, empty) {
    return list.length ? `<div class="finding-photos">${list.map(p => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${esc(p.label)}" loading="lazy"></a>`).join('')}</div>` : `<p class="finding-empty">${esc(empty)}</p>`;
  }
  function timeline(items, empty) {
    return items.length ? `<ol class="finding-timeline">${items.map(u => `<li><div><strong>${esc(u.author)}</strong>${u.status ? badge(u.status) : ''}<small>${esc(u.when)}</small></div>${u.note ? `<p>${esc(u.note)}</p>` : ''}${u.photos?.length ? photos(u.photos, '') : ''}</li>`).join('')}</ol>` : `<p class="finding-empty">${esc(empty)}</p>`;
  }
  function facts(list) {
    return `<dl class="finding-meta">${list.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value, html]) => `<div><dt>${esc(label)}</dt><dd>${html ? value : esc(value)}</dd></div>`).join('')}</dl>`;
  }
  function splitLabel(text) {
    const [english, malay] = String(text || '').replace(/^\d+\)\s*/, '').split(/\s*\|\s*/);
    return `<p class="finding-question">${esc(english || 'Checklist item')}</p>${malay ? `<p class="finding-question-ms">${esc(malay)}</p>` : ''}`;
  }
  function card(title, inner, attr = '') { return `<section class="report-detail-card finding-card" ${attr}><h3>${esc(title)}</h3>${inner}</section>`; }

  /* Each kind returns {chip, title, facts, sections (html, may contain loaders), link, load(view)}. */
  const kinds = {
    'patrol-item': record => ({
      chip: record.category, chipClass: record.category === 'Spillage' ? 'is-spillage' : 'is-aedes',
      title: record.remark || 'No location or remark recorded',
      facts: [['Date', record.created_at ? when(record.created_at) : day(record.date)], ['Inspector', record.inspector], ['Patrol', record.reference], ['Status', badge(record.status), true]],
      body: card('What was checked', splitLabel(record.item) + `<p class="finding-answer"><span>NOT OK</span> Marked by ${esc(record.inspector)}</p>`) +
            card('Photos', SHEUI.skeleton('block', 1, 'Loading photos'), 'data-finding-photos') +
            card('Follow-up', SHEUI.skeleton('list', 2, 'Loading follow-up'), 'data-finding-updates'),
      link: ['#/daily-safety-patrol/' + record.id, 'Open full patrol record →'],
      async load(view) {
        const {patrol} = await api('/api/patrols/' + record.id);
        const src = a => '/api/patrols/' + record.id + '/attachments/' + a.id;
        fill(view, '[data-finding-photos]', photos(patrol.attachments.filter(a => a.question_id === record.question_id && isImage(a.mime_type)).map(a => ({url:src(a), label:'Photo of ' + record.category})), 'No photo was taken for this item.'));
        fill(view, '[data-finding-updates]', patrolUpdates(patrol, src));
      }
    }),
    patrol: record => ({
      chip: 'Safety patrol', title: (record.checklist || record.title || 'Safety patrol') + ' · ' + (record.reference || 'Patrol #' + record.id),
      facts: [['Date', day(record.date)], ['Inspector', record.inspector], ['NOT OK items', record.not_ok], ['Status', badge(record.status), true]],
      body: card('NOT OK items', SHEUI.skeleton('list', 3, 'Loading findings'), 'data-finding-items') +
            card('Patrol remarks', SHEUI.skeleton('text', 1, 'Loading remarks'), 'data-finding-remarks') +
            card('Follow-up', SHEUI.skeleton('list', 2, 'Loading follow-up'), 'data-finding-updates'),
      link: ['#/daily-safety-patrol/' + record.id, 'Open full patrol record →'],
      async load(view) {
        const {patrol} = await api('/api/patrols/' + record.id);
        const src = a => '/api/patrols/' + record.id + '/attachments/' + a.id;
        const questions = patrol.template?.questions || [];
        const bad = questions.filter(q => q.type === 'status' && patrol.answers[q.id] === 'not_ok');
        fill(view, '[data-finding-items]', bad.length ? `<ol class="finding-items">${bad.map(q => {
          const pics = patrol.attachments.filter(a => a.question_id === q.id && isImage(a.mime_type)).map(a => ({url:src(a), label:q.label}));
          const remark = patrol.item_remarks?.[q.id];
          return `<li>${splitLabel(q.label)}<p class="finding-answer"><span>NOT OK</span>${remark ? esc(remark) : 'No remark'}</p>${pics.length ? photos(pics, '') : ''}</li>`;
        }).join('')}</ol>` : '<p class="finding-empty">No NOT OK items in this patrol.</p>');
        const rating = patrol.rating ? patrol.rating + ' star' + (patrol.rating === 1 ? '' : 's') : '';
        fill(view, '[data-finding-remarks]', `${patrol.remarks ? `<p class="finding-text">${esc(patrol.remarks)}</p>` : '<p class="finding-empty">No overall remarks.</p>'}${rating ? `<p class="finding-empty">Overall rating: ${esc(rating)} · Submitted by ${esc(patrol.submitted_by)}</p>` : ''}`);
        fill(view, '[data-finding-updates]', patrolUpdates(patrol, src));
      }
    }),
    'red-tag': record => ({
      chip: 'Red Tag', title: record.title || 'Red Tag finding',
      facts: [['Date', day(record.date)], ['Red Tag', record.reference], ['Section', record.section], ['PIC', record.pic], ['Status', badge(record.status), true]],
      body: card('Hazard', SHEUI.skeleton('text', 2, 'Loading finding'), 'data-finding-hazard') +
            card('Photos', photos([{url:'/api/red-tags/' + record.id + '/photo', label:'Before · ' + (record.reference || '')}], ''), 'data-finding-photos') +
            card('Follow-up', SHEUI.skeleton('list', 2, 'Loading follow-up'), 'data-finding-updates'),
      link: ['#/red-tag/' + record.id, 'Open full Red Tag record →'],
      async load(view) {
        const {finding, updates} = await api('/api/red-tags/' + record.id);
        fill(view, '[data-finding-hazard]', `<p class="finding-text">${esc(finding.hazard)}</p>${facts([['Machine / area', finding.machine], ['Rank', finding.rank], ['Type of stop', finding.type_of_stop], ['Recommendation', finding.recommendation], ['Issued by', finding.issued_by]])}`);
        fill(view, '[data-finding-updates]', timeline(updates.map(u => ({author:u.actor, status:u.status, when:when(u.created_at), note:u.note,
          photos:u.has_after_photo ? [{url:'/api/red-tags/' + record.id + '/updates/' + u.id + '/photo', label:'After photo'}] : []})), 'No follow-up yet.'));
      }
    }),
    report: record => ({
      chip: record.area || record.group_label || 'Report', title: record.title || record.category || 'Report',
      facts: [['Date', record.created_at ? when(record.created_at) : day(record.date)], ['Reference', record.reference], ['Location', [record.location, plants[record.plant] || record.plant].filter(Boolean).join(' · ')], ['Reporter', record.reporter], ['Status', badge(record.status), true]],
      body: card('What was reported', SHEUI.skeleton('text', 3, 'Loading report'), 'data-finding-answers') +
            card('Photos', SHEUI.skeleton('block', 1, 'Loading photos'), 'data-finding-photos') +
            card('Follow-up', SHEUI.skeleton('list', 2, 'Loading follow-up'), 'data-finding-updates'),
      link: ['#/reporting-inbox/' + record.id, 'Open full report →'],
      async load(view) {
        const {report} = await api('/api/reporting/reports/' + record.id);
        const known = report.snapshot?.questions?.length ? report.snapshot.questions
          : Object.keys(report.answers || {}).map(id => ({id, label: id.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())}));
        const answered = known.filter(q => report.answers[q.id] !== undefined && report.answers[q.id] !== null && report.answers[q.id] !== '');
        const review = report.hiyari_review || {};
        const reviewFacts = [['Rank', review.rank], ['STOP 6', review.stop], ['PIC', review.pic], ['Target date', review.target_date], ['Resolution', review.resolution]].filter(([, v]) => v);
        fill(view, '[data-finding-answers]', (answered.length ? `<dl class="finding-answers">${answered.map(q => `<div><dt>${esc(q.label)}</dt><dd>${esc(Array.isArray(report.answers[q.id]) ? report.answers[q.id].join(', ') : report.answers[q.id])}</dd></div>`).join('')}</dl>` : '<p class="finding-empty">No answers recorded.</p>') +
          (reviewFacts.length ? `<h3 class="finding-subhead">SHE review</h3>${facts(reviewFacts)}` : '') +
          (report.order_id ? `<p class="finding-empty">CMMS work order ${esc(report.order_id)}</p>` : ''));
        fill(view, '[data-finding-photos]', photos((report.photos || []).map((p, i) => ({url:'/api/reporting/reports/' + record.id + '/photos/' + i, label:'Photo ' + (i + 1)})), 'No photo attached.'));
        fill(view, '[data-finding-updates]', timeline((report.updates || []).map(u => ({author:u.actor, status:u.status, when:when(u.created_at), note:u.note.startsWith('FR-SH-12 review:') ? 'Hiyari Hatto review saved.' : u.note})), 'No follow-up yet.'));
      }
    })
  };

  function patrolUpdates(patrol, src) {
    const labels = {open:'Open', action_taken:'Awaiting verification', resolved:'Resolved'};
    return timeline(patrol.updates.map(u => ({author:u.author, status:labels[u.status] || u.status, when:when(u.created_at), note:u.message,
      photos:u.attachments.filter(a => isImage(a.mime_type)).map(a => ({url:src(a), label:'After photo'}))})), 'No follow-up yet. Open the full patrol record to update it or issue a work order.');
  }
  function fill(view, selector, html) { const node = view.querySelector(selector); if (node) { node.innerHTML = node.querySelector('h3').outerHTML + html; node.dataset.filled = 'true'; } }

  function open(rows, index, kind) {
    const page = document.querySelector('#content > .page');
    if (!page) return;
    const record = rows[index], spec = kinds[kind]?.(record);
    if (!spec) return;
    if (!state) {
      // Hide (not destroy) the dashboard so its filters, tabs and scroll survive.
      state = {page, scroll: window.scrollY, pushed: false};
      try { history.pushState({sheFinding: true}, '', location.href); state.pushed = true; } catch {}
      page.hidden = true;
    }
    state.view?.remove();
    const nav = `<div class="finding-nav"><button type="button" class="primary-button finding-back" data-finding-back>← ${esc(backLabels[kind])}</button>${rows.length > 1 ? `<div class="finding-step"><button type="button" class="secondary-button" data-finding-step="-1" ${index === 0 ? 'disabled' : ''}>‹ Previous</button><span>Finding ${index + 1} of ${rows.length}</span><button type="button" class="secondary-button" data-finding-step="1" ${index === rows.length - 1 ? 'disabled' : ''}>Next ›</button></div>` : ''}</div>`;
    const view = document.createElement('div');
    view.className = 'page inner-page finding-page';
    view.innerHTML = `${nav}<article class="finding" aria-labelledby="findingTitle"><header class="report-detail-card finding-head"><span class="finding-chip ${esc(spec.chipClass || '')}"><i aria-hidden="true"></i>${esc(spec.chip)}</span><h1 id="findingTitle">${esc(spec.title)}</h1>${facts(spec.facts)}</header>${spec.body}<p class="finding-more"><a class="secondary-button" href="${esc(spec.link[0])}">${esc(spec.link[1])}</a></p></article>${nav}`;
    page.after(view);
    state.view = view;
    view.querySelectorAll('[data-finding-back]').forEach(b => b.onclick = back);
    view.querySelectorAll('[data-finding-step]').forEach(b => b.onclick = () => open(rows, index + Number(b.dataset.findingStep), kind));
    window.scrollTo({top: 0});
    view.querySelector('[data-finding-back]').focus({preventScroll: true});
    spec.load(view).catch(error => {
      if (!view.isConnected) return;
      view.querySelectorAll('[data-finding-updates],[data-finding-items],[data-finding-answers],[data-finding-hazard],[data-finding-remarks],[data-finding-photos]').forEach(node => {
        if (!node.dataset.filled && node.querySelector('[aria-busy], [role="status"]')) node.innerHTML = node.querySelector('h3').outerHTML + `<p class="form-error" role="alert">${esc(error.message)}</p>`;
      });
    });
  }
  function restore() {
    if (!state) return;
    const {page, view, scroll} = state;
    state = null;
    view?.remove();
    if (page.isConnected) { page.hidden = false; window.scrollTo({top: scroll}); }
  }
  function back() {
    if (state?.pushed) { history.back(); return; }
    restore();
  }
  window.addEventListener('popstate', () => { if (state) restore(); });
  // Leaving the route (sidebar link, hash change) drops the detail without touching history.
  window.addEventListener('hashchange', () => { if (state) { state.pushed = false; state.view?.remove(); state = null; } });

  /* Make each row (table) or card of `target` open its record. */
  function bind(target, rows, kind) {
    if (!target || !rows?.length || !kinds[kind]) return;
    const items = target.querySelectorAll('tbody tr, .she-record-card');
    items.forEach((item, index) => {
      if (!rows[index]) return;
      item.classList.add('finding-row');
      item.addEventListener('click', event => {
        if (event.target.closest('.she-evidence, [data-load-evidence]') || event.ctrlKey || event.metaKey) return;
        event.preventDefault(); event.stopPropagation();
        open(rows, index, kind);
      });
    });
  }
  return {bind, open, restore};
})();
