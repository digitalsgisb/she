const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let role='safety_committee',submissions=[],findings=[];
 const user=()=>({id:2,username:'member',display_name:'Committee Member',role,features:[]});
 await page.route('**/*',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/session')return json({user:user(),csrf_token:'csrf'});
  if(path==='/api/users')return json({users:[user()]});
  if(path==='/api/cmms/config')return json({configured:false,plants:[]});
  if(path==='/api/red-tags/settings')return json({revision:1,sections:[{name:'FG Store',pics:['Fareez']}],assignments:[]});
  if(path==='/api/red-tags'){
   if(req.method()==='POST'){const finding={...req.postDataJSON(),id:1,user_id:2,red_tag_id:'RT2610-001',issued_by:'Committee Member',revision:1};findings.push(finding);return json({finding});}
   return json({findings});
  }
  if(path==='/api/red-tags/1')return json({finding:findings[0],updates:[]});
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
 assert.equal(await page.locator('#nav a[href="#/patrol-overview"]').count(),1);
 await page.locator('#nav a[href="#/red-tag"]').click();await page.locator('#genbaNew').waitFor();
 assert.equal(await page.locator('a[href*="/api/red-tags/print"],a[href*="/api/red-tags/export"]').count(),0);
 await page.screenshot({path:'.qa-temp/committee-redtag-refined.png',fullPage:true,animations:'disabled'});
 await page.locator('#genbaNew').click();
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
 await next.click();await page.locator('#genbaForm [name=recommendation]').fill('Route hose away from the walkway.');await page.locator('#genbaForm [name=type_of_stop]').fill('Immediate stop');await page.locator('#genbaForm [name=rank]').fill('A');
 await page.locator('#genbaForm [type=submit]').click();await page.locator('[data-genba-id="1"]').waitFor();assert.equal(findings.length,1);assert.equal(findings[0].machine,'Packing line');assert.equal(findings[0].pic,'Fareez');assert(findings[0].photo.startsWith('data:image/'));
 await page.locator('[data-genba-filter="done"]').click();await page.getByRole('heading',{name:'Nothing in this view yet'}).waitFor();
 await page.locator('[data-genba-filter="todo"]').click();await page.locator('[data-genba-id="1"]').click();await page.locator('#genbaDetailClose').waitFor();assert.equal(await page.locator('#genbaPrinted').count(),0);await page.locator('#genbaDetailClose').click();
 await page.screenshot({path:'.qa-temp/committee-findings-refined.png',fullPage:true,animations:'disabled'});
 await page.locator('#mobileTabbar a[href="#/air-leak"]').click();
 await page.locator('#airLeakForm').waitFor();await page.locator('#airLeakForm [name=location]').fill('FG Store');await page.locator('#airLeakForm [name=machine]').fill('Packing line');await page.locator('#airLeakForm [name=description]').fill('Air escaping at hose fitting.');
 await page.screenshot({path:'.qa-temp/committee-air-leak-mobile.png',fullPage:true});
 await page.locator('#airLeakForm button').click();await page.getByRole('heading',{name:'Report saved',exact:true}).waitFor();
 assert.equal(submissions.length,1);assert.equal(submissions[0].answers.machine,'Packing line');
 assert(await page.getByRole('link',{name:'Open work order →',exact:true}).count());
 await page.goto('https://she.test/#/dashboard');await page.waitForURL('**/#/home');
 role='admin';await page.goto('https://she.test/#/home');await page.reload();await page.locator('.home-actions').waitFor();await page.goto('https://she.test/#/users');await page.locator('[data-create-user]').click();assert.equal(await page.locator('.feature-permissions').count(),0);
 assert.equal(await page.locator('#userRole option[value=safety_committee]').count(),1);
 assert.deepEqual(errors,[]);await browser.close();console.log('Committee mobile navigation, More, dashboard restriction, finding layout, feature removal and Air Leak submission passed.');
})().catch(error=>{console.error(error);process.exit(1)});
