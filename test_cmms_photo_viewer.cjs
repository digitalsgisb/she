const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},isMobile:true,hasTouch:true}),errors=[];
  const touch=await page.context().newCDPSession(page);
  let broken=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   if(path==='/api/session')return json({user:{id:1,role:'executive',display_name:'SHE Executive'},csrf_token:'test'});
   if(path==='/api/cmms/config')return json({configured:true,plants:['port-klang'],push:{enabled:false}});
   if(path==='/api/cmms/work-orders/wo-photo')return json({id:'wo-photo',number:'WO-SHE-001',title:'Water leakage',plantId:'port-klang',status:'open',priority:'medium',machineName:'Water tank',area:'Office',reportedByName:'John',issueDescription:'Water escaping from pipe',attachments:[{kind:'issue',url:'/uploads/work-orders/wo-photo/finding.jpg'}],activities:[]});
   if(path==='/api/cmms/work-orders')return json([]);
   if(path.startsWith('/api/cmms/media/'))return broken?route.fulfill({status:404,body:''}):route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#d5dfd1"/><rect x="250" y="200" width="700" height="750" rx="60" fill="#f6f6ef"/><path d="M600 950v650" stroke="#596b60" stroke-width="55"/><text x="600" y="600" text-anchor="middle" font-size="70">Water tank</text></svg>'});
   if(path==='/api/reporting/notifications')return json({unread:0,latest_id:0,reports:[],push:{enabled:false}});
   if(path.startsWith('/api/'))return json({configured:false,forms:[],reports:[]});
   let file=path==='/'?'index.html':path.slice(1);
   if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  await page.goto('https://she.test/#/work-orders/wo-photo/port-klang');
  assert((await page.locator('meta[name=viewport]').getAttribute('content')).includes('user-scalable=no'));
  assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).touchAction),'pan-x pan-y');
  const photo=page.locator('.cmms-photos a'),viewer=page.getByRole('dialog',{name:'Work order photo'});
  await photo.waitFor();
  const originalUrl=page.url();
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:800});
   if(width<900){
    assert.equal(await page.locator('#cmmsPhotoForm input').evaluate(el=>getComputedStyle(el).fontSize),'16px');
    await touch.send('Input.synthesizePinchGesture',{x:width/2,y:400,scaleFactor:1.8,relativeSpeed:800,gestureSourceType:'touch'});
    assert.equal(await page.evaluate(()=>visualViewport.scale),1);
   }
   await photo.click();await viewer.waitFor();
   await page.waitForFunction(()=>!document.querySelector('[data-zoom=in]').disabled);
   assert.equal(page.url(),originalUrl);assert.equal(page.context().pages().length,1);
   const fitWidth=await viewer.locator('img').evaluate(el=>el.getBoundingClientRect().width);
   await page.getByRole('button',{name:'Zoom in',exact:true}).click();
   assert.equal(await viewer.locator('output').textContent(),'150%');
   assert((await viewer.locator('img').evaluate(el=>el.getBoundingClientRect().width))>fitWidth);
   await viewer.locator('.cmms-viewer-stage').evaluate(el=>{el.scrollLeft=500;el.scrollTop=500;});
   const close=page.getByRole('button',{name:'Close photo'});
   assert(await close.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));
   await page.getByRole('button',{name:'Zoom out',exact:true}).click();
   assert.equal(await viewer.locator('output').textContent(),'100%');
   await page.getByRole('button',{name:'Zoom in',exact:true}).click();
   await page.getByRole('button',{name:'Fit',exact:true}).click();
   assert.equal(await viewer.locator('output').textContent(),'100%');
   assert(await page.getByRole('button',{name:'Zoom out',exact:true}).isDisabled());
   if(width===390)await page.screenshot({path:'.qa-temp/cmms-photo-viewer-mobile.png'});
   await close.click();await viewer.waitFor({state:'detached'});
   assert(await photo.evaluate(el=>document.activeElement===el));
   assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  }
  await photo.click();await viewer.waitFor();await page.keyboard.press('Escape');await viewer.waitFor({state:'detached'});
  await photo.click();await viewer.waitFor();await page.evaluate(()=>location.hash='/work-orders');await viewer.waitFor({state:'detached'});
  await page.goto(originalUrl);await photo.waitFor();broken=true;
  await photo.evaluate(el=>{el.href+='&failed=1';});
  await photo.click();await page.getByText('Could not load this photo. Close and try again.').waitFor();
  await page.getByRole('button',{name:'Close photo'}).click();await viewer.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('CMMS photo viewer passed: desktop/mobile, zoom, fit, close, Escape, focus return, route cleanup, failed-image exit, no new tabs.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
