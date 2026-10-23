/* Durable unread counts, website pop-ups and opt-in phone alerts for SHE. */
const SHEReportAlerts = (() => {
  let timer, userId, generation=0, busy=false, latest=0, shown=0, config=null;
  const allowed = () => currentUser && ['admin','executive'].includes(currentUser.role);
  const controls = () => allowed() ? `<section class="report-alert-settings report-detail-card"><h2>New report alerts</h2><p>Website pop-ups appear while you are signed in. Enable phone notifications on each device to receive alerts when the website is closed.</p><div class="report-admin-links"><button type="button" class="secondary-button" data-report-push>Enable phone notifications</button><button type="button" class="secondary-button" data-report-push-off>Disable phone notifications</button><button type="button" class="secondary-button" data-report-read>Mark notifications as read</button></div><p class="field-hint">On iPhone: open in Safari, Share → Add to Home Screen, then enable notifications from the installed app.</p><p data-report-alert-status role="status"></p></section>` : '';
  function status(message) {
    document.querySelectorAll('[data-report-alert-status]').forEach(el=>el.textContent=message);
    notify(message);
  }
  function badge(count=0) {
    const button=document.getElementById('reportNotificationButton');
    if (!button) return;
    button.hidden=!allowed();
    button.textContent=count ? `Reports (${count})` : 'Reports';
    button.setAttribute('aria-label',`${count} unread SHE report notifications. Open inbox.`);
    button.onclick=()=>{location.hash='/reporting-inbox';};
  }
  function popup(result) {
    document.getElementById('reportAlertPopup')?.remove();
    const card=document.createElement('aside');
    card.id='reportAlertPopup'; card.className='report-alert-popup'; card.setAttribute('role','status');
    const title=document.createElement('strong');
    title.textContent=`${result.unread} unread Report${result.unread===1?'':'s'} to SHE`;
    const description=document.createElement('p');
    description.textContent=result.reports?.[0] ? `${result.reports[0].reference} · ${result.reports[0].title}` : 'New reports are waiting in the SHE inbox.';
    const open=document.createElement('a'); open.className='primary-button'; open.href='#/reporting-inbox'; open.textContent='Open inbox';
    open.onclick=()=>card.remove();
    const close=document.createElement('button'); close.type='button'; close.className='secondary-button'; close.textContent='Dismiss'; close.onclick=()=>card.remove();
    card.append(title,description,open,close); document.body.append(card);
  }
  async function poll() {
    if (!allowed() || busy || userId!==currentUser.id) return;
    const version=generation, account=userId;
    busy=true;
    try {
      const result=await api('/api/reporting/notifications');
      if (version!==generation || account!==currentUser?.id) return;
      if (!Number.isSafeInteger(result.latest_id) || !Number.isSafeInteger(result.unread)) return;
      latest=result.latest_id; config=result.push;
      badge(result.unread);
      if (result.unread && latest>shown) { shown=latest; popup(result); }
      if (!result.unread) document.getElementById('reportAlertPopup')?.remove();
    } catch { /* Keep the last count and retry; never mark reports read on failure. */ }
    finally { if(version===generation) busy=false; }
  }
  function stop() {
    generation++; clearInterval(timer); timer=null; userId=null; busy=false; config=null; latest=0; shown=0;
    document.getElementById('reportAlertPopup')?.remove();
    const button=document.getElementById('reportNotificationButton'); if(button)button.hidden=true;
  }
  function start() {
    stop(); if(!allowed())return;
    userId=currentUser.id; badge(); poll(); timer=setInterval(poll,20000);
  }
  async function markRead() {
    if(!allowed())return;
    const through=latest;
    await api('/api/reporting/notifications/read','POST',{through_id:through});
    document.getElementById('reportAlertPopup')?.remove(); await poll();
  }
  async function enable() {
    if(!window.isSecureContext || !('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) throw new Error('Phone notifications need HTTPS and a browser that supports Web Push. On iPhone, install SHE Digital on the Home Screen first.');
    if(!config?.enabled) throw new Error(config?.reason || 'Notification settings are loading. Please try again.');
    if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches && !navigator.standalone) throw new Error('Add SHE Digital to the Home Screen, open it there, and enable notifications.');
    const account=currentUser.id;
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Allow notifications in your browser settings to receive phone alerts.');
    const key=config.publicKey;
    const raw=atob((key+'='.repeat((4-key.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/'));
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const registration=await navigator.serviceWorker.register('/reporting-push/sw.js',{scope:'/reporting-push/'});
    if(!registration.active)await new Promise((resolve,reject)=>{
      const worker=registration.installing || registration.waiting;
      if(!worker)return reject(new Error('Notifications are preparing. Please try again.'));
      const timeout=setTimeout(()=>reject(new Error('Notifications are preparing. Please try again.')),15000);
      const changed=()=>{if(worker.state==='activated'){clearTimeout(timeout);resolve();}else if(worker.state==='redundant'){clearTimeout(timeout);reject(new Error('Could not prepare phone notifications.'));}};
      worker.addEventListener('statechange',changed); changed();
    });
    let subscription=await registration.pushManager.getSubscription();
    if(subscription?.options.applicationServerKey) {
      const old=new Uint8Array(subscription.options.applicationServerKey);
      if(old.length!==bytes.length || old.some((v,i)=>v!==bytes[i])) {await subscription.unsubscribe();subscription=null;}
    }
    subscription ||= await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    if(currentUser?.id!==account)throw new Error('Your account changed. Enable notifications again.');
    await api('/api/reporting/notifications/subscribe','POST',{subscription:subscription.toJSON()});
    status('Phone notifications enabled on this device for new SHE reports.');
  }
  async function disable() {
    if(!('serviceWorker' in navigator))throw new Error('This browser does not support phone notifications.');
    const registration=await navigator.serviceWorker.getRegistration('/reporting-push/');
    const subscription=await registration?.pushManager.getSubscription();
    if(subscription) {
      await api('/api/reporting/notifications/unsubscribe','POST',{endpoint:subscription.endpoint});
      await subscription.unsubscribe();
    }
    status('Phone notifications disabled on this device. Website alerts remain available.');
  }
  function bind(root) {
    for(const [selector,action] of [['[data-report-push]',enable],['[data-report-push-off]',disable],['[data-report-read]',markRead]]) {
      root.querySelectorAll(selector).forEach(button=>button.addEventListener('click',async()=>{
        button.disabled=true;try{await action();}catch(error){status(error.message);}finally{button.disabled=false;}
      }));
    }
    if(config && !config.enabled) root.querySelectorAll('[data-report-alert-status]').forEach(el=>el.textContent=config.reason);
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll();});
  return {start,stop,poll,controls,bind};
})();
