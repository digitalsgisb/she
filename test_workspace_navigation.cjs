const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const reports=[['hiyari-hatto','open'],['hiyari-hatto','closed'],['air-leak','open'],['air-leak','resolved']].map(([group,status],i)=>({id:i+1,group,status,reference:`SHE-${i+1}`,title:'Near miss',reporter:'Tester',plant:'port-klang',location:'FG Store',order_state:'none',created_at:1792500000}));
 await page.route('**/*',async route=>{
  const path=new URL(route.request().url()).pathname;
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(path==='/api/session')return json({user:{id:1,role:'admin',display_name:'SHE Admin'},csrf_token:'test'});
  if(path==='/api/reporting/reports')return json({reports});
  if(path==='/api/reporting/air-leak')return json({form:{id:1,revision:1},reports:reports.filter(r=>r.group==='air-leak'),token:'test'});
  if(path==='/api/red-tags/settings')return json({sections:[{name:'FG Store',pics:[]}],assignments:[]});
  if(path==='/api/reporting/public')return json({forms:[],token:'test'});
  if(path==='/api/patrol-templates')return json({templates:[{id:0,revision:1,is_default:true,...JSON.parse(fs.readFileSync('patrol-default.json','utf8'))}]});
  if(path.startsWith('/api/'))return json({patrols:[],findings:[],forms:[]});
  let file=path==='/'?'index.html':path.slice(1);if(/^(brand|icons)\//.test(file))file='public/'+file;
  if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
  return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png'})[file.split('.').pop()]||'text/plain'});
 });
 const go=async path=>{await page.goto('https://she.test/#/'+path);};
 await go('environmental');await page.locator('#content .module-card').first().waitFor();
 assert.deepEqual(await page.locator('#environmentSubnav a').allTextContents(),['Inbox','CO2','Kaizen','Reporting Form']);
 assert.deepEqual(await page.locator('#content .module-card strong').allTextContents(),['Inbox','CO2','Kaizen','Reporting Form']);
 await go('co2');await page.getByRole('heading',{name:'CO2',exact:true}).waitFor();assert(await page.getByText('Placeholder page',{exact:true}).isVisible());
 await go('safety');await page.locator('#content .module-card').first().waitFor();
 assert.deepEqual(await page.locator('#content .module-card strong').allTextContents(),['Safety Patrol','Red Tag','Air Leak','Hiyari Hatto']);
 await go('daily-safety-patrol');await page.locator('#patrolForm').waitFor();
 assert.deepEqual(await page.locator('.module-tabs a').allTextContents(),['Checklist','History','Checklist Builder']);
 await page.locator('.module-tabs a[href="#/patrol-overview"]').click();await page.getByRole('heading',{name:'Patrol History',exact:true}).waitFor();
 assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'History');
 await page.locator('.module-tabs a[href="#/checklist-builder"]').click();await page.locator('#checklistBuilder').waitFor();
 assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'Checklist Builder');
 for(const module of ['air-leak','hiyari-hatto','red-tag']) {
  await go(module);await page.locator('.module-tabs').waitFor();
  assert.deepEqual((await page.locator('.module-tabs a').allTextContents()).slice(0,3),['Checklist','Current Active','History']);
  await page.locator(`.module-tabs a[href="#/${module}?view=active"]`).click();
  await page.locator('.module-tabs [aria-current]').filter({hasText:'Current Active'}).waitFor();
  if(module==='air-leak') { assert(await page.locator('#airLeakForm').isHidden());assert.equal(await page.locator('.air-leak-history article').count(),1);assert((await page.locator('.air-leak-history').textContent()).includes('SHE-3')); }
  if(module==='hiyari-hatto') { assert.equal(await page.locator('#reportRows a').count(),1);assert((await page.locator('#reportRows').textContent()).includes('SHE-1'));await page.locator('#refreshReports').click();await page.locator('.module-tabs').waitFor(); }
  await page.locator(`.module-tabs a[href="#/${module}?view=history"]`).click();
  await page.locator('.module-tabs [aria-current]').filter({hasText:'History'}).waitFor();
  if(module==='air-leak')assert((await page.locator('.air-leak-history').textContent()).includes('SHE-4'));
  if(module==='hiyari-hatto')assert((await page.locator('#reportRows').textContent()).includes('SHE-2'));
  for(const width of [320,390,1280]) {await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${module} overflow at ${width}`);}
 }
 await page.setViewportSize({width:390,height:844});await go('air-leak?view=active');await page.locator('.air-leak-history article').waitFor();
 await page.evaluate(()=>closeMenu());
 fs.mkdirSync('.qa-temp',{recursive:true});await page.screenshot({path:'.qa-temp/safety-module-tabs-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Environment order, CO2 placeholder, patrol tabs, safety active/history filters, refresh and responsive layouts passed.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
