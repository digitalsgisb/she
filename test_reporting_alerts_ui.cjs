const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  let unread=0,latest=0,role='executive',subscribed=0,notificationReads=0;
  const qr=fs.existsSync('.qa-temp/reporting-qr.json')?JSON.parse(fs.readFileSync('.qa-temp/reporting-qr.json','utf8')):{url:'https://she.test/report',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'};
  const publicKey=Buffer.concat([Buffer.from([4]),Buffer.alloc(64,1)]).toString('base64url');
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.pushRegistrations=[];window.permissionRequests=0;
   const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test',options:{},toJSON(){return {endpoint:this.endpoint,keys:{}};},async unsubscribe(){return true;}};
   const registration={active:{},pushManager:{getSubscription:async()=>null,subscribe:async()=>subscription}};
   Object.defineProperty(navigator,'serviceWorker',{value:{register:async(url,options)=>{window.pushRegistrations.push([url,options?.scope]);return registration;},getRegistration:async()=>registration}});
   window.PushManager=function(){};
   window.Notification={permission:'granted',requestPermission:async()=>{window.permissionRequests++;return 'granted';}};
  });
  await page.route('**/*',route=>{
   const path=new URL(route.request().url()).pathname;
   const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(path==='/api/session')return json({user:{id:1,role,display_name:'SHE Executive'},csrf_token:'test'});
   if(path==='/api/reporting/qr')return json(qr);
   if(path==='/api/reporting/notifications'){notificationReads++;return json({unread,latest_id:latest,reports:unread?[{id:latest,reference:`SHE-${String(latest).padStart(6,'0')}`,title:'Water leakage'}]:[],push:{enabled:true,publicKey}});}
   if(path==='/api/reporting/notifications/read'){unread=latest-JSON.parse(route.request().postData()).through_id;return json({ok:true});}
   if(path==='/api/reporting/notifications/subscribe'){subscribed++;return json({ok:true});}
   if(path==='/api/reporting/notifications/unsubscribe')return json({ok:true});
   if(path==='/api/reporting/reports')return json({reports:[]});
   if(path==='/api/reporting/public')return json({forms:[{id:1,revision:1,title:'Water leakage',description:'',group:'environment',workflow:'kaizen',icon:'water',questions:[]},{id:9,revision:1,title:'Hiyari Hatto',description:'',group:'hiyari-hatto',workflow:'she',icon:'alert',questions:[]}],token:'test'});
   if(path.startsWith('/api/'))return json({configured:false,forms:[],reports:[]});
   let file=path==='/'?'index.html':path==='/report'?'report.html':path.slice(1);
   if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  await page.goto('https://she.test/#/environmental');
  await page.locator('#environmentReportingQr img').waitFor();
  assert(await page.locator('#environmentSubnav a[href="#/reporting-qr"]').isVisible());
  assert(await page.locator('[data-report-push]').isVisible());
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Environment overflow at ${width}`);}
  await page.locator('#environmentReportingQr a[href="#/reporting-qr"]').click();
  await page.locator('#reportPublicQr').waitFor();
  assert.equal(await page.locator('#downloadReportQr').getAttribute('download'),'report-to-she-qr.svg');
  assert((await page.locator('#reportPublicQr').getAttribute('src')).startsWith('data:image/svg+xml'));
  await page.locator('[data-report-push]').click();
  await page.getByText('Phone notifications enabled on this device for new SHE reports.',{exact:true}).first().waitFor();
  assert.equal(subscribed,1);assert.equal(await page.evaluate(()=>permissionRequests),1);
  assert((await page.evaluate(()=>pushRegistrations)).some(([url,scope])=>url==='/reporting-push/sw.js'&&scope==='/reporting-push/'));
  unread=2;latest=2;await page.evaluate(()=>SHEReportAlerts.poll());
  await page.locator('#reportAlertPopup').waitFor();
  assert((await page.locator('#reportNotificationButton').textContent()).includes('(2)'));
  await page.locator('#reportAlertPopup button').click();await page.evaluate(()=>SHEReportAlerts.poll());
  assert.equal(await page.locator('#reportAlertPopup').count(),0);
  unread=3;latest=3;await page.evaluate(()=>SHEReportAlerts.poll());
  await page.locator('#reportAlertPopup').waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>closeMenu());
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  await page.screenshot({path:'.qa-temp/report-to-she-qr-mobile.png',fullPage:true});
  await page.locator('[data-report-read]').click();await page.locator('#reportAlertPopup').waitFor({state:'detached'});
  assert.equal(unread,0);
  await page.screenshot({path:'.qa-temp/report-to-she-qr-preview.png',fullPage:true});
  role='user';const reads=notificationReads;
  await page.reload();await page.locator('#reportPublicQr').waitFor();
  assert.equal(await page.locator('[data-report-push]').count(),0);
  assert(await page.locator('#reportNotificationButton').isHidden());assert.equal(notificationReads,reads);
  for(const route of ['environment/1','hiyari-hatto/9']) {
   await page.goto('https://she.test/report#/'+route);await page.locator('#findingForm').waitFor();
   assert(await page.locator('#photos').evaluate(el=>el.required));
   await page.locator('#reporter').fill('Reporter');await page.locator('#plant').selectOption('port-klang');await page.locator('#location').fill('FG Store');
   assert.equal(await page.locator('#findingForm').evaluate(el=>el.checkValidity()),false);
  }
  assert.deepEqual(errors,[]);
  console.log('QR pages, responsive layouts, executive pop-ups, unread badge, phone opt-in and photo requirements passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
