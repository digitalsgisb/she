const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],queries=[];
  let state='open',updates=[];
  const stamp=Date.parse('2026-11-04T10:00:00+08:00')/1000,photo='/api/patrols/1/attachments/'+'a'.repeat(32),afterPhoto='/api/patrols/1/attachments/'+'b'.repeat(32);
  const issue={key:'guard',label:'Machine guard secure?',remark:'Guard missing at packing line'};
  const template={id:1,title:'Packing line check',questions:[{id:'guard',label:'Machine guard secure?',type:'status',required:true,options:[]}]};
  const detail=()=>({id:1,completed:1,inspector_name:'Sara',submitted_by:'Sara',created_at:stamp,rating:2,remarks:'Packing line needs repair',template,answers:{guard:'not_ok'},item_remarks:{guard:issue.remark},issues:[issue],followup_status:state,updates,attachments:[{id:'a'.repeat(32),filename:'guard.png',mime_type:'image/png',size:100}]});
  const history=(id,when,status,findings,thumb='')=>({id,inspector_name:id===1?'Sara':'Aman',created_at:when,title:'Packing line check',counts:{not_ok:findings},followup_status:status,needs_attention:status!=='resolved'&&findings>0,update_count:id===1?updates.length:0,remarks:id===1?'Guard missing':'',attachments:[],thumbnail_url:thumb});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname,json=v=>route.fulfill({contentType:'application/json',body:JSON.stringify(v)});
   if(path==='/api/session')return json({user:{id:1,role:'executive',display_name:'SHE Executive'},csrf_token:'test'});
   if(path==='/api/patrols/summary')return json({scope:'team',date:'2026-11-05',counts:{today:1,month:3,open:state==='resolved'?0:1,awaiting_review:0},week:[],recent:[{id:1,inspector:'Sara',created_at:stamp,title:'Packing line check',findings:1,status:state,thumbnail_url:photo}],attention_total:state==='resolved'?0:1,attention:state==='resolved'?[]:[{id:1,inspector:'Sara',created_at:stamp,title:'Packing line check',findings:1,status:state,issues:[issue],thumbnail_url:photo,after_url:afterPhoto}]});
   if(path==='/api/patrols'){
    queries.push(url.searchParams);
    return json(url.searchParams.has('cursor')?{patrols:[history(3,stamp-86400,'resolved',1,photo)],next_cursor:null}:{patrols:[history(2,stamp+86400,'resolved',0),history(1,stamp,state,1,photo)],next_cursor:stamp+':1'});
   }
   if(path==='/api/patrols/1')return json({patrol:detail()});
   if(path==='/api/patrols/1/updates'){
    const body=JSON.parse(req.postData());assert.equal(body.expected_status,'open');assert.equal(body.status,'resolved');
    state=body.status;updates.push({id:1,user_id:1,author:'SHE Executive',role:'executive',created_at:stamp+86400,status:state,message:body.message,attachments:[]});return json({id:1});
   }
   if(path==='/api/finding-orders/patrol/1')return json({order_state:'none',order_id:''});
   if(path==='/api/reporting/reports')return json({reports:[6,7].map(id=>({id,reference:'SHE-00000'+id,title:'Water leakage',group:'environment',reporter:'John',location:'Canteen washroom',plant:'port-klang',status:'open',created_at:stamp,order_state:'issued',thumbnail_url:`/api/reporting/reports/${id}/photos/0`}))});
   if(path==='/api/reporting/reports/7/photos/0')return route.fulfill({status:404,body:''});
   if(path===photo||path===afterPhoto||path==='/api/reporting/reports/6/photos/0')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#bccdad"/><path d="M90 240V90h300v150" fill="none" stroke="#647c55" stroke-width="25"/><text x="240" y="185" text-anchor="middle" font-size="34" fill="#244b34">Issue photo</text></svg>'});
   if(path==='/api/reporting/notifications')return json({unread:0,latest_id:0,reports:[],push:{enabled:false}});
   if(path.startsWith('/api/'))return json({configured:false,forms:[],reports:[],counts:{reports:2,genba:0,patrols:1},recent:[]});
   let file=path==='/'?'index.html':path.slice(1);if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  await page.goto('https://she.test/#/reporting-inbox');
  const report=page.locator('#reportRows tr').filter({has:page.locator('a[href="#/reporting-inbox/6"]')});
  await report.locator('[data-evidence-before] img').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#reportRows [data-evidence-before] img')?.naturalWidth>0);
  const missing=page.locator('#reportRows tr').filter({has:page.locator('a[href="#/reporting-inbox/7"]')});
  await missing.locator('[data-evidence-before]').scrollIntoViewIfNeeded();
  assert.equal(await missing.locator('[data-evidence-before] a').getAttribute('href'),'/api/reporting/reports/7/photos/0');
  await page.goto('https://she.test/#/patrol-home');await page.locator('[data-patrol-attention] tbody tr').waitFor();
  assert((await page.locator('[data-patrol-attention] tbody tr').textContent()).includes('Yesterday'));
  assert((await page.locator('[data-patrol-attention] tbody tr').textContent()).includes('Guard missing at packing line'));
  assert.equal(await page.locator('[data-patrol-attention] tbody td:last-child img').getAttribute('src'),afterPhoto);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Attention overflow at ${width}`);if(width===390)await page.screenshot({path:'.qa-temp/patrol-needs-attention.png',fullPage:true});}
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-patrol-attention] tbody th a').click();await page.getByRole('heading',{name:'Follow up patrol #1',exact:true}).waitFor();
  await page.waitForFunction(()=>document.activeElement?.id==='patrolReplyMessage');
  assert((await page.locator('.patrol-followup-context').textContent()).includes('4 Nov 2026'));
  assert((await page.locator('.patrol-highlighted').textContent()).includes('Guard missing'));
  await page.locator('#patrolReplyMessage').fill('Guard repaired and verified against the original finding.');
  await page.locator('input[name=followup_status][value=resolved]').check();await page.locator('#patrolReplyForm button[type=submit]').click();
  await page.locator('#patrolFollowupStatus').filter({hasText:'Resolved'}).waitFor();
  await page.goto('https://she.test/#/patrol-home');await page.getByText('No findings need follow-up.',{exact:true}).waitFor();
  await page.goto('https://she.test/#/patrol-overview');await page.locator('#patrolPeriodFilter').waitFor();
  assert.equal(await page.locator('#patrolPeriodFilter').inputValue(),'all');
  assert.equal(await page.locator('.patrol-history-card-main').first().evaluate(el=>getComputedStyle(el).flexDirection),'row');
  assert.equal(await page.locator('.patrol-period-bar,[data-patrol-mode],[data-patrol-shift]').count(),0);
  assert(!queries.at(-1).has('start'));
  await page.locator('[data-patrol-older]').click();await page.locator('[data-patrol-older]').waitFor({state:'detached'});
  assert.equal(await page.locator('.patrol-report-record').count(),3);
  await page.locator('#patrolPeriodFilter').selectOption('week');await page.waitForFunction(()=>document.querySelector('#patrolDate'));
  assert(queries.at(-1).has('start'));assert(queries.at(-1).has('end'));
  await page.locator('#patrolPeriodFilter').selectOption('month');await page.locator('#patrolDate[type=month]').waitFor();
  await page.locator('#patrolDate').fill('2026-10');await page.waitForTimeout(150);
  assert(new Date(Number(queries.at(-1).get('start'))*1000).getMonth()===9);
  await page.screenshot({path:'.qa-temp/patrol-history-compact.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Patrol attention UI passed: side issue photos/fallbacks, yesterday follow-up, item context, resolution removal, all-history default, older pages, compact week/month filter.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
