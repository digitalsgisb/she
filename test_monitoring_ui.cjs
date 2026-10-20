/* Run against an isolated local app with SHE_QA_URL and a disposable admin. */
const assert=require('assert'),fs=require('fs');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SHE_QA_BROWSER?{executablePath:process.env.SHE_QA_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.SHE_QA_URL||'http://127.0.0.1:3611';
  await page.goto(base);await page.locator('#loginUsername').fill('qa-admin');await page.locator('#loginPassword').fill('QaPassword123!');await page.locator('#loginForm button[type="submit"]').click();
  await page.getByRole('heading',{name:'SHE dashboards',exact:true}).waitFor();
  assert.equal(await page.locator('.compact-main-dashboard>.module-grid .module-card').count(),5);
  await page.goto(base+'/#/safety-dashboard');await page.getByRole('heading',{name:'Monthly register',exact:true}).waitFor();
  await page.locator('[data-dashboard-module]').selectOption('red-tag-dashboard');await page.locator('.she-chart-tabs').waitFor();
  await page.goto(base+'/#/dashboard');await page.getByRole('heading',{name:'SHE dashboards',exact:true}).waitFor();
  await page.locator('a.module-card[href="#/accident-dashboard"]').click();await page.locator('#monitorYear').fill('2026');await page.locator('#monitorYear').press('Tab');
  await page.getByRole('heading',{name:'Monthly register',exact:true}).waitFor();
  await page.locator('.monitor-month-chart [data-month="2026-03"]').click();
  for(const el of await page.locator('#monitorForm [data-count]').all())await el.fill('0');
  await page.locator('[data-count="Maintenance"]').fill('2');await page.locator('#manHours').fill('500000');await page.locator('#offJob').fill('1');
  await page.locator('#monitorForm button').click();await page.getByText('Last saved by QA Admin · revision 1').waitFor();
  assert((await page.locator('.report-stats').textContent()).includes('4'));
  await page.waitForFunction(()=>document.querySelector('.monitor-month-chart [data-month="2026-03"] rect')?.getBoundingClientRect().height>100);
  await page.locator('#monitorHistory summary').click();await page.locator('#monitorHistory .report-update').waitFor();
  await page.screenshot({path:'.qa-temp/monitor-accidents-desktop.png',fullPage:true});
  const dl=page.waitForEvent('download');await page.locator('#monitorExport').click();assert((await dl).suggestedFilename().includes('accident-2026'));
  await page.goto(base+'/#/compound-dashboard');await page.getByRole('heading',{name:'No. of compound',exact:true}).waitFor();await page.locator('#monitorForm').waitFor();
  await page.locator('#monitorCount0').fill('1');await page.locator('#monitorForm button').click();await page.getByText('Last saved by QA Admin · revision 1').waitFor();
  await page.locator('[data-dashboard-module]').selectOption('environmental-findings-dashboard');await page.getByRole('heading',{name:'No. of environmental findings',exact:true}).waitFor();await page.locator('#monitorCount0').waitFor();assert.equal(await page.locator('[data-count]').count(),4);
  await page.goto(base+'/#/hiyari-dashboard');await page.getByRole('heading',{name:'Hiyari Hatto Summary',exact:true}).waitFor();await page.locator('#hiyariRows').waitFor();
  await page.goto(base+'/report?area=hiyari-hatto');await page.locator('a.report-menu-topic').first().click();await page.locator('#findingForm').waitFor();
  await page.locator('#reporter').fill('QA Team member');await page.locator('#plant').selectOption('port-klang');await page.locator('#location').fill('Line 2');
  for(const key of ['employee_no','department','section','description','consequence','action'])await page.locator('#answer-'+key).fill(key==='section'?'Maintenance':'Test '+key);
  for(const [key,value] of Object.entries({shift:'A',category:'Near Miss',operation:'Production',experience:'1-3 years',stop:'5'}))await page.locator('#answer-'+key).selectOption(value);
  await page.locator('#answer-event_date').fill('2026-10-19');
  await page.screenshot({path:'.qa-temp/monitor-hiyari-form-desktop.png',fullPage:true});
  await page.locator('#findingForm button[type="submit"]').click();await page.getByText(/SHE-000001/).first().waitFor();
  await page.goto(base+'/#/reporting-inbox/1');await page.locator('#hiyariReviewForm').waitFor();
  await page.locator('#hh-rank').selectOption('A');await page.locator('#hh-status').selectOption('closed');await page.locator('#hiyariReviewForm button').click();await page.locator('#hiyariReviewError:not([hidden])').waitFor();
  for(const key of ['hos_name','hos_employee_no','resolution','pic','team_member','head_of_section','she_officer','manager'])await page.locator('#hh-'+key).fill('QA '+key);
  await page.locator('#hh-stop').selectOption('5');await page.locator('#hh-target_date').fill('2026-10-25');await page.locator('#hiyariReviewForm button').click();await page.locator('#hh-status').waitFor();await page.waitForFunction(()=>document.querySelector('#hh-status')?.value==='closed');
  await page.evaluate(()=>document.body.classList.add('hiyari-print'));await page.emulateMedia({media:'print'});assert(await page.locator('.hiyari-print-values').isVisible());assert(!(await page.locator('#hiyariReviewForm').isVisible()));await page.screenshot({path:'.qa-temp/monitor-hiyari-print.png',fullPage:true});await page.emulateMedia({media:'screen'});await page.evaluate(()=>document.body.classList.remove('hiyari-print'));
  await page.goto(base+'/#/hiyari-dashboard');await page.locator('[data-filter-field="rank"][data-filter-value="A"]').waitFor();await page.locator('[data-filter-field="rank"][data-filter-value="A"]').click();assert.equal(await page.locator('#hiyariRows .report-inbox-card').count(),1);
  await page.screenshot({path:'.qa-temp/monitor-hiyari-summary-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  for(const route of ['accident-dashboard','compound-dashboard','environmental-findings-dashboard','hiyari-dashboard']){
   await page.goto(base+'/#/'+route);await page.locator('#monitorBody .report-stats').waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow: '+route);
   await page.screenshot({path:'.qa-temp/monitor-'+route+'-phone.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);console.log('Five-dashboard UI checks passed (desktop and phone).');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
