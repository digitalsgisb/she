const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let role='safety_committee',submissions=[];
 const user=()=>({id:2,username:'member',display_name:'Committee Member',role,features:[]});
 await page.route('**/*',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/session')return json({user:user(),csrf_token:'csrf'});
  if(path==='/api/users')return json({users:[user()]});
  if(path==='/api/cmms/config')return json({configured:false,plants:[]});
  if(path==='/api/red-tags/settings')return json({revision:1,sections:[{name:'FG Store',pics:['Fareez']}],assignments:[]});
  if(path==='/api/red-tags')return json({findings:[]});
  if(path==='/api/reporting/air-leak')return json({form:{id:11,revision:1},token:'test',reports:[]});
  if(path==='/api/reporting/submit'){submissions.push(req.postDataJSON());return json({reference:'SHE-000001',order_state:'issued',order_id:'wo-1'});}
  if(path.startsWith('/api/'))return json({configured:false,plants:[],patrols:[],forms:[],findings:[]});
  let name=path==='/'?'index.html':path.slice(1);if(name.startsWith('brand/')||name.startsWith('icons/'))name='public/'+name;
  if(!fs.existsSync(name))return route.fulfill({status:404,body:''});
  const ext=name.split('.').pop();return route.fulfill({body:fs.readFileSync(name),contentType:({html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',webmanifest:'application/manifest+json'})[ext]||'text/plain'});
 });
 await page.goto('https://she.test/#/home');await page.locator('.home-actions').waitFor();
 assert.deepEqual(await page.locator('#mobileTabbar .mobile-tab span').allTextContents(),['Home','Red Tag','Air Leak','More']);
 assert.equal(await page.locator('#nav a[href*="dashboard"]').count(),0);
 await page.locator('#mobileMoreButton').click();await page.locator('.sidebar.mobile-open').waitFor();
 assert.equal(await page.locator('#nav a[href="#/patrol-overview"]').count(),1);
 await page.locator('#nav a[href="#/red-tag"]').click();await page.locator('#genbaNew').click();
 for(const width of [360,390,600]){
  await page.setViewportSize({width,height:844});
  const bounds=await page.locator('#genbaForm input,#genbaForm select,#genbaForm textarea').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};}));
  assert(bounds.every(b=>b.left>=0&&b.right<=width),`Form controls overflow at ${width}px`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.qa-temp/committee-finding-mobile.png',animations:'disabled'});
 await page.locator('#genbaForm [type=submit]').scrollIntoViewIfNeeded();assert.equal(await page.locator('#genbaForm [type=submit]').isVisible(),true);
 await page.locator('#modalClose').click();await page.locator('#mobileTabbar a[href="#/air-leak"]').click();
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
