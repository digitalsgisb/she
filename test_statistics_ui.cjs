const fs=require('fs'),assert=require('assert'),cp=require('child_process');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
fs.mkdirSync('.qa-temp',{recursive:true});
const fixture=JSON.parse(cp.execFileSync(process.env.SHE_QA_PYTHON||'python',['-c',fs.readFileSync('test_statistics_fixture.py','utf8')],{encoding:'utf8'}));
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.SHE_QA_BROWSER?{executablePath:process.env.SHE_QA_BROWSER}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 let role='executive',empty=false,dense=false;
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url()),p=url.pathname;const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(p==='/api/session')return json({user:{id:1,role,display_name:'SHE Executive',username:'executive',features:['patrol','red-tag','red-tag-pic','reporting']},csrf_token:'test'});
   if(p.endsWith('/statistics')){requests.push(url.href);const d=structuredClone(fixture[p.startsWith('/api/patrols')?'patrol':p.startsWith('/api/red-tags')?'red':'environment']);if(dense){const entries=Array.from({length:12},(_,i)=>({label:'Production area with a long section or topic name '+(i+1),count:12-i}));for(const key of ['sections','categories'])if(d[key])d[key]=entries;}d.selection.label=url.searchParams.get('period')==='year'?'2026':'October 2026';d.selection.mode=url.searchParams.get('period')||'month';if(empty){d.summary={total:0,to_do:0,awaiting_review:0,completed:0,outstanding:0,completion_rate:null};d.backlog={...d.summary};for(const key of ['statuses','sections','ranks','stops','categories','plants','locations','work_orders'])if(d[key])d[key]=[];d.pic_workload=[];d.unassigned=0;d.trend.points.forEach(x=>x.count=0);}return json(d);}
   if(p==='/api/patrols')return json({patrols:[]});
   if(p==='/api/red-tags/settings')return json({revision:1,sections:[{name:'FG Store',pics:['Fareez']}],assignments:[],accounts:[]});
   if(p==='/api/red-tags')return json({findings:[]});
   if(p.startsWith('/api/'))return json({forms:[],patrols:[],configured:false,plants:[]});
   const name=p==='/'?'index.html':p.slice(1),file=name.startsWith('brand/')||name.startsWith('icons/')?'public/'+name:name;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});const ext=file.split('.').pop();return route.fulfill({contentType:{html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png'}[ext]||'text/plain',body:fs.readFileSync(file)});
 });
 await page.goto('https://she.test/#/dashboard');await page.locator('.she-summary-values').first().waitFor();assert.equal(await page.locator('.she-summary-card').count(),3);assert.equal(await page.locator('.she-charts-grid').count(),0);
 assert.equal(await page.locator('#dashboardSubnav').getAttribute('aria-hidden'),'false');assert.equal(await page.locator('#dashboardSubnav a').count(),4);await page.locator('#dashboardToggle').click();assert.equal(await page.locator('#dashboardSubnav').getAttribute('aria-hidden'),'true');await page.locator('.nav-parent a[href="#/dashboard"]').click();assert.equal(await page.locator('#dashboardSubnav').getAttribute('aria-hidden'),'false');assert.equal(await page.locator('.sidebar-note').count(),0);await page.locator('.nav-parent a[href="#/safety"]').click();await page.locator('#content h1').filter({hasText:/^Safety$/}).waitFor();assert.equal(await page.locator('#safetySubnav').getAttribute('aria-hidden'),'false');await page.locator('.nav-parent a[href="#/environmental"]').click();await page.locator('#content h1').filter({hasText:/^Environmental$/}).waitFor();assert.equal(await page.locator('#environmentSubnav').getAttribute('aria-hidden'),'false');await page.locator('.nav-parent a[href="#/dashboard"]').click();await page.locator('.she-summary-values').first().waitFor();
 await page.waitForTimeout(400);await page.screenshot({path:'.qa-temp/statistics-main.png',fullPage:true});
 await page.goto('https://she.test/#/red-tag-dashboard');await page.getByRole('heading',{name:'Status distribution',exact:true}).waitFor();assert.equal(await page.locator('.she-chart-card').count(),6);assert.equal(await page.locator('.she-metric').first().innerText().then(x=>x.includes('28')),true);assert.equal(await page.locator('.she-chart-legend').count(),2);
 await page.locator('[data-stat-period]').selectOption('year');await page.waitForFunction(()=>document.querySelector('.she-stat-period')?.textContent.includes('2026'));assert(requests.some(x=>x.includes('period=year')));assert.equal(await page.locator('[data-stat-month]').getAttribute('type'),'number');await page.locator('[data-stat-period]').selectOption('month');
 await page.waitForTimeout(400);await page.screenshot({path:'.qa-temp/statistics-redtag.png',fullPage:true});
 await page.goto('https://she.test/#/patrol-dashboard');await page.getByRole('tab',{name:'Inspection quality',exact:true}).click();await page.getByRole('heading',{name:'Checklist results',exact:true}).waitFor();assert.equal(await page.locator('.she-chart-card').count(),7);assert.equal(await page.locator('.she-metric').first().innerText().then(x=>x.includes('20')),true);await page.waitForTimeout(400);await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.screenshot({path:'.qa-temp/statistics-patrol.png',fullPage:true});
 await page.goto('https://she.test/#/red-tag');await page.locator('#genbaNew').waitFor();assert.equal(await page.locator('.she-statistics').count(),0);await page.goto('https://she.test/#/patrol-overview');await page.locator('.patrol-history').waitFor();assert.equal(await page.locator('.patrol-analytics,.patrol-metrics').count(),0);
 await page.goto('https://she.test/#/environment-dashboard');await page.getByRole('heading',{name:'Reports by topic',exact:true}).waitFor();assert.equal(await page.locator('.she-chart-card').count(),6);await page.locator('[data-stat-group]').selectOption('kaizen');await page.waitForTimeout(100);assert(requests.some(x=>x.includes('group=kaizen')));await page.locator('[data-stat-group]').selectOption('environment');
 await page.waitForTimeout(400);await page.screenshot({path:'.qa-temp/statistics-environment.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.qa-temp/statistics-environment-mobile.png',fullPage:true});
 empty=true;await page.locator('[data-stat-refresh]').click();await page.locator('.she-chart-empty').first().waitFor();assert.equal(await page.locator('.she-chart-card svg').count(),0);assert.equal(await page.locator('.she-metric').nth(3).innerText().then(x=>x.includes('—')),true);
 await page.emulateMedia({media:'screen'});empty=false;
 dense=true;
 for(const size of [{width:1366,height:768},{width:1440,height:900}]){
   await page.setViewportSize(size);
   for(const route of ['dashboard','patrol-dashboard','red-tag-dashboard','environment-dashboard']){
     await page.goto('https://she.test/#/'+route);
     await page.locator(route==='dashboard'?'.she-summary-values':'.she-chart-tabs').first().waitFor();
     if(route!=='dashboard'){
       await page.getByRole('tab',{name:'Overview',exact:true}).click();
       assert.equal(await page.locator('[role=tabpanel]:visible .she-chart-card').count(),3);
       const tabs=page.getByRole('tab');await tabs.nth(1).click();assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
       await page.locator('[data-stat-refresh]').click();await page.locator('[role=tabpanel]:visible .she-chart-card').first().waitFor();assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
       await page.getByRole('tab',{name:'Overview',exact:true}).click();
     }
     await page.waitForTimeout(100);
     const layout=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,screenHeight:innerHeight,screenWidth:innerWidth}));
     assert(layout.height<=size.height+2,route+' at '+size.width+'x'+size.height+' is '+layout.height+'px tall');assert(layout.width<=size.width);
     await page.screenshot({path:'.qa-temp/compact-'+route+'-'+size.width+'.png',fullPage:true});
   }
 }
 role='user';const count=requests.length;await page.goto('https://she.test/?role=user#/dashboard');await page.getByRole('heading',{name:'One dashboard. Three areas.',exact:true}).waitFor();assert.equal(await page.locator('.she-summary-card').count(),0);assert.equal(await page.locator('#dashboardSubnav a').count(),1);await page.goto('https://she.test/#/patrol-dashboard');await page.waitForTimeout(100);assert(!page.url().includes('#/patrol-dashboard'));await page.goto('https://she.test/#/red-tag');await page.locator('#genbaNew').waitFor();assert.equal(await page.locator('#genbaStatistics').count(),0);await page.goto('https://she.test/#/environmental');await page.locator('#content h1').filter({hasText:/^Environmental$/}).waitFor();assert.equal(await page.locator('.she-statistics').count(),0);assert.equal(requests.length,count);assert.deepEqual(errors,[]);
 console.log('Dashboard dropdown, dedicated Patrol/Red Tag/Environmental pages, and statistics browser checks passed: Executive summaries and charts, filters, empty states, phone layout, and no statistics requests from regular accounts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
