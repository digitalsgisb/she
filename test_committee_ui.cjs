const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let role='safety_committee',submissions=[],findings=[],signedIn=true,deleteRequests=[],failDelete=true;
 const user=()=>({id:role==='user'?3:2,username:'member',display_name:'Committee Member',role,features:[]});
 await page.route('**/*',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/session')return signedIn?json({user:user(),csrf_token:'csrf'}):route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Please sign in.'})});
  if(path==='/api/login'){signedIn=true;return json({user:user(),csrf_token:'csrf'});}
  if(path==='/api/users')return json({users:[user()]});
  if(path==='/api/cmms/config')return json({configured:false,plants:[]});
  if(path==='/api/red-tags/settings')return json({revision:1,sections:[{name:'FG Store',pics:['Fareez','Shahrul','Chandran']},{name:'Macro',pics:['Aman']}],assignments:[]});
  if(path==='/api/red-tags'){
   if(req.method()==='POST'){const finding={...req.postDataJSON(),id:1,user_id:2,red_tag_id:'RT2610-001',issued_by:'Committee Member',revision:1};findings.push(finding);return json({finding});}
   return json({findings});
  }
  if(path==='/api/red-tags/1'){
   if(req.method()==='DELETE'){deleteRequests.push(req.postDataJSON());if(failDelete){failDelete=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please try deletion again.'})});}findings=[];return json({ok:true});}
   return json({finding:findings[0],updates:[]});
  }
  if(path==='/api/reporting/air-leak')return json({form:{id:11,revision:1},token:'test',reports:[]});
  if(path==='/api/reporting/submit'){submissions.push(req.postDataJSON());return json({reference:'SHE-000001',order_state:'issued',order_id:'wo-1'});}
  if(path.startsWith('/api/'))return json({configured:false,plants:[],patrols:[],forms:[],findings:[]});
  let name=path==='/'?'index.html':path.slice(1);if(name.startsWith('brand/')||name.startsWith('icons/'))name='public/'+name;
  if(!fs.existsSync(name))return route.fulfill({status:404,body:''});
  const ext=name.split('.').pop();return route.fulfill({body:fs.readFileSync(name),contentType:({html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'})[ext]||'text/plain'});
 });
 await page.goto('https://she.test/#/home');await page.locator('.home-actions').waitFor();
 await page.screenshot({path:'.qa-temp/committee-home-refined.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(await page.locator('#mobileTabbar .mobile-tab span').allTextContents(),['Home','Red Tag','Air Leak','More']);
 assert.equal(await page.locator('#nav a[href*="dashboard"]').count(),0);
 await page.locator('#mobileMoreButton').click();await page.locator('.sidebar.mobile-open').waitFor();
 assert.equal(await page.locator('#safetySubnav').getAttribute('aria-hidden'),'true');
 assert.equal(await page.locator('#environmentSubnav').count(),1);
 assert.equal(await page.locator('#nav a[href="#/patrol-overview"]').count(),1);
 await page.locator('#safetyToggle').click();await page.locator('#nav a[href="#/red-tag"]').click();await page.locator('#genbaNew').waitFor();
 assert.equal(await page.locator('a[href*="/api/red-tags/print"],a[href*="/api/red-tags/export"]').count(),0);
 await page.screenshot({path:'.qa-temp/committee-redtag-refined.png',fullPage:true,animations:'disabled'});
 await page.locator('#genbaNew').click();
 await page.locator('#genbaSection').selectOption('Macro');assert.deepEqual(await page.locator('#genbaPic option').allTextContents(),['Aman']);
 await page.locator('#genbaSection').selectOption('FG Store');assert.deepEqual(await page.locator('#genbaPic option').allTextContents(),['Fareez','Shahrul','Chandran']);
 assert.equal(await page.locator('[name=type_of_stop] option').count(),7);assert.equal(await page.locator('[name=rank] option').count(),4);
 for(const width of [320,360,390,600]){
  await page.setViewportSize({width,height:844});
  const bounds=await page.locator('#genbaForm input,#genbaForm select,#genbaForm textarea').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};}));
  assert(bounds.every(b=>b.left>=0&&b.right<=width),`Form controls overflow at ${width}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.qa-temp/committee-finding-mobile.png',animations:'disabled'});
 const next=page.getByRole('button',{name:'Continue →',exact:true});
 await next.click();assert.equal(await page.locator('[data-step="0"]').isVisible(),true);
 await page.locator('#genbaForm [name=machine]').fill('Packing line');await next.click();
 await page.locator('[data-step="1"]').waitFor({state:'visible'});
 await page.locator('#genbaForm [name=hazard]').fill('Air hose across the walkway.');
 const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await page.locator('#genbaForm [name=photo]').setInputFiles({name:'hazard.png',mimeType:'image/png',buffer:photo});
 await page.locator('#genbaPhotoPreview').waitFor({state:'visible'});
 await page.screenshot({path:'.qa-temp/committee-finding-photo.png',animations:'disabled'});
 await next.click();await page.locator('[data-step="2"]').waitFor({state:'visible'});
 await page.getByRole('button',{name:'Back',exact:true}).click();
 assert.equal(await page.locator('#genbaForm [name=hazard]').inputValue(),'Air hose across the walkway.');assert.equal(await page.locator('#genbaPhotoPreview').isVisible(),true);
 await next.click();await page.locator('#genbaForm [name=recommendation]').fill('Route hose away from the walkway.');await page.locator('#genbaForm [name=type_of_stop]').selectOption('STOP 1');await page.locator('#genbaForm [name=rank]').selectOption('A');
 assert((await page.locator('[data-classification-hint="rank"]').textContent()).includes('permanent injury'));
 for(const width of [320,390,600]){await page.setViewportSize({width,height:844});assert(await page.locator('[data-step="2"] select,[data-step="2"] textarea').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=19&&r.right<=innerWidth-19;})));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.qa-temp/finding-classification-dropdowns.png',animations:'disabled'});
 await page.locator('#genbaForm [type=submit]').click();await page.locator('[data-genba-id="1"]').waitFor();assert.equal(findings.length,1);assert.equal(findings[0].machine,'Packing line');assert.equal(findings[0].pic,'Fareez');assert(findings[0].photo.startsWith('data:image/'));
 await page.locator('[data-genba-filter="done"]').click();await page.getByRole('heading',{name:'Nothing in this view yet'}).waitFor();
 await page.locator('[data-genba-filter="todo"]').click();await page.locator('[data-genba-id="1"]').click();await page.locator('#genbaDetailClose').waitFor();assert.equal(await page.locator('#genbaPrinted').count(),0);
 for(const width of [320,390,600]){
  await page.setViewportSize({width,height:844});
  const inside=await page.locator('#genbaUpdate input,#genbaUpdate select,#genbaUpdate textarea,#genbaUpdate button,#genbaDetailClose').evaluateAll(nodes=>nodes.every(node=>{const r=node.getBoundingClientRect();return r.left>=19&&r.right<=innerWidth-19;}));assert(inside,`Detail form is misaligned at ${width}px`);
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#genbaDetailClose').scrollIntoViewIfNeeded();await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:'.qa-temp/finding-detail-aligned.png',animations:'disabled'});await page.locator('#genbaDetailClose').click();
 await page.screenshot({path:'.qa-temp/committee-findings-refined.png',fullPage:true,animations:'disabled'});
 await page.locator('#mobileTabbar a[href="#/air-leak"]').click();
 await page.locator('#airLeakForm').waitFor();await page.locator('#airLeakForm [name=location]').selectOption({label:'FG Store'});await page.locator('#airLeakForm [name=machine]').fill('Packing line');await page.locator('#airLeakForm [name=description]').fill('Air escaping at hose fitting.');
 await page.screenshot({path:'.qa-temp/committee-air-leak-mobile.png',fullPage:true});
 await page.locator('#airLeakForm button').click();await page.getByRole('heading',{name:'Report saved',exact:true}).waitFor();
 assert.equal(submissions.length,1);assert.equal(submissions[0].answers.machine,'Packing line');
 assert(await page.getByRole('link',{name:'Open work order →',exact:true}).count());
 await page.goto('https://she.test/#/dashboard');await page.waitForURL('**/#/home');
 role='admin';await page.goto('https://she.test/#/home');await page.reload();await page.locator('.home-actions').waitFor();await page.goto('https://she.test/#/users');await page.locator('[data-create-user]').click();assert.equal(await page.locator('.feature-permissions').count(),0);
 assert.equal(await page.locator('#nav .nav-parent a[href="#/dashboard"]').count(),1);
 assert.equal(await page.locator('#userRole option[value=safety_committee]').count(),1);
 await page.locator('#cancelModal').click();await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'.qa-temp/sidebar-restored-desktop.png',animations:'disabled'});
 await page.goto('https://she.test/');await page.locator('.compact-main-dashboard').waitFor();
 assert.equal(await page.locator('#nav .nav-parent a[href="#/dashboard"].active').count(),1);
 role='user';signedIn=false;await page.goto('https://she.test/#/red-tag/1');await page.reload();await page.locator('#loginScreen').waitFor({state:'visible'});
 await page.locator('#loginUsername').fill('member');await page.locator('#loginPassword').fill('TestingPassword123!');await page.locator('#loginForm button[type=submit]').click();await page.locator('.genba-details').waitFor();
 assert.equal(new URL(page.url()).hash,'#/red-tag/1');assert.equal(await page.locator('#modalTitle').textContent(),'RT2610-001');
 assert.equal(await page.locator('#genbaDelete').count(),0);
 role='executive';await page.reload();await page.locator('#genbaDelete').waitFor();
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('#genbaDelete').click();assert.equal(deleteRequests.length,0);
 page.once('dialog',dialog=>{assert(dialog.message().includes('RT2610-001'));dialog.accept();});await page.locator('#genbaDelete').click();await page.getByText('Please try deletion again.',{exact:true}).waitFor();assert(await page.locator('#genbaDelete').isEnabled());
 page.once('dialog',dialog=>dialog.accept());await page.locator('#genbaDelete').click();await page.waitForURL('**/#/red-tag');await page.locator('#genbaNew').waitFor();
 assert.equal(deleteRequests.length,2);assert.equal(deleteRequests[1].revision,1);assert.equal(await page.locator('[data-genba-id="1"]').count(),0);assert(await page.locator('#modalBackdrop').isHidden());
 assert.deepEqual(errors,[]);await browser.close();console.log('Committee mobile navigation, More, dashboard restriction, finding layout, feature removal and Air Leak submission passed.');
})().catch(error=>{console.error(error);process.exit(1)});
