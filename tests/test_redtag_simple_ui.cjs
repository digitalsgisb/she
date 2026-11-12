const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  let role='executive',saved=0;
  const errors=[],settings={revision:1,sections:[{name:'FG Store',pics:['Fareez']}],assignments:[{section:'FG Store',pic:'Fareez',user_id:1}],accounts:[{id:1,name:'Fareez',username:'fareez'}]};
  const records=[{id:1,red_tag_id:'RT-001',section:'FG Store',machine:'Packing line',pic:'Fareez',hazard:'Damaged guard',recommendation:'Replace guard',rank:'A',type_of_stop:'STOP 1',status:'Open',issued_by:'Sara',finding_date:'2026-11-05',created_at:1793850000,assigned_user_id:1},{id:2,red_tag_id:'RT-002',section:'FG Store',machine:'Pump',pic:'Fareez',hazard:'Old leak',rank:'C',status:'Closed',issued_by:'Aman',created_at:1793840000}];
  const wire=async page=>{
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.appTimers=[];const original=window.setInterval;window.setInterval=(fn,ms,...args)=>{window.appTimers.push({fn,ms});return original(fn,ms,...args);};});
   await page.route('**/*',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname,json=v=>route.fulfill({contentType:'application/json',body:JSON.stringify(v)});
    if(path==='/api/session')return json({user:{id:1,role,display_name:'SHE Executive'},csrf_token:'test'});
    if(path==='/api/workspace/modules/red-tag')return json({counts:{active:records.filter(r=>!['Closed','Resolved'].includes(r.status)).length,today:1,history:1},recent:[],active:records.filter(r=>!['Closed','Resolved'].includes(r.status))});
    if(path==='/api/red-tags/settings'){
     if(request.method()==='PATCH'){assert.equal(request.headers()['x-csrf-token'],'test');saved++;settings.revision++;return json({ok:true});}
     return json(settings);
    }
    if(path==='/api/red-tags'){
     const query=new URL(request.url()).searchParams;
     return json({findings:query.get('inbox')==='1'?records.filter(r=>r.assigned_user_id===1):records.filter(r=>query.get('view')==='history'?['Closed','Resolved'].includes(r.status):!['Closed','Resolved'].includes(r.status))});
    }
    if(path==='/api/red-tags/1')return json({finding:records[0],updates:[]});
    if(path.endsWith('/photo'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350"><rect width="600" height="350" fill="#e0e7d6"/><rect x="110" y="50" width="380" height="250" rx="20" fill="#aec497"/><text x="300" y="190" text-anchor="middle" fill="#345839" font-size="35">Packing line</text></svg>'});
    if(path==='/api/reporting/notifications')return json({unread:0,latest_id:0,reports:[],push:{enabled:false}});
    if(path.startsWith('/api/'))return json({configured:false,counts:{reports:0,genba:0,patrols:0},recent:[],forms:[],reports:[]});
    let file=path==='/'?'index.html':path.slice(1);if(/^(brand|icons)\//.test(file))file='public/'+file;
    if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
   });
  };
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await wire(mobile);
  await mobile.goto('https://she.test/#/red-tag-home');await mobile.locator('[data-genba-id="1"]').waitFor();
  assert.deepEqual(await mobile.locator('.module-tabs a').allTextContents(),['Overview','Findings','History','Assigned to me']);
  assert.equal(await mobile.locator('[data-redtag-print],[data-redtag-export],[data-redtag-manage]').count(),0);
  assert.equal(await mobile.getByRole('button',{name:/refresh/i}).count(),0);
  assert.equal(await mobile.locator('.module-tabs a[href*="view=active"]').count(),0);
  records[0].machine='Updated packing line';
  await mobile.evaluate(()=>window.appTimers.filter(t=>t.ms===15000).forEach(t=>t.fn()));
  await mobile.getByText('Updated packing line · PIC Fareez',{exact:true}).waitFor();
  await mobile.locator('[data-genba-id="1"]').click();await mobile.locator('#genbaDetailClose').waitFor();await mobile.locator('#genbaDetailClose').click();
  await mobile.screenshot({path:'.qa-temp/red-tag-simple-mobile.png',fullPage:true});
  await mobile.locator('.module-tabs a[href="#/red-tag?view=history"]').click();await mobile.getByRole('heading',{name:'Red Tag history',exact:true}).waitFor();
  assert.equal(await mobile.locator('[data-genba-id="1"]').count(),0);assert.equal(await mobile.locator('[data-genba-id="2"]').count(),1);
  assert.equal(await mobile.locator('.genba-toolbar,#genbaRefresh,#genbaMaster,#genbaNew').count(),0);
  records[1].machine='Updated history pump';
  await mobile.evaluate(()=>window.appTimers.filter(t=>t.ms===15000).forEach(t=>t.fn()));
  await mobile.getByText('Updated history pump · PIC Fareez',{exact:true}).waitFor();
  await mobile.locator('.module-tabs a[href="#/red-tag-pic"]').click();await mobile.getByText('Cases assigned to you as PIC.',{exact:true}).waitFor();
  assert.equal(await mobile.locator('[data-genba-id="1"]').count(),1);
  await mobile.locator('.module-tabs a[href="#/red-tag?new=1"]').click();await mobile.locator('#genbaForm').waitFor();
  await mobile.locator('#genbaCancel').click();await mobile.waitForURL('**/#/red-tag-home');await mobile.locator('[data-genba-id="1"]').waitFor();
  await mobile.goto('https://she.test/#/red-tag-dashboard');await mobile.waitForURL('**/#/home');
  const desktop=await browser.newPage({viewport:{width:1280,height:900}});await wire(desktop);
  await desktop.goto('https://she.test/#/red-tag-home');await desktop.locator('[data-redtag-manage]').waitFor();
  assert(await desktop.locator('[data-redtag-desktop]').isVisible());
  assert(await desktop.locator('[data-redtag-desktop]').evaluate(el=>el.getBoundingClientRect().top>document.querySelector('.red-tag-active').getBoundingClientRect().bottom));
  await desktop.locator('[data-redtag-tool-date]').fill('2026-11-03');
  assert((await desktop.locator('[data-redtag-print]').getAttribute('href')).includes('2026-11-03'));
  assert((await desktop.locator('[data-redtag-export]').getAttribute('href')).includes('2026-11-03'));
  await desktop.locator('[data-redtag-manage]').click();await desktop.locator('#genbaMasterForm').waitFor();
  await desktop.getByRole('button',{name:'Save list',exact:true}).click();await desktop.locator('#genbaMasterForm').waitFor({state:'detached'});assert.equal(saved,1);
  assert(await desktop.locator('.finding-module-home').isVisible());
  await desktop.evaluate(()=>scrollTo(0,0));await desktop.waitForTimeout(200);
  await desktop.screenshot({path:'.qa-temp/red-tag-simple-desktop.png',fullPage:true});
  await desktop.locator('[data-redtag-manage]').click();await desktop.locator('#genbaMasterForm').waitFor();
  await desktop.setViewportSize({width:390,height:844});await desktop.locator('#genbaMasterForm').waitFor({state:'detached'});
  assert.equal(await desktop.locator('[data-redtag-manage]').count(),0);
  role='user';await desktop.setViewportSize({width:1280,height:900});await desktop.reload();await desktop.locator('[data-redtag-print]').waitFor();
  assert.equal(await desktop.locator('[data-redtag-manage], [data-redtag-desktop] a[href="#/red-tag-dashboard"]').count(),0);
  await desktop.locator('#headerProfile summary').click();
  assert(await desktop.locator('#headerMyProfile').isVisible());
  await desktop.keyboard.press('Escape');assert.equal(await desktop.locator('#headerProfile').getAttribute('open'),null);
  await desktop.locator('#headerProfile summary').click();await desktop.locator('#headerMyProfile').click();
  await desktop.locator('#passwordForm').waitFor();assert.equal(await desktop.locator('#headerProfile').getAttribute('open'),null);
  assert(await desktop.locator('.header-app-icon img').isVisible());
  await desktop.setViewportSize({width:320,height:844});
  assert(await desktop.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await desktop.locator('#headerProfile summary').click();await desktop.locator('#signOutButton').click();await desktop.locator('#loginScreen').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  console.log('Simple Red Tag passed: active home, form-only Findings, assigned-case wording, automatic updates, no refresh, desktop tools, dates, role guards, resize closure.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
