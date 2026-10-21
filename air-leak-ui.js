/* A dedicated air leak report, backed by reporting's durable work-order workflow. */
let airLeakPending = null;
async function renderAirLeak() {
  content.innerHTML='<div class="page inner-page"><p role="status">Loading Air Leak…</p></div>';
  try {
    const data=await api('/api/reporting/air-leak');
    if(currentRoute()!=='air-leak')return;
    if(!data.form)throw new Error('The Air Leak form is unavailable. Contact SHE.');
    content.innerHTML=`<div class="page inner-page air-leak-page"><div class="page-heading"><span class="eyebrow dark-eyebrow">SHE / MAINTENANCE</span><h1>Air Leak</h1><p>Report a compressed air leak. A maintenance work order will be issued automatically.</p></div><section class="settings-card"><div id="airLeakComposer"><form id="airLeakForm" class="stacked-form"><label>Plant<select name="plant" required><option value="port-klang">Port Klang</option><option value="sendayan">Sendayan</option></select></label><label>Section / Location<input name="location" maxlength="100" placeholder="e.g. FG Store, packing line" required></label><label>Machine / Equipment<input name="machine" maxlength="100" placeholder="e.g. Air hose on packing machine" required></label><label>Leak details<textarea name="description" maxlength="2000" rows="4" placeholder="Describe where the air is escaping." required></textarea></label><label>Immediate action taken <small>(optional)</small><textarea name="action" maxlength="2000" rows="3"></textarea></label><label>Photo <small>(optional)</small><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><small>Take a photo or choose one from your phone.</small></label><p class="form-error" id="airLeakError" role="alert" hidden></p><button class="primary-button" type="submit">Submit &amp; issue work order</button></form></div></section><section class="air-leak-history"><h2>Recent air leak reports</h2>${data.reports.length?data.reports.map(r=>`<article class="air-leak-receipt"><strong>${escapeHtml(r.reference)}</strong><span>${escapeHtml(r.location)}</span><span>${escapeHtml(airLeakOrderLabel(r.order_state))}</span>${r.order_id?`<a href="#/work-orders/${encodeURIComponent(r.order_id)}/${r.plant}">Open work order →</a>`:''}</article>`).join(''):'<p>Your submitted reports will appear here.</p>'}</section></div>`;
    const form=document.getElementById('airLeakForm');
    if(airLeakPending?.userId!==currentUser.id)airLeakPending=null;
    if(airLeakPending){
      form.elements.plant.value=airLeakPending.payload.plant;
      form.elements.location.value=airLeakPending.payload.location;
      for(const key of ['machine','description','action'])form.elements[key].value=airLeakPending.payload.answers[key];
      form.querySelector('button').textContent='Retry same report';
      form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
    }
    form.onsubmit=async event=>{
      event.preventDefault();
      const button=form.querySelector('button'),error=document.getElementById('airLeakError');
      button.disabled=true;button.textContent='Submitting…';error.hidden=true;
      try{
        if(!airLeakPending){
          const values=Object.fromEntries(new FormData(form)),photos=[];
          if(form.elements.photo.files[0]){
            const photo=await genbaReadPhoto(form.elements.photo.files[0]);
            photos.push({name:'Air leak photo.jpg',mime:photo.slice(5,photo.indexOf(';')),content:photo.split(',')[1]});
          }
          airLeakPending={userId:currentUser.id,payload:{form_id:data.form.id,revision:data.form.revision,request_key:crypto.randomUUID(),token:data.token,plant:values.plant,location:values.location,reporter:currentUser.display_name,contact:'',answers:{machine:values.machine,description:values.description,action:values.action},photos}};
        }
        form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
        // Retain the exact request key and answers after a lost response.
        const result=await api('/api/reporting/submit','POST',{...airLeakPending.payload,token:data.token});
        const plant=airLeakPending.payload.plant;airLeakPending=null;
        document.getElementById('airLeakComposer').innerHTML=`<div role="status" class="air-leak-confirmation"><h2>Report saved</h2><p>Reference: <strong>${escapeHtml(result.reference)}</strong></p><p>${escapeHtml(airLeakOrderLabel(result.order_state))}</p>${result.order_id?`<a class="primary-button" href="#/work-orders/${encodeURIComponent(result.order_id)}/${plant}">Open work order →</a>`:'<p>SHE can check the saved report in the reporting inbox and follow up on the work order. Please keep this reference.</p>'}<button class="secondary-button" id="airLeakAnother">Report another leak</button></div>`;
        document.getElementById('airLeakAnother').onclick=renderAirLeak;
      }catch(e){error.textContent=e.message+(airLeakPending?' Retry to check the same report without submitting a duplicate.':'');error.hidden=false;button.disabled=false;button.textContent=airLeakPending?'Retry same report':'Submit & issue work order';}
    };
  }catch(error){if(currentRoute()==='air-leak')content.innerHTML=`<div class="page inner-page"><h1>Air Leak</h1><p role="alert">${escapeHtml(error.message)}</p><button class="secondary-button" id="airLeakReload">Try again</button></div>`;document.getElementById('airLeakReload')?.addEventListener('click',renderAirLeak);}
}
function airLeakOrderLabel(state){return {issued:'Maintenance work order issued.',pending:'Report saved. Work order pending.',sending:'Report saved. SHE needs to confirm the work order in CMMS.',uncertain:'Report saved. SHE needs to confirm the work order in CMMS.',failed:'Report saved. Work order could not be issued; SHE follow-up required.'}[state]||'Report saved for SHE follow-up.';}
