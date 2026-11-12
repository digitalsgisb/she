const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  const template={id:0,is_default:true,revision:1,user_id:null,...JSON.parse(fs.readFileSync('../backend/patrol-default.json','utf8'))};
  let delayed=false,fail=false,requests=0,empty=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
   if(path==='/api/session')return json({user:{id:1,role:'executive',display_name:'SHE Executive'},csrf_token:'test'});
   if(path==='/api/patrols/summary')return json({scope:'team',date:'2026-11-05',counts:empty?{today:0,month:0,open:0,awaiting_review:0}:{today:3,month:24,open:4,awaiting_review:2},week:[0,2,4,1,3,2,3].map((count,i)=>({date:`2026-${i<1?'10-30':i<2?'10-31':'11-0'+(i-1)}`,count:empty?0:count})),recent:empty?[]:[{id:1,inspector:'Sara',created_at:1793840000,status:'action_taken',title:'Daily Safety Patrol',findings:2},{id:2,inspector:'Aman',created_at:1793830000,status:'open',title:'Daily Safety Patrol',findings:1}]});
   if(path==='/api/patrol-templates'){
    requests++;if(delayed)await new Promise(r=>setTimeout(r,300));
    return fail?json({error:'Test connection failure'},503):json({templates:[template]});
   }
   if(path==='/api/patrols')return json({patrols:[]});
   if(path==='/api/reporting/notifications')return json({unread:0,latest_id:0,reports:[],push:{enabled:false}});
   if(path.startsWith('/api/'))return json({configured:false,counts:{reports:0,genba:0,patrols:0},recent:[],forms:[],reports:[]});
   let file=path==='/'?'index.html':path.slice(1);if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  await page.goto('https://she.test/#/patrol-home');
  await page.locator('[data-patrol-count=today]').filter({hasText:'3'}).waitFor();
  assert.equal(await page.locator('[data-patrol-attention] tbody tr').count(),2);
  assert.equal(await page.locator('.patrol-week-day').count(),7);
  assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'Overview');
  await page.evaluate(()=>{window.savedPatrolTabs=document.querySelector('.module-tabs');window.savedMobileTabs=document.querySelector('.mobile-tabbar').firstElementChild;});
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Patrol home overflow at ${width}`);
   if(width===390||width===1280)await page.screenshot({path:`.qa-temp/patrol-home-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  delayed=true;await page.locator('.module-tabs a[href="#/daily-safety-patrol"]').click();
  assert(await page.evaluate(()=>window.savedPatrolTabs===document.querySelector('.module-tabs')));
  assert.equal(await page.locator('.module-tabs').evaluate(el=>getComputedStyle(el).opacity),'1');
  await page.locator('#patrolForm').waitFor();
  assert.equal(await page.locator('.page-heading>p').textContent(),'Check conditions, record findings and submit your patrol.');
  await page.locator('#patrolRemarks').fill('Keep my checklist draft');
  await page.locator('.module-tabs a[href="#/patrol-overview"]').click();await page.getByRole('heading',{name:'Patrol History',exact:true}).waitFor();
  assert(await page.evaluate(()=>window.savedPatrolTabs===document.querySelector('.module-tabs')&&window.savedMobileTabs===document.querySelector('.mobile-tabbar').firstElementChild));
  await page.locator('.module-tabs a[href="#/checklist-builder"]').click();await page.locator('#checklistBuilder').waitFor();
  assert(await page.evaluate(()=>window.savedPatrolTabs===document.querySelector('.module-tabs')));
  await page.locator('.module-tabs a[href="#/daily-safety-patrol"]').click();await page.locator('#patrolForm').waitFor();
  assert.equal(await page.locator('#patrolRemarks').inputValue(),'Keep my checklist draft');
  assert.equal(await page.locator('.patrol-module-shell').evaluate(el=>getComputedStyle(el).animationName),'none');
  // A failed request from the previous tab must not replace the current overview.
  fail=true;await page.locator('.module-tabs a[href="#/checklist-builder"]').click();
  await page.locator('.module-tabs a[href="#/patrol-home"]').click();
  await page.locator('[data-patrol-count=today]').filter({hasText:'3'}).waitFor();await page.waitForTimeout(400);
  assert.equal(await page.locator('#checklistBuilder').count(),0);assert.equal(await page.getByText('Test connection failure').count(),0);
  assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'Overview');
  empty=true;await page.locator('[data-patrol-home-refresh]').click();await page.getByText('No inspections yet.').waitFor();
  assert.equal(await page.locator('[data-patrol-count=today]').textContent(),'0');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.patrol-module-content').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert(requests>=3);assert.deepEqual(errors,[]);
  console.log('Patrol home passed: live overview, responsive layout, stable tab/mobile DOM, content-only fade, concise intro, draft recovery, rapid navigation, empty state, reduced motion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
