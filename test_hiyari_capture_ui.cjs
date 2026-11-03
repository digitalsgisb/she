const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
const question=(id,label,type='text',options=[])=>({id,label,type,options,required:true});
const form={id:9,revision:1,title:'Hiyari Hatto',description:'FR-SH-12 · Bahagian A',group:'hiyari-hatto',icon:'alert',workflow:'she',questions:[
 question('employee_no','No. pekerja / Employee number'),question('shift','Shift','select',['A','B','N']),
 question('department','Jabatan / Department'),question('section','Bahagian / Section'),
 question('event_date','Tarikh / Date','date'),question('category','Category','select',['Near Miss','Observation']),
 question('operation','Operation','select',['Maintenance','Production']),question('experience','Experience','select',['1-3 years']),
 question('description','Masalah / Problem','textarea'),question('consequence','Hazard and consequence','textarea'),
 question('action','Proposed corrective action','textarea'),question('stop','STOP 6','select',['1','2']),
 {...question('sketch_before','Before sketch','textarea'),required:false},{...question('sketch_after','After sketch','textarea'),required:false},
 question('custom','Additional custom question')
]};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[],submissions=[];
  let nextStatus=502;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname;
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/api/session')return json({user:{id:1,role:'user',display_name:'Staff Member'},csrf_token:'test'});
   if(path==='/api/reporting/public')return json({forms:[form],token:'test-token'});
   if(path==='/api/reporting/reports')return json({reports:[]});
   if(path==='/api/reporting/submit'){
    submissions.push(JSON.parse(route.request().postData()));
    if(page.url().includes('/#/'))assert.equal(route.request().headers()['x-csrf-token'],'test');
    return nextStatus===201?json({reference:'SHE-000001',order_state:'none',order_id:null},201):json({error:'Test submission failure'},nextStatus);
   }
   if(path.startsWith('/api/'))return json({configured:false,forms:[],reports:[]});
   let file=path==='/'?'index.html':path==='/report'?'report.html':path.slice(1);
   if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  const verifySections=async()=>{
   await page.locator('#findingForm').waitFor();
   assert.deepEqual(await page.locator('#findingForm h2').allTextContents(),['Employee details','Event details','Finding & proposed action','Photos']);
   assert.equal(await page.locator('#answer-employee_no').evaluate(el=>el.closest('section').querySelector('h2').textContent),'Employee details');
   assert.equal(await page.locator('#answer-event_date').evaluate(el=>el.closest('section').querySelector('h2').textContent),'Event details');
   assert.equal(await page.locator('#answer-description').evaluate(el=>el.closest('section').querySelector('h2').textContent),'Finding & proposed action');
   assert.equal(await page.locator('#answer-custom').count(),1);
   assert.equal(await page.locator('#findingForm input,#findingForm textarea,#findingForm select').count(),form.questions.length+5);
   for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Page overflow at ${width}`);
    assert(await page.locator('#answer-event_date').evaluate(el=>{const field=el.getBoundingClientRect(),parent=el.closest('form').getBoundingClientRect();return field.right<=parent.right&&field.left>=parent.left;}),`Date overflow at ${width}`);
   }
   await page.setViewportSize({width:390,height:844});
  };
  const fill=async()=>{
   await page.locator('#reporter').fill('Staff Member');await page.locator('#plant').selectOption('port-klang');await page.locator('#location').fill('DTU Office');
   for(const q of form.questions){
    const el=page.locator('#answer-'+q.id);
    if(q.type==='select')await el.selectOption(q.options[0]);
    else await el.fill(q.type==='date'?'2026-11-02':q.id==='employee_no'?'5000928':'Example '+q.id);
   }
   await page.locator('#photos').setInputFiles({name:'finding.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1sAAAAASUVORK5CYII=','base64')});
  };
  await page.goto('https://she.test/#/hiyari-hatto');await verifySections();
  assert.equal(await page.locator('#reporter').inputValue(),'Staff Member');
  assert.equal(await page.locator('#content a[href^="/report"]').count(),0);
  assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'New report');
  await fill();
  const photo=(name,size=32)=>({name,mimeType:'image/png',buffer:Buffer.alloc(size)});
  await page.locator('#photos').setInputFiles([photo('second.png',3_000_000),photo('third.png')]);
  assert.equal(await page.locator('[data-remove-photo]').count(),3);
  await page.locator('#photos').setInputFiles(photo('fourth.png'));
  assert.equal(await page.locator('[data-remove-photo]').count(),3);
  assert((await page.locator('#reportError').textContent()).includes('up to 3'));
  await page.getByRole('button',{name:'Remove third.png',exact:true}).click();
  await page.locator('#photos').setInputFiles(photo('oversized.png',10_000_001));
  assert.equal(await page.locator('[data-remove-photo]').count(),2);
  assert((await page.locator('#reportError').textContent()).includes('10 MB'));
  await page.locator('#photos').setInputFiles(photo('third.png'));
  await page.locator('#findingForm [type=submit]').click();
  await page.locator('#reportError:not([hidden])').waitFor();assert(await page.locator('#answer-description').isDisabled());
  await page.locator('.module-tabs a[href="#/hiyari-hatto?view=active"]').click();await page.locator('#reportRows').waitFor();
  await page.locator('.module-tabs a[href="#/hiyari-hatto"]').click();await page.locator('#findingForm').waitFor();
  assert.equal(await page.locator('#answer-employee_no').inputValue(),'5000928');assert(await page.locator('#photos').isDisabled());
  nextStatus=201;await page.locator('#findingForm [type=submit]').click();await page.getByRole('heading',{name:'Report sent.',exact:true}).waitFor();
  assert.equal(page.url(),'https://she.test/#/hiyari-hatto');assert.deepEqual(submissions[0],submissions[1]);
  assert.deepEqual(submissions[0].photos.map(p=>p.name),['finding.png','second.png','third.png']);
  assert.equal(await page.locator('#content a[href="#/reporting-inbox/1"]').count(),1);
  await page.locator('#anotherHiyari').click();await page.locator('#findingForm').waitFor();
  nextStatus=400;await fill();await page.locator('#findingForm [type=submit]').click();await page.locator('#reportError:not([hidden])').waitFor();
  assert(await page.locator('#answer-description').isEnabled());
  await page.screenshot({path:'.qa-temp/hiyari-in-app-mobile.png',fullPage:true});
  nextStatus=201;await page.goto('https://she.test/report#/hiyari-hatto/9');await verifySections();
  await fill();
  await page.getByRole('button',{name:'Remove finding.png',exact:true}).click();
  assert(await page.locator('#photos').evaluate(el=>el.required));
  await page.locator('#photos').setInputFiles([photo('public-one.png'),photo('public-two.png')]);
  assert.equal(await page.locator('[data-remove-photo]').count(),2);
  await page.screenshot({path:'.qa-temp/hiyari-public-mobile.png',fullPage:true});
  await page.locator('#findingForm [type=submit]').click();await page.getByRole('heading',{name:'Report sent.',exact:true}).waitFor();
  assert.deepEqual(submissions.at(-1).photos.map(p=>p.name),['public-one.png','public-two.png']);
  assert.deepEqual(errors,[]);console.log('Hiyari capture passed: in-app entry, grouped fields, custom answers, mobile widths, durable retry, validation correction, public submission.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
