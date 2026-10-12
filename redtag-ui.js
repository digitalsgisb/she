/* Safety genba / red-tag workspace. */
let genbaDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kuala_Lumpur', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
let genbaSettings = null;
let genbaRows = [];
let genbaShowCompleted=false;
const genbaInbox = () => currentRoute()==='red-tag-pic';
const genbaRouteActive = () => ['red-tag','red-tag-pic'].includes(currentRoute());
const genbaManager = () => ['admin','executive'].includes(currentUser.role);
const genbaField = (name,label,max=200) => '<label>'+label+'<input name="'+name+'" maxlength="'+max+'" required></label>';
function genbaError(error, target=content) {
  let box=target.querySelector('[data-genba-error]');
  if(!box){box=document.createElement('p');box.className='form-error';box.dataset.genbaError='';target.prepend(box);}
  box.textContent=error.message;box.hidden=false;
}
let genbaRenderSequence=0;
async function renderGenba(quiet=false) {
  const sequence=++genbaRenderSequence, route=currentRoute(), day=genbaDate;
  if(!quiet)content.innerHTML='<div class="page inner-page"><div class="loading-panel">Loading safety genba…</div></div>';
  try {
    const [config, result]=await Promise.all([api('/api/red-tags/settings'),api(genbaInbox()?'/api/red-tags?inbox=1':'/api/red-tags?date='+genbaDate)]);
    if(!genbaRouteActive()||currentRoute()!==route||genbaDate!==day||sequence!==genbaRenderSequence)return;
    if(quiet&&JSON.stringify(result.findings)===JSON.stringify(genbaRows))return;
    genbaSettings=config;genbaRows=result.findings;
    const visibleRows=genbaInbox()&&!genbaShowCompleted?genbaRows.filter(r=>!['Resolved','Closed'].includes(r.status)):genbaRows;
    content.innerHTML='<div class="page inner-page"><div class="page-heading page-heading-actions"><div><span class="eyebrow dark-eyebrow">SAFETY / TUESDAY GENBA</span><h1>'+ (genbaInbox()?'My Red Tag Actions':'Red Tag · Safety genba') +'</h1><p>'+(genbaInbox()?'Open a finding, take action, and send an after photo to SHE.':'Record hazards during the committee genba, assign a PIC, and follow actions through to verification.')+'</p></div>'+(!genbaInbox()?'<button class="primary-button" id="genbaNew">+ New finding</button>':'')+'</div>'+(!genbaInbox()&&SHEStats.allowed()?'<section id="genbaStatistics"></section>':'')+'<div class="genba-toolbar">'+(!genbaInbox()?'<label>Genba date<input id="genbaDate" type="date" value="'+genbaDate+'"></label><a class="secondary-button" target="_blank" rel="noopener" href="/api/red-tags/print?date='+genbaDate+'">Print findings / Save PDF</a><a class="secondary-button" href="/api/red-tags/export?date='+genbaDate+'">Export for Google Sheets</a>':'')+'<button class="secondary-button" id="genbaRefresh">Refresh</button>'+(genbaInbox()?'<label class="genba-completed-toggle"><input id="genbaCompleted" type="checkbox" '+(genbaShowCompleted?'checked':'')+'> Show completed</label>':'')+(genbaManager()?'<button class="secondary-button" id="genbaMaster">Manage sections &amp; PICs</button>':'')+'</div>'+(!genbaInbox()?'<p class="field-hint">Tuesday is the regular safety genba day. You can record and print findings for any date. Before pictures stay in SHE Digital; CSV exports contain the finding details.</p>':'')+'<div class="genba-summary"><strong>'+genbaRows.length+' '+(genbaInbox()?'assigned findings':'findings')+'</strong><span>'+genbaRows.filter(r=>['Open','In progress'].includes(r.status)).length+' to do</span><span>'+genbaRows.filter(r=>r.status==='Action taken · awaiting review').length+' awaiting SHE verification</span></div><div class="genba-grid">'+visibleRows.map(r=>'<button class="genba-record" data-genba-id="'+r.id+'"><img src="/api/red-tags/'+r.id+'/photo" alt="Before picture" loading="lazy"><span class="genba-record-body"><strong>'+escapeHtml(r.red_tag_id)+'</strong><span class="state-badge">'+escapeHtml(r.status)+'</span><h2>'+escapeHtml(r.section)+'</h2><span>'+escapeHtml(r.machine)+' · PIC '+escapeHtml(r.pic)+'</span><p>'+escapeHtml(r.hazard)+'</p><small>Rank '+escapeHtml(r.rank)+' · '+escapeHtml(r.issued_by)+(r.printed_at?' · Printed':'')+'</small><span class="genba-card-action">'+(genbaInbox()?'Open &amp; take action':'View finding')+' →</span></span></button>').join('')+'</div>'+(!visibleRows.length?'<div class="category-empty">'+(genbaInbox()?"You're up to date. New findings assigned to you will appear here.":'No findings for this date. Add the first genba finding.')+'</div>':'')+'</div>';
    if(!genbaInbox()&&SHEStats.allowed())SHEStats.mount(document.getElementById('genbaStatistics'),'red-tag');
    if(document.getElementById('genbaDate'))document.getElementById('genbaDate').onchange=e=>{if(e.target.value){genbaDate=e.target.value;renderGenba();}};
    document.getElementById('genbaRefresh').onclick=()=>renderGenba();
    document.getElementById('genbaCompleted')?.addEventListener('change',e=>{genbaShowCompleted=e.target.checked;renderGenba();});
    document.getElementById('genbaNew')?.addEventListener('click',genbaNew);
    document.getElementById('genbaMaster')?.addEventListener('click',genbaMaster);
    content.querySelectorAll('[data-genba-id]').forEach(b=>b.onclick=()=>genbaDetail(b.dataset.genbaId));
  }catch(error){if(genbaRouteActive())genbaError(error);}
}
function genbaNew() {
  const config=genbaSettings;
  modalBody.innerHTML='<h2 id="modalTitle">New genba finding</h2><form id="genbaForm" class="genba-form stacked-form"><div class="genba-fields"><label>Date<input name="finding_date" type="date" value="'+genbaDate+'" required></label><label>Section<select name="section" id="genbaSection" required>'+config.sections.map(s=>'<option>'+escapeHtml(s.name)+'</option>').join('')+'</select></label><label>PIC<select name="pic" id="genbaPic" required></select></label>'+genbaField('machine','Machine / Equipment')+'</div><p id="genbaAssignmentHint" class="field-hint"></p><label>Hazard identified<textarea name="hazard" maxlength="4000" rows="3" required></textarea></label><label>Before picture<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required><small>Phone photos are resized automatically.</small></label><img id="genbaPhotoPreview" class="genba-preview" hidden alt="Selected before picture"><div class="genba-fields">'+genbaField('type_of_stop','Type of stop',100)+genbaField('rank','Rank',100)+'<label>Status<select name="status">'+(genbaManager()?['Open','In progress','Resolved','Closed']:['Open','In progress']).map(s=>'<option>'+s+'</option>').join('')+'</select></label><label>Issue by<input value="'+escapeHtml(currentUser.display_name)+'" readonly></label></div><p class="field-hint">Use your existing stop and rank classifications. The signed-in account is recorded as the issuer.</p><label>Recommendation<textarea name="recommendation" maxlength="4000" rows="3" required></textarea></label><p class="form-error" data-genba-error hidden></p><div class="modal-actions"><button type="button" class="secondary-button" id="genbaCancel">Cancel</button><button class="primary-button" type="submit">Save finding</button></div></form>';
  modalBackdrop.hidden=false;
  const form=document.getElementById('genbaForm');
  const section=form.elements.section, pic=form.elements.pic;
  const pics=()=>{pic.innerHTML=config.sections.find(s=>s.name===section.value).pics.map(p=>'<option>'+escapeHtml(p)+'</option>').join('');};
  const assignmentHint=()=>{const linked=config.assignments.some(a=>a.section===section.value&&a.pic===pic.value);document.getElementById('genbaAssignmentHint').textContent=linked?'This finding will appear in the assigned PIC account.':'This PIC is not linked to a login account yet. Link their account in Manage sections & PICs so they can receive and act on this finding.';};
  section.onchange=()=>{pics();assignmentHint();};pic.onchange=assignmentHint;pics();assignmentHint();
  document.getElementById('genbaCancel').onclick=closeModal;
  let photo='', photoReady=Promise.resolve(), pending=null, photoSequence=0;
  form.elements.photo.onchange=()=>{
    const sequence=++photoSequence;photo='';const file=form.elements.photo.files[0];const preview=document.getElementById('genbaPhotoPreview');preview.hidden=true;
    photoReady=file?genbaReadPhoto(file).then(data=>{if(sequence===photoSequence){photo=data;preview.src=data;preview.hidden=false;}}):Promise.resolve();
    photoReady.catch(error=>genbaError(error,form));
  };
  form.onsubmit=async e=>{
    e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
    try {
      await photoReady;if(!photo)throw new Error('Add a before picture.');
      const draft=Object.fromEntries(new FormData(form));delete draft.photo;
      draft.photo=photo;draft.settings_revision=config.revision;
      const fingerprint=JSON.stringify(draft);
      if(!pending||pending.fingerprint!==fingerprint)pending={fingerprint,body:{...draft,request_key:crypto.randomUUID()}};
      const result=await api('/api/red-tags','POST',pending.body);
      genbaDate=result.finding.finding_date;closeModal();notify('Finding saved: '+result.finding.red_tag_id);await renderGenba();
    }catch(error){genbaError(error,form);}finally{button.disabled=false;}
  };
}
async function genbaDetail(id) {
  try {
    const route=currentRoute();const result=await api('/api/red-tags/'+id);if(!genbaRouteActive()||currentRoute()!==route)return;const r=result.finding;
    const simplePIC=genbaInbox()&&!genbaManager();
    const canUpdate=(genbaManager()||r.user_id===currentUser.id||r.assigned_user_id===currentUser.id)&&(!simplePIC||!['Resolved','Closed'].includes(r.status));
    modalBody.innerHTML='<h2 id="modalTitle">'+escapeHtml(r.red_tag_id)+'</h2><img class="genba-detail-photo" src="/api/red-tags/'+r.id+'/photo" alt="Before picture"><dl class="genba-details">'+[['Date',r.finding_date],['Section',r.section],['Machine / Equipment',r.machine],['PIC',r.pic],['Type of stop',r.type_of_stop],['Rank',r.rank],['Status',r.status],['Issue by',r.issued_by]].map(([k,v])=>'<dt>'+k+'</dt><dd>'+escapeHtml(v)+'</dd>').join('')+'</dl><h3>Hazard identified</h3><p class="genba-text">'+escapeHtml(r.hazard)+'</p><h3>Recommendation</h3><p class="genba-text">'+escapeHtml(r.recommendation)+'</p><h3>Action history</h3>'+result.updates.map(u=>'<div class="genba-update"><strong>'+escapeHtml(u.actor)+' · '+escapeHtml(u.status)+'</strong><small>'+escapeHtml(new Date(u.created_at*1000).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'}))+'</small><p class="genba-text">'+escapeHtml(u.note)+'</p>'+(u.has_after_photo?'<a href="/api/red-tags/'+r.id+'/updates/'+u.id+'/photo" target="_blank" rel="noopener"><img class="genba-detail-photo" src="/api/red-tags/'+r.id+'/updates/'+u.id+'/photo" alt="After picture"></a>':'')+'</div>').join('')+(!result.updates.length?'<p>No action updates yet.</p>':'')+(canUpdate?'<form id="genbaUpdate" class="stacked-form"><label>Status<select name="status">'+(genbaManager()?['Open','In progress','Action taken · awaiting review','Resolved','Closed']:['Open','In progress','Action taken · awaiting review']).map(s=>'<option '+(s===r.status?'selected':'')+'>'+s+'</option>').join('')+'</select></label><label>Action note<textarea name="note" maxlength="2000" rows="3" required></textarea></label><label>After picture<input name="after_photo" type="file" accept="image/jpeg,image/png,image/webp"><small>JPEG, PNG or WebP · up to 2 MB. Required when submitting an action for review.</small></label><p class="form-error" data-genba-error hidden></p><button type="submit" class="primary-button">Save action</button></form>':'')+'<div class="modal-actions"><button id="genbaPrinted" class="secondary-button">Confirm this finding printed</button><button id="genbaDetailClose" class="secondary-button">Close</button></div>';
    if(simplePIC){
      const details=modalBody.querySelector('.genba-details');const disclosure=document.createElement('details');disclosure.className='genba-more-details';disclosure.innerHTML='<summary>Finding details</summary>';details.replaceWith(disclosure);disclosure.append(details);
      const actionForm=modalBody.querySelector('#genbaUpdate');
      if(actionForm){
        actionForm.classList.add('genba-pic-action');
        actionForm.innerHTML='<div class="genba-action-intro"><strong>'+ (r.status==='Action taken · awaiting review'?'Sent to SHE for verification':'Ready to send your action?')+'</strong><p>Tell us what you fixed and add a clear after photo. SHE will verify the completed work.</p></div><input type="hidden" name="status" value="Action taken · awaiting review"><label>What did you do?<textarea name="note" maxlength="2000" rows="3" placeholder="For example: Replaced the damaged machine guard." required></textarea></label><fieldset class="genba-photo-picker"><legend>After photo</legend><label class="genba-photo-choice">Take a photo<input name="after_photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label><label class="genba-photo-choice">Choose from gallery<input name="after_gallery" type="file" accept="image/jpeg,image/png,image/webp"></label><small>Phone photos are resized automatically before sending.</small></fieldset><img class="genba-preview" data-after-preview hidden alt="Your after photo"><p class="form-error" data-genba-error hidden></p><button type="submit" class="primary-button">Send to SHE for verification</button><button type="submit" class="secondary-button" data-save-progress>Save progress for later</button>';
        actionForm.afterPhotoData='';actionForm.photoReady=Promise.resolve();let photoSequence=0;
        actionForm.draftKey='genba-action-draft:'+currentUser.id+':'+r.id;
        const saveDraft=()=>{try{localStorage.setItem(actionForm.draftKey,JSON.stringify({note:actionForm.elements.note.value,photo:actionForm.afterPhotoData}));}catch{ /* Keep the live composer usable when device storage is full. */ }};
        actionForm.elements.note.addEventListener('input',saveDraft);
        try{const draft=JSON.parse(localStorage.getItem(actionForm.draftKey)||'null');if(draft){actionForm.elements.note.value=draft.note||'';if(draft.photo){actionForm.afterPhotoData=draft.photo;const preview=actionForm.querySelector('[data-after-preview]');preview.src=draft.photo;preview.hidden=false;}}}catch{ /* Ignore an obsolete device draft. */ }
        actionForm.querySelectorAll('input[type=file]').forEach(input=>input.onchange=()=>{
          const sequence=++photoSequence;const file=input.files[0],preview=actionForm.querySelector('[data-after-preview]');
          actionForm.afterPhotoData='';preview.hidden=true;if(!file)return;
          actionForm.photoReady=genbaReadPhoto(file).then(data=>{if(sequence===photoSequence){actionForm.afterPhotoData=data;preview.src=data;preview.hidden=false;saveDraft();}});
          actionForm.photoReady.catch(error=>genbaError(error,actionForm));
        });
      }
      modalBody.querySelector('#genbaPrinted').remove();
    }
    modalBackdrop.hidden=false;
    document.getElementById('genbaDetailClose').onclick=closeModal;
    if(document.getElementById('genbaPrinted'))document.getElementById('genbaPrinted').onclick=async e=>{e.target.disabled=true;try{await api('/api/red-tags/printed','POST',{ids:[r.id]});notify('Printing confirmed.');await renderGenba();}catch(error){genbaError(error,modalBody);}finally{e.target.disabled=false;}};
    document.getElementById('genbaUpdate')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.target,button=e.submitter||form.querySelector('[type=submit]');if(form.dataset.sending)return;form.dataset.sending='1';const originalLabel=button.textContent;form.querySelectorAll('[type=submit]').forEach(b=>b.disabled=true);button.textContent='Sending…';
      try{const data=Object.fromEntries(new FormData(form));if(e.submitter?.hasAttribute('data-save-progress'))data.status='In progress';const file=form.elements.after_photo.files[0];delete data.after_photo;delete data.after_gallery;if(simplePIC){await form.photoReady;if(form.afterPhotoData)data.after_photo=form.afterPhotoData;}else if(file)data.after_photo=await genbaReadPhoto(file);if(data.status==='Action taken · awaiting review'&&!data.after_photo)throw new Error('Add an after photo to send your completed action to SHE.');await api('/api/red-tags/'+r.id,'PATCH',{...data,revision:r.revision});if(simplePIC){try{localStorage.removeItem(form.draftKey);}catch{}}notify(simplePIC?'Your action was saved.':'Action saved.');await genbaDetail(r.id);await renderGenba();}catch(error){genbaError(error,form);}finally{delete form.dataset.sending;form.querySelectorAll('[type=submit]').forEach(b=>b.disabled=false);button.textContent=originalLabel;}
    });
  }catch(error){genbaError(error);}
}
function genbaMaster() {
  modalBody.innerHTML='<h2 id="modalTitle">Sections &amp; PICs</h2><p>Add, rename, or remove sections and PICs. Separate PIC names with commas. Existing findings retain their original section and PIC.</p><form id="genbaMasterForm" class="stacked-form"><div id="genbaMasterRows"></div><h3>PIC login accounts</h3><p>Link each PIC to the account that receives the finding. Give that account PIC action access in User Management first.</p><div id="genbaAssignments"></div><button id="genbaAddSection" type="button" class="secondary-button">+ Add section</button><p class="form-error" data-genba-error hidden></p><div class="modal-actions"><button id="genbaMasterCancel" type="button" class="secondary-button">Cancel</button><button type="submit" class="primary-button">Save list</button></div></form>';
  modalBackdrop.hidden=false;
  const rows=document.getElementById('genbaMasterRows');
  const assigned=document.getElementById('genbaAssignments');
  const links=new Map(genbaSettings.assignments.map(a=>[JSON.stringify([a.section,a.pic]),a.user_id]));
  const rebuild=()=>{
    assigned.querySelectorAll('select').forEach(s=>links.set(s.dataset.pair,Number(s.value)||null));assigned.innerHTML='';
    [...rows.children].forEach(r=>{const section=r.querySelector('[data-section]').value.trim();r.querySelector('[data-pics]').value.split(',').map(p=>p.trim()).filter(Boolean).forEach(pic=>{const key=JSON.stringify([section,pic]);const label=document.createElement('label');label.className='genba-assignment';label.textContent=section+' · '+pic;const select=document.createElement('select');select.dataset.pair=key;select.innerHTML='<option value="">Not linked yet</option>'+(genbaSettings.accounts||[]).map(a=>'<option value="'+a.id+'" '+(links.get(key)===a.id?'selected':'')+'>'+escapeHtml(a.name)+' (@'+escapeHtml(a.username)+')</option>').join('');label.append(select);assigned.append(label);});});
  };
  const add=(s={name:'',pics:[]})=>{const row=document.createElement('div');row.className='genba-master-row';row.innerHTML='<label>Section<input data-section maxlength="100" value="'+escapeHtml(s.name)+'" required></label><label>PIC names<input data-pics value="'+escapeHtml(s.pics.join(', '))+'" required></label><button type="button" class="secondary-button">Remove</button>';row.querySelector('button').onclick=()=>{row.remove();rebuild();};row.querySelectorAll('input').forEach(input=>input.addEventListener('change',rebuild));rows.append(row);};
  genbaSettings.sections.forEach(add);rebuild();
  document.getElementById('genbaAddSection').onclick=()=>{add();rebuild();};document.getElementById('genbaMasterCancel').onclick=closeModal;
  document.getElementById('genbaMasterForm').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]');button.disabled=true;
    try{await api('/api/red-tags/settings','PATCH',{revision:genbaSettings.revision,assignments:[...assigned.querySelectorAll('select')].filter(s=>s.value).map(s=>({section:JSON.parse(s.dataset.pair)[0],pic:JSON.parse(s.dataset.pair)[1],user_id:Number(s.value)})),sections:[...rows.children].map(r=>({name:r.querySelector('[data-section]').value,pics:r.querySelector('[data-pics]').value.split(',').map(x=>x.trim()).filter(Boolean)}))});closeModal();notify('Section/PIC list saved.');await renderGenba();}catch(error){genbaError(error,form);}finally{button.disabled=false;}
  };
}

async function genbaReadPhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>30000000)throw new Error('Choose a JPEG, PNG or WebP photo up to 30 MB.');
  const original=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Unable to read photo. Please choose it again.'));reader.readAsDataURL(file);});
  const photo=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('This photo could not be opened. Try taking a new photo.'));img.src=original;});
  if(file.size<=2000000&&Math.max(photo.naturalWidth,photo.naturalHeight)<=1600)return original;
  const scale=Math.min(1,1600/Math.max(photo.naturalWidth,photo.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(photo.naturalWidth*scale));canvas.height=Math.max(1,Math.round(photo.naturalHeight*scale));
  const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(photo,0,0,canvas.width,canvas.height);
  for(const quality of [0.88,0.75,0.6]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=2666000)return result;}
  throw new Error('This photo is still too large. Try taking a closer photo.');
}

setInterval(()=>{if(genbaInbox()&&currentUser&&!document.hidden&&modalBackdrop.hidden)renderGenba(true);},15000);
