/* Shared reporting experience: public capture and authenticated SHE administration. */
const SHEReporting = (() => {
  const maxPhotoBytes=10_000_000, maxPhotos=3;
  const photoError='Use up to 3 JPG, PNG or WebP photos, up to 10 MB each.';
  const validPhotos=files=>files.length<=maxPhotos && files.every(f=>f.size>0 && f.size<=maxPhotoBytes && ['image/jpeg','image/png','image/webp'].includes(f.type));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const groups = {environment:'Environment', 'hiyari-hatto':'Hiyari Hatto', kaizen:'Kaizen', 'air-leak':'Air Leak'};
  const publicGroups = {environment:'Environment', 'hiyari-hatto':'Hiyari Hatto'};
  const simpleTitles = {
    'Water leakage':'Water leak', 'Oil / chemical spillage':'Oil / chemical spill',
    'Improper waste disposal':'Waste in wrong place', 'Waste segregation issue':'Wrong waste bin',
    'Drainage / discharge issue':'Drain problem', 'Equipment leakage':'Equipment leak',
    'Energy wastage':'Energy waste', 'Other environmental concerns':'Other',
    'Hiyari Hatto':'Hiyari Hatto', 'Kaizen idea':'Idea'
  };
  const publicTitle = form => simpleTitles[form.title] || form.title;
  const defaultDescriptions = new Set(['Kebocoran paip air', 'Tumpahan minyak / bahan kimia',
    'Pembuangan sisa tidak betul', 'Isu pengasingan sisa', 'Isu saliran / pelepasan',
    'Kebocoran peralatan', 'Pembaziran tenaga', 'Lain-lain isu alam sekitar',
    'Report a near miss / laporkan kejadian nyaris', 'Suggest an improvement / cadangkan penambahbaikan']);
  const publicDescription = form => defaultDescriptions.has(form.description) ? '' : `<p>${esc(form.description)}</p>`;
  const symbols = {
    water:'<path d="M12 3S5 11 5 16a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M8 16a4 4 0 0 0 4 4"/>',
    spill:'<path d="M5 5h12v13H5zM5 9h12M5 15h12m16-4-3 5a3 3 0 0 0 6 0l-3-5Z"/>',
    waste:'<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
    recycle:'<path d="m8 4 4-2 4 7H8m10 2 4 4-4 6-4-7m-3 7H3l4-7 4 7"/>',
    drain:'<path d="M4 14h16M4 18h16M4 22h16M6 10 8 4l2 6m4 0 2-6 2 6"/>',
    tool:'<path d="m14 6 4 4 4-4a7 7 0 0 1-9 9l-7 7-4-4 7-7a7 7 0 0 1 5-9v4Z"/>',
    energy:'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
    leaf:'<path d="M21 3C9 2 2 8 4 16s17 6 17-13Z"/><path d="M3 22 16 9"/>',
    alert:'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v1"/>',
    idea:'<path d="M8 17c0-3-4-3-4-8a8 8 0 0 1 16 0c0 5-4 5-4 8H8Zm0 3h8m-7 3h6M9 9l3 3 3-3m-3 3v5"/>'
  };
  const svg = (name, size=32) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name] || symbols.leaf}</svg>`;
  let publicData, submitting=false, publicSubmission={}, staffSubmission=null, renderVersion=0, publicTransition;
  const publicRoot = document.getElementById('reportRoot');
  async function publicApi(path, method='GET', body) {
    const response = await fetch(path, {method, credentials:'same-origin', headers:body ? {'Content-Type':'application/json'} : {}, body:body ? JSON.stringify(body) : undefined});
    const result = await response.json();
    if (!response.ok) { const error=new Error(result.error || 'Could not connect. Please try again.');error.status=response.status;throw error; }
    return result;
  }
  const errorBox = () => '<div class="form-error" id="reportError" role="alert" hidden></div>';
  function showError(root, error) {
    const target = root.querySelector('#reportError');
    if (target) { target.textContent=error.message; target.hidden=false; target.scrollIntoView({block:'nearest'}); }
  }
  function hero(title, detail, kicker='SMALL ACTIONS. BETTER TOMORROWS.') {
    return `<section class="report-hero"><div><span class="report-kicker">${esc(kicker)}</span><h1>${title}</h1><p>${esc(detail)}</p></div><div class="report-hero-art" aria-hidden="true">${svg('leaf',100)}<span>SEE IT · REPORT IT · IMPROVE IT</span></div></section>`;
  }
  function choices() {
    const nearMissForms=publicData.forms.filter(f=>f.group==='hiyari-hatto');
    return `<div class="report-choice-grid report-home-choices" aria-label="Choose a reporting area">${[
      ['environment','leaf','Leak · Spill · Waste'],
      ['hiyari-hatto','alert','Hiyari Hatto']
    ].map(([key,symbol,desc])=>`<a class="report-choice choice-${key}" href="#/${key==='hiyari-hatto' && nearMissForms.length===1 ? key+'/'+nearMissForms[0].id : key}"><span class="report-symbol">${svg(symbol,34)}</span><div class="report-choice-copy"><h2>${publicGroups[key]}</h2><p>${desc}</p></div><span class="report-choice-go" aria-hidden="true">→</span></a>`).join('')}</div>`;
  }
  function menuTopics(list) {
    return `<div class="report-menu-grid">${list.map(f=>`<a href="#/${f.group}/${f.id}" class="report-menu-topic topic-${esc(f.icon)}"><span class="report-symbol">${svg(f.icon,32)}</span><div><h2>${esc(publicTitle(f))}</h2></div><span class="report-menu-go" aria-hidden="true">→</span></a>`).join('')}</div>`;
  }
  function topicCards(list, publicMode=true) {
    return `<div class="report-topic-grid">${list.map(f=>`<${publicMode ? 'a' : 'article'} ${publicMode ? `href="#/${f.group}/${f.id}"` : ''} class="report-topic topic-${esc(f.icon)} ${publicMode ? '' : 'report-topic-managed'}"><span class="report-symbol">${svg(f.icon)}</span><div><h3>${esc(f.title)}</h3><p>${esc(f.description)}</p><span class="report-workflow">${f.workflow !== 'she' ? '↗ Automatic work order' : 'SHE review & follow-up'}</span></div>${publicMode ? '<span aria-hidden="true">→</span>' : `<div class="report-topic-actions"><button class="secondary-button" data-edit-form="${f.id}">Edit</button><button class="report-danger" data-delete-form="${f.id}">Delete</button></div>`}</${publicMode ? 'a' : 'article'}>`).join('')}</div>`;
  }
  function field(q, simple=false, area='environment') {
    const id='answer-'+q.id, attrs=`id="${esc(id)}" name="${esc(q.id)}" ${q.required?'required':''}`;
    let control;
    if (q.type === 'textarea') control=`<textarea ${attrs} rows="4" maxlength="2000"></textarea>`;
    else if (q.type === 'select') control=`<select ${attrs}><option value="">Choose an answer</option>${q.options.map(o=>`<option>${esc(o)}</option>`).join('')}</select>`;
    else control=`<input ${attrs} type="${esc(q.type)}" ${q.type==='number'?'step="any"':'maxlength="2000"'} />`;
    const label = simple===true ? ({
      'What did you notice?':area==='kaizen'?'Your idea':area==='hiyari-hatto'?'What almost happened?':'What happened?',
      'Any immediate action or suggestion?':area==='kaizen'?'How will it help?':'What did you do?',
      ...(area==='hiyari-hatto'?{'Masalah / Problem':'Penemuan / Finding or near-miss description','Tarikh / Date':'Tarikh kejadian / Event date'}:{})
    }[q.label] || q.label) : q.label;
    return `<label for="${esc(id)}">${esc(label)} ${q.required?'<span class="required-mark">*</span>':'<small>Optional</small>'}</label>${control}`;
  }
  function captureForm(form) {
    const hiyari=form.group==='hiyari-hatto';
    const employeeIds=['employee_no','department','section','shift','experience'];
    const eventIds=['event_date','category','operation','stop'];
    const questions=ids=>form.questions.filter(q=>ids.includes(q.id)).map(q=>field(q,true,form.group)).join('');
    const section=(step,title,body,note='')=>`<section class="report-form-section"><span class="report-step">${step}</span><h2>${title}</h2>${note?`<p class="field-hint">${note}</p>`:''}${body}</section>`;
    const person=`<div class="report-two-col"><div><label for="reporter">Name <span class="required-mark">*</span></label><input id="reporter" name="reporter" maxlength="80" autocomplete="name" required /></div><div><label for="contact">Contact <small>Optional</small></label><input id="contact" name="contact" maxlength="160" autocomplete="tel" /></div></div>`;
    const place=`<div class="report-two-col"><div><label for="plant">Factory <span class="required-mark">*</span></label><select id="plant" name="plant" required><option value="">Choose factory</option><option value="port-klang">Port Klang</option><option value="sendayan">Sendayan</option></select></div><div><label for="location">${hiyari?'Event location':'Where is it?'} <span class="required-mark">*</span></label><input id="location" name="location" maxlength="240" placeholder="Area / machine / line" required /></div></div>`;
    const photo=`<label class="report-upload" for="photos"><b>＋ Add photos</b><span>At least 1 photo required · 3 photos max · 10 MB each</span><span>Select several photos at once, or add them one at a time.</span></label><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required /><div id="photoPreview" class="report-photo-preview" aria-live="polite"></div>`;
    const findingQuestions=form.questions.filter(q=>!employeeIds.includes(q.id)&&!eventIds.includes(q.id));
    const hints={description:'Describe what you observed or what almost happened.',consequence:'Explain who could be hurt and what could happen.',action:'Suggest how to prevent this from happening again.'};
    const finding=findingQuestions.map(q=>field(q,true,form.group)+(hints[q.id]?`<p class="field-hint">${hints[q.id]}</p>`:'')).join('');
    return `<form class="stacked-form report-form ${hiyari?'hiyari-capture':''}" id="findingForm">${hiyari?
      section('01','Employee details',person+questions(employeeIds),'Bahagian A · Team member. Enter your employee number and work details here.')+
      section('02','Event details',place+questions(eventIds),'Tell us where and when you noticed the hazard, near miss or improvement opportunity.')+
      section('03','Finding &amp; proposed action',finding,'Describe your finding below. SHE will complete the review and verification after submission.')+
      section('04','Photos',photo):
      section('01','Your details',person+place)+section('02','Finding details',form.questions.map(q=>field(q,true,form.group)).join(''))+section('03','Photos',photo)}<p class="report-privacy">Staff can see your details and photos. SHE will review your report and arrange any work order needed.</p>${errorBox()}<button type="submit" class="primary-button full-width">Send ${hiyari?'Hiyari Hatto':'report'} →</button><p class="report-urgent">Danger now? Tell your supervisor.</p></form>`;
  }
  function bindCapture(target,form,data,context=null) {
    const capture=target.querySelector('#findingForm');
    const state=context?.state || publicSubmission;
    if(context)capture.elements.reporter.value=currentUser.display_name;
    if(state.payload){
      const values={...state.payload,...state.payload.answers};
      for(const input of capture.querySelectorAll('input,select,textarea')){
        if(input.type!=='file' && values[input.name]!==undefined)input.value=values[input.name];
        input.disabled=true;
      }
      capture.querySelector('#photoPreview').textContent=state.payload.photos.map(p=>p.name).join(' · ');
      capture.querySelector('[type=submit]').textContent=state.busy?'Sending…':'Retry same report →';
      capture.querySelector('[type=submit]').disabled=Boolean(state.busy);
    }
    state.files ||= [];
    const picker=capture.querySelector('#photos'), preview=capture.querySelector('#photoPreview');
    const renderPhotos=()=>{
      picker.required=!state.files.length;
      preview.innerHTML=state.files.map((f,index)=>`<div class="report-photo-item"><span>${esc(f.name)} · ${(f.size/1_000_000).toFixed(1)} MB</span><button type="button" data-remove-photo="${index}" aria-label="Remove ${esc(f.name)}">Remove</button></div>`).join('');
    };
    if(!state.payload)renderPhotos();
    picker.addEventListener('change',event=>{
      const files=[...state.files,...Array.from(event.target.files)];
      picker.value='';
      if(!validPhotos(files)){showError(capture,new Error(photoError));return;}
      state.files=files;
      capture.querySelector('#reportError').hidden=true;
      renderPhotos();
    });
    preview.addEventListener('click',event=>{
      const button=event.target.closest('[data-remove-photo]');
      if(!button || state.busy || state.payload)return;
      state.files.splice(Number(button.dataset.removePhoto),1);
      renderPhotos();
    });
    capture.addEventListener('submit',event=>submitPublic(event,form,{...context,target,state,token:data.token,staff:Boolean(context)}));
  }
  function renderPublic() {
    if (!publicData || submitting) return;
    if (document.startViewTransition && publicRoot.dataset.view && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      publicTransition?.skipTransition();
      publicTransition=document.startViewTransition(renderPublicContent);
      publicTransition.finished.catch(()=>{});
    } else renderPublicContent();
  }
  function renderPublicContent() {
    if (!publicData || submitting) return;
    const [area,id] = location.hash.replace(/^#\/?/,'').split('/');
    const selected=publicGroups[area] && publicData.forms.find(f=>String(f.id)===id && f.group===area);
    publicRoot.dataset.view=selected ? 'form' : publicGroups[area] ? 'topics' : 'home';
    document.title = `${selected ? publicTitle(selected) : publicGroups[area] || 'Report to SHE'} · SHE Digital`;
    if (selected) {
      publicSubmission={key:crypto.randomUUID(),payload:null};
      publicRoot.innerHTML=`<div class="report-wrap report-form-wrap"><a class="back-link" href="#/${area}">← Back</a><div class="report-form-heading"><span class="report-symbol">${svg(selected.icon,42)}</span><h1>${esc(publicTitle(selected))}</h1>${selected.group === 'hiyari-hatto' ? '<p>Near misses, hazards and improvement opportunities</p>' : ''}${publicDescription(selected)}</div><div class="report-flow-note">${selected.workflow==='kaizen' ? 'SHE will arrange repairs.' : 'SHE will check your report.'}</div>${captureForm(selected)}</div>`;
      bindCapture(publicRoot,selected,publicData);
    } else if (publicGroups[area]) {
      const list=publicData.forms.filter(f=>f.group===area);
      publicRoot.innerHTML=`<div class="report-wrap report-menu"><a class="back-link" href="#/">← Back</a><div class="report-menu-heading"><h1>${esc(publicGroups[area])}<span>${svg(area==='environment'?'leaf':area==='kaizen'?'idea':'alert',32)}</span></h1><p>Choose one.</p></div>${list.length ? menuTopics(list) : '<p class="report-empty">No forms yet. Ask SHE.</p>'}</div>`;
    } else {
      publicRoot.innerHTML=`<div class="report-wrap report-home"><section class="report-welcome"><h1>Report to <em>SHE</em></h1><p>Choose one.</p></section>${choices()}<div class="report-home-trust"><span>No login needed</span></div></div>`;
    }
    window.scrollTo(0,0);
  }
  async function submitPublic(event,form,context) {
    event.preventDefault();
    const {state,target,staff}=context;
    if (state.busy) return;
    const root=event.currentTarget, button=root.querySelector('[type=submit]');
    state.busy=true;if(!staff)submitting=true;
    const retry=Boolean(state.payload);
    button.disabled=true; button.textContent='Sending…';
    root.querySelector('#reportError').hidden=true;
    try {
      if (!state.payload) {
        const files=state.files;
        if (!files.length) throw new Error('Attach at least one photo before sending your report.');
        if (!validPhotos(files)) throw new Error(photoError);
        const photos=await Promise.all(files.map(async f=>({name:f.name,mime:f.type,content:await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(new Error('Could not read photo.'));r.readAsDataURL(f);})})));
        const values=Object.fromEntries(new FormData(root));
        state.payload={token:context.token, request_key:state.key, form_id:form.id, revision:form.revision, reporter:values.reporter, contact:values.contact, plant:values.plant, location:values.location, answers:Object.fromEntries(form.questions.map(q=>[q.id,values[q.id] || ''])), photos};
      }
      // Refresh only the public token on retry; the report body and idempotency key stay unchanged.
      if (retry) state.payload.token=(await publicApi('/api/reporting/public')).token;
      root.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);
      const result=await (staff?api:publicApi)('/api/reporting/submit','POST',state.payload);
      state.result=result;state.payload=null;state.files=[];
      if(staff && (currentRoute()!=='hiyari-hatto' || moduleView()!=='checklist' || staffSubmission!==state || state.userId!==currentUser?.id))return;
      showReceipt(target,result,staff);
      window.scrollTo(0,0);
    } catch(error) {
      showError(root,error);
      if (error.status && error.status<500) {state.payload=null;root.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=false);}
      // Freeze an attempted payload until its receipt is recovered: retries must use the same key and body.
      if (state.payload) {
        root.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);
        const output=root.querySelector('#reportError');
        output.append(document.createTextNode(' Tap Retry to send the same report.'));
      }
    } finally {
      state.busy=false;if(!staff)submitting=false;
      button.disabled=false;button.textContent=state.payload ? 'Retry same report →' : 'Send report →';
      if(staff && context.version!==renderVersion && staffSubmission===state && state.userId===currentUser?.id && currentRoute()==='hiyari-hatto' && moduleView()==='checklist')renderStaff('hiyari-hatto');
    }
  }
  function showReceipt(target,result,staff=false) {
    target.dataset.view='success';
    const receiptHtml=`${staff?moduleNavigation():''}<div class="report-wrap report-success" role="status"><span class="report-success-icon">✓</span><h1>Report sent.</h1><p>SHE will review your finding.</p><strong class="report-reference">${esc(result.reference)}</strong><p>Keep this report number.</p>${result.order_state==='issued'?`<div class="report-flow-note">Work order: ${esc(result.order_id)}</div>`:result.order_state!=='none'?'<div class="report-flow-note">Report saved. SHE will arrange the work order.</div>':''}${staff?`<div class="report-admin-links"><a class="primary-button" href="#/reporting-inbox/${encodeURIComponent(result.reference.replace('SHE-','').replace(/^0+/,''))}">View submitted report →</a><button class="secondary-button" id="anotherHiyari">New Hiyari Hatto report</button></div>`:'<a class="primary-button" href="/report">New report →</a>'}</div>`;
    if(staff)renderSafetyModuleContent(`<div class="page inner-page">${receiptHtml}</div>`);else target.innerHTML=receiptHtml;
    target.querySelector('#anotherHiyari')?.addEventListener('click',()=>{staffSubmission=null;renderStaff('hiyari-hatto');});
  }
  const date = value => new Date(value*1000).toLocaleString('en-MY');
  const stateLabel = state => ({none:'SHE review',pending:'Work order pending',sending:'Check CMMS before linking',failed:'Work order needs retry',uncertain:'Check CMMS before linking',issued:'Work order issued'}[state] || state);
  const heading = (title,detail,actions='') => `<div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SHE / REPORTING</span><h1>${esc(title)}</h1><p>${esc(detail)}</p></div>${actions}</div>`;
  async function renderStaff(key) {
    const root=document.getElementById('content'), version=++renderVersion;
    const elevated=currentUser && ['admin','executive'].includes(currentUser.role);
    renderSafetyModuleContent('<div class="page inner-page"><div class="loading-panel">Loading reporting…</div></div>');
    try {
      if (key==='reporting-forms' && !elevated) {
        root.innerHTML='<div class="page inner-page">Executive access required.</div>';return;
      }
      if (key==='reporting-qr') {
        const result=await api('/api/reporting/qr');
        if(version!==renderVersion || currentRoute()!==key)return;
        root.innerHTML=`<div class="page inner-page"><a class="back-link" href="#/environmental">← Environment</a>${heading('Report to SHE QR','Scan to report environmental findings, water leaks or Hiyari Hatto. Every report requires at least one picture.')}<section class="report-qr-card report-detail-card"><img id="reportPublicQr" alt="Scan to open Report to SHE" width="280" height="280" /><div><h2>Report to SHE</h2><p>No sign-in needed. Choose a report, fill in the details and attach at least one picture.</p><p><a href="${esc(result.url)}" target="_blank" rel="noopener">${esc(result.url)}</a></p><div class="report-admin-links"><a class="primary-button" href="${esc(result.url)}" target="_blank" rel="noopener">Open reporting page ↗</a><a class="secondary-button" id="downloadReportQr" download="report-to-she-qr.svg">Download QR</a><a class="secondary-button" href="#/reporting-inbox">Open SHE inbox →</a></div></div></section>${SHEReportAlerts.controls()}</div>`;
        const qr='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(result.svg);
        root.querySelector('#reportPublicQr').src=qr;root.querySelector('#downloadReportQr').href=qr;
        SHEReportAlerts.bind(root);return;
      }
      if (key==='reporting-inbox') {
        const id=location.hash.split('/')[2];
        if (/^\d+$/.test(id || '')) { await detail(root,id,version); return; }
        const result=await api('/api/reporting/reports');
        if (version!==renderVersion || currentRoute()!==key) return;
        inbox(root,result.reports);return;
      }
      if (key==='environmental') {
        root.innerHTML=`<div class="page inner-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / ENVIRONMENT</span><h1>Environment</h1><p>Reporting and environmental tools.</p></div><div class="module-grid">${envItems.filter(canAccessRoute).map(route=>`<a class="module-card" href="#/${route}"><span class="module-icon">${icon(routes[route].icon,23)}</span><span class="module-copy"><strong>${routes[route].title}</strong><span>${route==='co2'?'CO2 tracking · Coming soon':'Open '+routes[route].title}</span></span>${icon('arrow',18)}</a>`).join('')}</div><section id="environmentReportingQr" class="report-detail-card"><h2>Report to SHE</h2><p>Loading reporting QR…</p></section>${SHEReportAlerts.controls()}</div>`;
        SHEReportAlerts.bind(root);
        const qr=await api('/api/reporting/qr');
        if(version!==renderVersion || currentRoute()!==key)return;
        root.querySelector('#environmentReportingQr').innerHTML=`<div class="report-qr-card"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}" alt="Scan to open Report to SHE" width="200" height="200" /><div><h2>Report to SHE</h2><p>Scan to report a finding. At least one picture is required for every report.</p><a class="primary-button" href="#/reporting-qr">View &amp; download QR →</a><p><a href="${esc(qr.url)}" target="_blank" rel="noopener">Open reporting page ↗</a></p></div></div>`;return;
      }
      if (key==='hiyari-hatto' && moduleView()!=='checklist') {
        const view=moduleView(), result=await api('/api/reporting/reports');
        if(version!==renderVersion || currentRoute()!==key)return;
        const rows=result.reports.filter(r=>r.group==='hiyari-hatto' && (view==='history'?['resolved','closed'].includes(r.status):!['resolved','closed'].includes(r.status)));
        inbox(root,rows,()=>renderStaff(key));
        root.querySelector('h1').textContent='Hiyari Hatto · '+(view==='history'?'History':'Current Active');
        return;
      }
      const result=await publicApi('/api/reporting/public');
      if (version!==renderVersion || currentRoute()!==key) return;
      if (key==='reporting-forms') { formList(root,result.forms);return; }
      if (key==='hiyari-hatto') {
        const available=result.forms.filter(f=>f.group==='hiyari-hatto');
        if(!available.length)throw new Error('The Hiyari Hatto form is unavailable. Contact SHE.');
        if(staffSubmission?.userId!==currentUser.id)staffSubmission=null;
        const selectedId=new URLSearchParams(location.hash.split('?')[1]||'').get('form');
        const saved=staffSubmission?.payload || staffSubmission?.result;
        const form=available.find(f=>String(f.id)===String(saved?staffSubmission.formId:selectedId)) || available[0];
        if(!staffSubmission || staffSubmission.formId!==form.id)staffSubmission={userId:currentUser.id,formId:form.id,key:crypto.randomUUID(),payload:null};
        if(staffSubmission.result){showReceipt(root,staffSubmission.result,true);return;}
        renderSafetyModuleContent(`<div class="page inner-page hiyari-staff-page">${moduleNavigation()}${heading(form.title,'Report a hazard, near miss or improvement opportunity. Complete Bahagian A; SHE handles the review and verification.')}<div class="hiyari-composer">${available.length>1?`<label for="hiyariFormChoice">Reporting form</label><select id="hiyariFormChoice" ${saved?'disabled':''}>${available.map(f=>`<option value="${f.id}" ${f.id===form.id?'selected':''}>${esc(f.title)}</option>`).join('')}</select>`:''}${captureForm(form)}</div></div>`);
        root.querySelector('#hiyariFormChoice')?.addEventListener('change',event=>{location.hash='/hiyari-hatto?form='+event.target.value;});
        bindCapture(root,form,result,{state:staffSubmission,version});
        return;
      }
      const group=key==='findings'?'environment':key;
      root.innerHTML=`<div class="page inner-page report-staff-page">${key==='hiyari-hatto'?moduleNavigation():''}${heading(key==='environmental'?'Environmental':groups[group] || key, 'Every finding is a chance to improve our workplace.', `<a href="/report${groups[group] ? '?area='+group : ''}" class="primary-button">Make a report ↗</a>`)}${hero('See it. Report it.<br /><em>Improve it.</em>', 'A simple, open reporting channel for employees and guests.', 'SHE ENVIRONMENTAL PROGRAMME')}<div class="report-admin-links">${['admin','executive'].includes(currentUser.role)?'<a class="secondary-button" href="#/environment-dashboard">Open Environmental Dashboard →</a>':''}<a class="secondary-button" href="#/reporting-inbox">Open Inbox →</a>${elevated ? '<a class="secondary-button" href="#/reporting-forms">Manage reporting forms →</a>' : ''}</div>${key==='environmental' ? `<div class="report-intro"><h2>Three ways to make a difference</h2><p>Share this public link on posters: <a href="/report">${esc(location.origin)}/report</a></p></div><div class="report-staff-options">${Object.entries(groups).map(([g,label])=>`<a class="report-staff-option" href="#/${g==='environment'?'findings':g}">${svg(g==='environment'?'leaf':g==='kaizen'?'idea':'alert')}<strong>${label}</strong><span>Open reporting area →</span></a>`).join('')}</div>` : `<div class="report-intro"><h2>Available forms</h2></div>${topicCards(result.forms.filter(f=>f.group===group)).replaceAll('href="#/', 'href="/report#/')}`}</div>`;
    } catch(error) { if (version===renderVersion&&currentRoute()===key) {renderSafetyModuleContent(`<div class="page inner-page"><p role="alert">${esc(error.message)}</p><button class="secondary-button" id="reportReload">Try again</button></div>`);root.querySelector('#reportReload')?.addEventListener('click',()=>renderStaff(key));} }
  }
  function inbox(root,reports,onRefresh=()=>renderStaff('reporting-inbox')) {
    renderSafetyModuleContent(`<div class="page inner-page">${heading('Inbox','View reports from employees and guests.', '<button class="secondary-button" id="refreshReports">Refresh</button>')}<div class="report-stats">${[['Total',reports.length],['Open',reports.filter(r=>r.status==='open').length],['In progress',reports.filter(r=>r.status==='in_progress').length],['Work order follow-up',reports.filter(r=>['pending','failed','uncertain','sending'].includes(r.order_state)).length]].map(([label,count])=>`<div><strong>${count}</strong><span>${label}</span></div>`).join('')}</div><div class="report-filter"><label>Search reports<input id="reportSearch" type="search" placeholder="Reference, name, location or topic" /></label><label>Status<select id="reportStatus"><option value="">All statuses</option>${['open','in_progress','resolved','closed'].map(s=>`<option value="${s}">${s.replace('_',' ')}</option>`).join('')}</select></label><label>Area<select id="reportArea"><option value="">All areas</option>${Object.entries(groups).map(([g,label])=>`<option value="${g}">${label}</option>`).join('')}</select></label></div><p class="field-hint">Showing up to the 500 most recent reports.</p><div id="reportRows" class="report-inbox-grid"></div>${SHEReportAlerts.controls()}</div>`);
    SHEReportAlerts.bind(root);
    const draw=()=>{
      const search=root.querySelector('#reportSearch').value.toLowerCase(), status=root.querySelector('#reportStatus').value, area=root.querySelector('#reportArea').value;
      const rows=reports.filter(r=>(!status || r.status===status) && (!area || r.group===area) && `${r.reference} ${r.title} ${r.reporter} ${r.location}`.toLowerCase().includes(search));
      root.querySelector('#reportRows').innerHTML=rows.length ? rows.map(r=>`<a class="report-inbox-card" href="#/reporting-inbox/${r.id}"><div class="report-card-top"><span>${esc(r.reference)}</span><span class="report-card-status status-${esc(r.status)}"><i></i>${esc(r.status.replace('_',' '))}</span></div><div class="report-card-category"><span>${svg(r.group==='environment'?'leaf':r.group==='kaizen'?'idea':'alert',22)}</span>${esc(groups[r.group])}</div><div class="report-card-with-photo"><div class="report-card-copy"><h3>${esc(publicTitle(r))}</h3><dl class="report-card-data"><div><dt>Location</dt><dd>${esc(r.location)}</dd></div><div><dt>Factory</dt><dd>${r.plant==='port-klang'?'Port Klang':'Sendayan'}</dd></div><div><dt>Reported by</dt><dd>${esc(r.reporter)}</dd></div></dl></div>${issueThumbnail(r.thumbnail_url)}</div>${r.order_state!=='none'?`<span class="report-card-order">${esc(stateLabel(r.order_state))}</span>`:''}<div class="report-card-bottom"><time>${date(r.created_at)}</time><span>View report →</span></div></a>`).join('') : '<p class="report-empty">No reports match these filters.</p>';
      bindIssueThumbnails(root);
    };
    root.querySelectorAll('.report-filter input,.report-filter select').forEach(el=>el.addEventListener('input',draw));
    root.querySelector('#refreshReports').addEventListener('click',onRefresh);draw();
  }
  async function detail(root,id,version) {
    const {report:r}=await api(`/api/reporting/reports/${id}`);
    const elevated=['admin','executive'].includes(currentUser.role);
    if (version!==renderVersion || currentRoute()!=='reporting-inbox') return;
    root.innerHTML=`<div class="page inner-page"><a class="back-link" href="#/reporting-inbox">← Inbox</a>${heading(r.snapshot.title,`${r.reference} · ${date(r.created_at)}`)}<div class="report-detail-grid"><section class="report-detail-card"><h2>Original report</h2><dl class="report-definition"><dt>Reporter</dt><dd>${esc(r.reporter)}</dd><dt>Contact / department</dt><dd>${esc(r.contact || 'Not supplied')}</dd><dt>Plant & location</dt><dd>${r.plant==='port-klang'?'Port Klang':'Sendayan'} · ${esc(r.location)}</dd>${r.snapshot.questions.map(q=>`<dt>${esc(q.label)}</dt><dd>${esc(r.answers[q.id] || 'Not supplied')}</dd>`).join('')}</dl><div class="report-evidence">${r.photos.map(p=>`<a href="data:${esc(p.mime)};base64,${esc(p.content)}" download="${esc(p.name)}"><img src="data:${esc(p.mime)};base64,${esc(p.content)}" alt="${esc(p.name)}" /><span>${esc(p.name)}</span></a>`).join('')}</div></section><div><section class="report-detail-card"><h2>Follow-up</h2><span class="report-status">${esc(r.status.replace('_',' '))}</span>${elevated ? `<form id="reportUpdate" class="stacked-form"><label for="actionStatus">Status</label><select id="actionStatus" name="status">${['open','in_progress','resolved','closed'].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}</select><label for="actionNote">Action / verification note</label><textarea id="actionNote" name="note" maxlength="2000" rows="4" required></textarea><button class="primary-button">Save follow-up</button></form>` : '<p>View only. SHE handles follow-up.</p>'}</section><section class="report-detail-card"><h2>Work order</h2><p>${esc(stateLabel(r.order_state))}</p>${r.order_id ? `<p>Order ID: <strong>${esc(r.order_id)}</strong></p><a class="secondary-button" href="#/work-orders/${encodeURIComponent(r.order_id)}/${r.plant}">Open work order →</a>` : ''}${r.order_error ? `<p class="report-urgent">${esc(r.order_error)}</p>` : ''}${elevated && r.order_state==='none'?'<p>Send this finding and its photos to CMMS for action.</p><button class="primary-button" id="issueOrder">Issue work order</button>':''}${elevated && ['pending','failed'].includes(r.order_state)?'<button class="secondary-button" id="retryOrder">Retry issuing work order</button>':''}${elevated && ['uncertain','sending'].includes(r.order_state)?'<p>Search CMMS for this report reference first. Link the matching order below to avoid creating a duplicate.</p><form id="linkOrder" class="stacked-form"><label for="orderId">Existing CMMS order ID</label><input id="orderId" name="order_id" maxlength="100" required /><button class="secondary-button">Link verified order</button></form>':''}</section>${errorBox()}</div></div><section class="report-detail-card"><h2>Action history</h2>${r.updates.length ? r.updates.map(u=>`<article class="report-update"><strong>${esc(u.actor)} · ${esc(u.status.replace('_',' '))}</strong><small>${date(u.created_at)}</small><p>${esc(u.note)}</p></article>`).join('') : '<p>No follow-up actions yet.</p>'}</section></div>`;
    if(r.snapshot.group==='hiyari-hatto'){
      const review=r.hiyari_review||{};
      const labels={hos_name:'Nama Head of Section',hos_employee_no:'No. pekerja Head of Section',rank:'Rank',stop:'STOP 6 (verified)',resolution:'Perkara / Tindakan penyelesaian',pic:'PIC',target_date:'Target date',team_member:'Dicadangkan oleh / Team member',head_of_section:'Disemak oleh / Head of Section',she_officer:'Disahkan oleh / SHE officer',manager:'Disahkan oleh / Manager (rank A)'};
      const input=(k,label)=>{const options=k==='rank'?['A','B','C','5S']:k==='stop'?['1','2','3','4','5','6','Fire','Others']:null;return `<div><label for="hh-${k}">${esc(label)}</label>${options?`<select id="hh-${k}" name="${k}"><option value="">Not classified</option>${options.map(o=>`<option ${review[k]===o?'selected':''}>${o}</option>`).join('')}</select>`:k==='resolution'?`<textarea id="hh-${k}" name="${k}" maxlength="2000" rows="4">${esc(review[k]||'')}</textarea>`:`<input id="hh-${k}" name="${k}" type="${k==='target_date'?'date':'text'}" maxlength="160" value="${esc(review[k]||'')}">`}</div>`;};
      root.querySelector('.report-detail-grid').insertAdjacentHTML('afterend',`<section class="report-detail-card" id="hiyariReview"><h2>FR-SH-12 Rev 1 (06.02.2018)</h2><div class="report-admin-links"><a class="secondary-button" target="_blank" rel="noopener" href="/templates/hiyari-hatto.pdf">Open blank template ↗</a><button class="secondary-button" id="printHiyari">Print completed form</button><a class="secondary-button" href="#/hiyari-dashboard">Hiyari Hatto Summary →</a></div><p>Bahagian A is the original report above. Attached photographs can include before and improvement sketches.</p><form id="hiyariReviewForm" class="stacked-form"><fieldset ${elevated?'':'disabled'}><legend>Bahagian B: Head of Section</legend><div class="hiyari-review-grid">${['hos_name','hos_employee_no','rank','stop','resolution','pic','target_date'].map(k=>input(k,labels[k])).join('')}</div><p>Rank A: death, disability or loss of limb. Rank B: work stoppage / MC. Rank C: minor injury / first aid. 5S is retained for workbook classification.</p></fieldset><fieldset ${elevated?'':'disabled'}><legend>Bahagian C: Review and verification</legend><p>Record the names of the people who reviewed the report. SHE records who saved each update and when. Manager verification is required for rank A closure.</p><div class="hiyari-review-grid">${['team_member','head_of_section','she_officer','manager'].map(k=>input(k,labels[k])).join('')}</div></fieldset>${elevated?`<label for="hh-status">Follow-up status</label><select id="hh-status" name="status">${['open','in_progress','resolved','closed'].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s.replace('_',' ')}</option>`).join('')}</select><p id="hiyariReviewError" class="form-error" role="alert" hidden></p><button class="primary-button">Save review and status</button>`:''}</form></section>`);
      root.querySelector('#reportUpdate')?.remove();
      root.querySelector('.page>.report-detail-card:last-child')?.classList.add('hiyari-history');
      root.querySelector('#hiyariReview').insertAdjacentHTML('beforeend',`<div class="hiyari-print-values"><h3>Bahagian B: Head of Section</h3><dl class="report-definition">${['hos_name','hos_employee_no','rank','stop','resolution','pic','target_date'].map(k=>`<dt>${esc(labels[k])}</dt><dd>${esc(review[k]||'Not supplied')}</dd>`).join('')}</dl><h3>Bahagian C: Review and verification</h3><dl class="report-definition">${['team_member','head_of_section','she_officer','manager'].map(k=>`<dt>${esc(labels[k])}</dt><dd>${esc(review[k]||'Not supplied')}</dd>`).join('')}</dl><p>Status: ${esc(r.status.replace('_',' '))} · ${esc(r.reference)}</p></div>`);
      root.querySelector('#printHiyari').onclick=()=>{document.body.classList.add('hiyari-print');const cleanup=()=>document.body.classList.remove('hiyari-print');window.addEventListener('afterprint',cleanup,{once:true});window.print();cleanup();};
      if(elevated)root.querySelector('#hiyariReviewForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;const values=Object.fromEntries(new FormData(e.target));try{await api(`/api/reporting/reports/${id}/hiyari-review`,'POST',{revision:r.revision,status:values.status,review:Object.fromEntries(Object.keys(labels).map(k=>[k,values[k]||'']))});await renderStaff('reporting-inbox');}catch(error){const box=root.querySelector('#hiyariReviewError');box.textContent=error.message;box.hidden=false;button.disabled=false;}};
    }
    if(r.order_id){
      const orderCard=root.querySelector('a[href^="#/work-orders/"]')?.closest('section');
      if(orderCard){
        const synced=r.order_photo_state==='synced';
        orderCard.insertAdjacentHTML('beforeend',`<p role="status">${synced?'Report photos copied to CMMS.':r.order_photo_state==='sending'?'Copying report photos to CMMS.':'Report photos still need to be copied to CMMS.'}</p>${r.order_photo_error?`<p class="report-urgent">${esc(r.order_photo_error)}</p>`:''}${elevated&&!synced?'<button type="button" class="secondary-button" id="syncOrderPhotos">Copy photos to work order</button>':''}`);
      }
    }
    const perform=async (path,body,button)=>{button.disabled=true;try {await api(path,'POST',body);await renderStaff('reporting-inbox');}catch(error){showError(root,error);button.disabled=false;}};
    root.querySelector('#syncOrderPhotos')?.addEventListener('click',event=>perform(`/api/reporting/reports/${id}/sync-order-photos`,{},event.target));
    root.querySelector('#reportUpdate')?.addEventListener('submit',event=>{event.preventDefault();perform(`/api/reporting/reports/${id}/updates`,{...Object.fromEntries(new FormData(event.target)),revision:r.revision},event.target.querySelector('button'));});
    root.querySelector('#issueOrder')?.addEventListener('click',event=>perform(`/api/reporting/reports/${id}/issue-order`,{},event.target));
    root.querySelector('#retryOrder')?.addEventListener('click',event=>perform(`/api/reporting/reports/${id}/retry-order`,{},event.target));
    root.querySelector('#linkOrder')?.addEventListener('submit',event=>{event.preventDefault();perform(`/api/reporting/reports/${id}/link-order`,Object.fromEntries(new FormData(event.target)),event.target.querySelector('button'));});
  }
  function formList(root,list) {
    root.innerHTML=`<div class="page inner-page">${heading('Reporting forms','Create and edit topics, questions and routing. Submitted reports retain their original questions.', '<button class="primary-button" id="addReportingForm">＋ New form</button>')}<div class="report-flow-note">Deleting removes a form from the public portal. Previously submitted reports remain in the SHE inbox.</div>${errorBox()}${Object.entries(groups).map(([g,label])=>`<div class="report-intro"><h2>${label}</h2></div>${topicCards(list.filter(f=>f.group===g),false)}`).join('')}</div>`;
    root.querySelector('#addReportingForm').addEventListener('click',()=>editor(root));
    root.querySelectorAll('[data-edit-form]').forEach(b=>b.addEventListener('click',()=>editor(root,list.find(f=>String(f.id)===b.dataset.editForm))));
    root.querySelectorAll('[data-delete-form]').forEach(b=>b.addEventListener('click',async()=>{
      const f=list.find(f=>String(f.id)===b.dataset.deleteForm);
      if (!confirm(`Delete “${f.title}” from the public reporting portal? Existing reports will be kept.`)) return;
      b.disabled=true;
      try {await api(`/api/reporting/forms/${f.id}/delete`,'POST',{revision:f.revision});await renderStaff('reporting-forms');}catch(error){showError(root,error);b.disabled=false;}
    }));
  }
  function editor(root,existing) {
    const f=existing ? structuredClone(existing) : {title:'',description:'',group:'environment',icon:'leaf',workflow:'she',questions:[{id:'q'+Date.now(),label:'Describe your finding',type:'textarea',required:true,options:[]}]};
    root.innerHTML=`<div class="page inner-page"><a class="back-link" href="#/reporting-forms" id="cancelEditor">← Reporting forms</a>${heading(existing?'Edit reporting form':'Create a reporting form','Shape a clear, helpful form for employees and guests.')}<form id="reportFormEditor" class="stacked-form report-editor"><section class="report-detail-card"><h2>Form details</h2><label for="formTitle">Form title</label><input id="formTitle" name="title" value="${esc(f.title)}" maxlength="120" required /><label for="formDescription">Description / Malay subtitle</label><textarea id="formDescription" name="description" rows="2" maxlength="1000">${esc(f.description)}</textarea><div class="report-two-col"><div><label for="formGroup">Reporting area</label><select id="formGroup" name="group">${Object.entries(groups).map(([g,label])=>`<option value="${g}" ${f.group===g?'selected':''}>${label}</option>`).join('')}</select></div><div><label for="formIcon">Topic icon</label><select id="formIcon" name="icon">${Object.keys(symbols).map(s=>`<option ${f.icon===s?'selected':''}>${s}</option>`).join('')}</select></div></div><label for="formWorkflow">After submission</label><select id="formWorkflow" name="workflow"><option value="she" ${f.workflow==='she'?'selected':''}>Send to SHE for review and action</option><option value="maintenance" ${f.workflow==='maintenance'?'selected':''}>Automatically issue a maintenance work order</option><option value="kaizen" ${f.workflow==='kaizen'?'selected':''}>Automatically issue a Kaizen work order</option></select><p class="field-hint">Every report also collects name, optional contact, plant, location and at least one required photo.</p></section><section class="report-detail-card"><h2>Questions</h2><div id="reportEditorQuestions"></div><button type="button" class="secondary-button" id="addQuestion">＋ Add question</button></section>${errorBox()}<div class="report-editor-actions"><button type="button" class="secondary-button" id="previewForm">Preview form</button><button class="primary-button" type="submit">Save form</button></div><section id="formPreview" class="report-detail-card" hidden></section></form></div>`;
    const form=root.querySelector('#reportFormEditor'), questions=root.querySelector('#reportEditorQuestions');
    function sync() {questions.querySelectorAll('[data-q-index]').forEach(el=>{const q=f.questions[Number(el.dataset.qIndex)];q.label=el.querySelector('[data-label]').value;q.type=el.querySelector('[data-type]').value;q.required=el.querySelector('[data-required]').checked;q.options=el.querySelector('[data-options]').value.split('\n').map(x=>x.trim()).filter(Boolean);});}
    function draw() {
      questions.innerHTML=f.questions.map((q,i)=>`<div class="report-question" data-q-index="${i}"><div class="report-question-top"><strong>Question ${i+1}</strong><div><button type="button" data-up="${i}" ${i===0?'disabled':''} aria-label="Move question ${i+1} up">↑</button><button type="button" data-down="${i}" ${i===f.questions.length-1?'disabled':''} aria-label="Move question ${i+1} down">↓</button><button type="button" data-remove="${i}" ${f.questions.length===1?'disabled':''}>Remove</button></div></div><label for="qLabel${i}">Question wording</label><input id="qLabel${i}" data-label value="${esc(q.label)}" maxlength="240" required /><label for="qType${i}">Answer type</label><select id="qType${i}" data-type>${Object.entries({text:'Short answer',textarea:'Long answer',select:'Choose one',number:'Number',date:'Date'}).map(([value,label])=>`<option value="${value}" ${q.type===value?'selected':''}>${label}</option>`).join('')}</select><div data-choice-fields ${q.type==='select'?'':'hidden'}><label for="qOptions${i}">Choices · one per line</label><textarea id="qOptions${i}" data-options rows="3">${esc(q.options.join('\n'))}</textarea></div><label class="report-checkbox"><input type="checkbox" data-required ${q.required?'checked':''} /> Required answer</label></div>`).join('');
      questions.querySelectorAll('[data-type]').forEach(el=>el.addEventListener('change',()=>{el.closest('.report-question').querySelector('[data-choice-fields]').hidden=el.value!=='select';}));
      questions.querySelectorAll('[data-up],[data-down],[data-remove]').forEach(b=>b.addEventListener('click',()=>{sync();const i=Number(b.dataset.up ?? b.dataset.down ?? b.dataset.remove);if (b.hasAttribute('data-remove')) f.questions.splice(i,1);else {const j=i+(b.hasAttribute('data-up')?-1:1);[f.questions[i],f.questions[j]]=[f.questions[j],f.questions[i]];}draw();}));
    }
    draw();
    root.querySelector('#cancelEditor').addEventListener('click',e=>{e.preventDefault();renderStaff('reporting-forms');});
    root.querySelector('#addQuestion').addEventListener('click',()=>{sync();if(f.questions.length>=30){showError(root,new Error('Maximum 30 questions.'));return;}f.questions.push({id:'q'+crypto.randomUUID().replaceAll('-',''),label:'',type:'text',required:false,options:[]});draw();});
    root.querySelector('#previewForm').addEventListener('click',()=>{sync();const values=Object.fromEntries(new FormData(form)), preview=root.querySelector('#formPreview');preview.hidden=false;preview.innerHTML=`<span class="report-kicker">PREVIEW · UNSAVED</span><h2>${esc(values.title || 'Untitled form')}</h2><p>${esc(values.description)}</p><div class="stacked-form">${f.questions.map(field).join('')}</div>`;preview.querySelectorAll('input,textarea,select').forEach(el=>el.disabled=true);preview.scrollIntoView({block:'start',behavior:'smooth'});});
    form.addEventListener('submit',async event=>{
      event.preventDefault();sync();const button=form.querySelector('[type=submit]');button.disabled=true;
      try {const values=Object.fromEntries(new FormData(form));await api(existing?`/api/reporting/forms/${f.id}`:'/api/reporting/forms',existing?'PATCH':'POST',{...values,revision:f.revision,questions:f.questions});await renderStaff('reporting-forms');}catch(error){showError(root,error);button.disabled=false;}
    });
  }
  if (publicRoot) {
    publicApi('/api/reporting/public').then(data=>{publicData=data;const area=new URLSearchParams(location.search).get('area');if (!location.hash && publicGroups[area]) location.hash='/'+area;renderPublic();}).catch(error=>{publicRoot.innerHTML=`<div class="report-wrap"><p role="alert">${esc(error.message)}</p><a class="secondary-button" href="/report">Try again</a></div>`;});
    window.addEventListener('hashchange',renderPublic);
  }
  return {renderStaff};
})();
