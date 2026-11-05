const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],issued=[];
  let role='executive',states={'red-tag':'none',patrol:'none',report:'none'};
  const finding={id:1,red_tag_id:'RT-202611-001',finding_date:'2026-11-05',section:'FG Store',pic:'Fareez',machine:'Packing line',hazard:'Damaged machine guard',recommendation:'Replace the guard',rank:'A',type_of_stop:'STOP 1',status:'Open',issued_by:'Inspector',revision:1,created_at:1793830000};
  const report={id:2,reference:'SHE-000002',created_at:1793830000,revision:1,status:'open',reporter:'John',contact:'Production',plant:'port-klang',location:'Waste storage',snapshot:{title:'Waste segregation issue',group:'environment',workflow:'she',questions:[{id:'finding',label:'What did you notice?'}]},answers:{finding:'Waste mixed in the wrong bin'},photos:[],updates:[]};
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(path==='/api/session')return json({user:{id:1,role,display_name:'Haffizol Rahman'},csrf_token:'test'});
   if(path==='/api/workspace/overview')return json({counts:{reports:6,genba:3,patrols:2},recent:[{title:'Waste segregation issue',detail:'Waste storage · John',kind:'Report',href:'#/reporting-inbox/2',created_at:1793830000},{title:'RT-202611-001',detail:'FG Store · Damaged machine guard',kind:'Genba',href:'#/red-tag/1',created_at:1793820000}]});
   const source=path.match(/^\/api\/finding-orders\/(red-tag|patrol)\/1(?:\/(issue|retry|link))?$/);
   if(source){
    const kind=source[1];
    if(source[2]){assert.equal(route.request().headers()['x-csrf-token'],'test');issued.push({kind,body:JSON.parse(route.request().postData())});await new Promise(r=>setTimeout(r,180));states[kind]='issued';}
    return json({order_state:states[kind],order_id:states[kind]==='issued'?'WO-'+kind:'',plant:'sendayan',order_photo_state:'synced'});
   }
   if(path==='/api/reporting/reports/2')return json({report:{...report,order_state:states.report,order_id:states.report==='issued'?'WO-waste':'',order_photo_state:'synced'}});
   if(path==='/api/reporting/reports/2/issue-order'){issued.push({kind:'waste'});states.report='issued';return json({order_state:'issued',order_id:'WO-waste'});}
   if(path==='/api/reporting/reports')return json({reports:[]});
   if(path==='/api/reporting/public')return json({forms:[],token:'test'});
   if(path==='/api/red-tags/settings')return json({sections:[{name:'FG Store',pics:['Fareez']}],assignments:[],accounts:[],revision:1});
   if(path==='/api/red-tags')return json({findings:[finding]});
   if(path==='/api/red-tags/1')return json({finding,updates:[],can_update:true});
   if(path==='/api/patrols/1')return json({patrol:{id:1,completed:1,inspector_name:'Inspector',submitted_by:'Inspector',created_at:1793830000,rating:2,remarks:'Guard broken near packing line',followup_status:'open',template:null,answers:{machine_1:'not_ok'},item_remarks:{},attachments:[],updates:[]}});
   if(path==='/api/patrols')return json({patrols:[]});
   if(path==='/api/patrol-templates')return json({templates:[],default_revision:1});
   if(path==='/api/reporting/notifications')return json({unread:6,latest_id:6,reports:[],push:{enabled:false}});
   if(path.startsWith('/api/'))return json({configured:false,forms:[],reports:[]});
   let file=path==='/'?'index.html':path.slice(1);if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  await page.goto('https://she.test/#/home');
  await page.locator('[data-overview-count=reports]').filter({hasText:'6'}).waitFor();
  if(await page.locator('#reportAlertPopup').count())await page.locator('#reportAlertPopup button').click();
  assert.equal(await page.locator('.exec-recent-row').count(),2);
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:844});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Executive home overflows at ${width}`);
   if(width!==320)await page.screenshot({path:`.qa-temp/executive-home-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('https://she.test/#/reporting-inbox/2');await page.locator('#issueOrder').waitFor();
  await page.locator('#issueOrder').click();await page.locator('a[href="#/work-orders/WO-waste/port-klang"]').waitFor();assert.equal(await page.locator('#issueOrder').count(),0);
  await page.goto('https://she.test/#/red-tag/1');await page.locator('[data-order-issue]').waitFor();
  await page.locator('[data-order-issue] select').selectOption('sendayan');
  await page.locator('[data-order-issue] button').click();
  await page.locator('[data-open-order]').waitFor();assert.equal(await page.locator('[data-order-issue]').count(),0);
  await page.locator('#modalClose').click();
  await page.goto('https://she.test/#/daily-safety-patrol/1');await page.locator('[data-order-issue]').waitFor();
  await page.locator('[data-order-issue] select').selectOption('sendayan');await page.locator('[data-order-issue] button').click();await page.locator('[data-open-order]').waitFor();
  const tab=page.locator('.module-tabs [aria-current]');
  assert.equal(await tab.evaluate(el=>getComputedStyle(el).borderRadius),'0px');
  assert.equal(await tab.evaluate(el=>getComputedStyle(el).borderBottomWidth),'3px');
  await page.goto('https://she.test/#/patrol-overview');await page.locator('.module-tabs').waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({path:'.qa-temp/executive-patrol-tabs.png'});
  assert.deepEqual(issued.map(r=>r.kind),['waste','red-tag','patrol']);
  role='user';await page.goto('https://she.test/#/daily-safety-patrol/1');await page.reload();await page.getByRole('heading',{name:'Original findings'}).waitFor();assert.equal(await page.locator('.finding-order-card').count(),0);
  await page.goto('https://she.test/#/home');assert.equal(await page.locator('.executive-home').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Executive workspace passed: mobile/desktop home, live overview, waste/Genba/patrol work orders, linked-state controls, underline tabs, regular-user restrictions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
