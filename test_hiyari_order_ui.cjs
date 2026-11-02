const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  let role='executive',state='none',requests=0;
  page.on('pageerror',error=>errors.push(error.message));
  const report=()=>({id:1,reference:'SHE-000001',created_at:1793600000,revision:1,status:'open',
   reporter:'Near miss reporter',contact:'Production',plant:'port-klang',location:'Line 2',
   snapshot:{title:'Hiyari Hatto',group:'hiyari-hatto',workflow:'she',questions:[{id:'finding',label:'What almost happened?'}]},
   answers:{finding:'Almost slipped near machine'},photos:[],updates:[],hiyari_review:{},
   order_state:state,order_id:state==='issued'?'WO-HH':null,order_error:state==='failed'?'CMMS unavailable':''});
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(path==='/api/session')return json({user:{id:1,role,display_name:'SHE Executive'},csrf_token:'test'});
   if(path==='/api/reporting/reports/1')return json({report:report()});
   if(path==='/api/reporting/reports/1/issue-order'){
    requests++;await new Promise(resolve=>setTimeout(resolve,250));state='issued';return json({reference:'SHE-000001',order_state:state,order_id:'WO-HH'});
   }
   if(path==='/api/reporting/notifications')return json({unread:0,latest_id:1,reports:[],push:{enabled:false}});
   if(path.startsWith('/api/'))return json({configured:false,forms:[],reports:[]});
   let file=path==='/'?'index.html':path.slice(1);
   if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  await page.goto('https://she.test/#/reporting-inbox/1');
  await page.locator('#issueOrder').waitFor();
  assert(await page.getByText('Almost slipped near machine',{exact:true}).isVisible());
  await page.locator('#issueOrder').click();
  assert(await page.locator('#issueOrder').isDisabled());
  await page.locator('a[href="#/work-orders/WO-HH/port-klang"]').waitFor();
  assert.equal(await page.locator('#issueOrder').count(),0);assert.equal(requests,1);
  for(const next of ['failed','uncertain']){
   state=next;await page.reload();
   await page.getByText('Original report',{exact:true}).waitFor();
   assert.equal(await page.locator('#issueOrder').count(),0);
   assert.equal(await page.locator(next==='failed'?'#retryOrder':'#linkOrder').count(),1);
  }
  state='none';role='user';await page.reload();
  await page.getByText('Original report',{exact:true}).waitFor();
  assert.equal(await page.locator('#issueOrder').count(),0);
  role='admin';await page.reload();await page.locator('#issueOrder').waitFor();
  assert.deepEqual(errors,[]);
  console.log('Hiyari work-order UI checks passed: executive/admin issuance, pending button, linked order, recovery, read-only user.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
