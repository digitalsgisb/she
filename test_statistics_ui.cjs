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
   if(p==='/api/session')return json({user:{id:1,role,display_name:'SHE Executive',username:'executive',features:['patrol','red-tag','red-tag-pic','reporting','health']},csrf_token:'test'});
   if(p==='/api/she-monitoring/accident'||p==='/api/she-monitoring/compound')return json({total:0,reported_months:0,categories:[p.endsWith('/compound')?'Compound':'Maintenance'],months:Array.from({length:12},(_,i)=>({month:'2026-'+String(i+1).padStart(2,'0'),total:null,complete:false,payload:{counts:{}}}))});
   if(p.endsWith('/statistics/records')){
     requests.push(url.href);const kind=p.startsWith('/api/patrols')?'patrol':p.startsWith('/api/red-tags')?'red-tag':'environment',values=JSON.parse(url.searchParams.get('values')||'[]');
     const r={id:1,reference:kind==='red-tag'?'RT2610-001':'Test record #1',title:'Packing line',date:'2026-10-13',status:values[0]||'Open',section:'FG Store',pic:'Fareez',inspector:'Sara',plant:'Port Klang',location:'Production',description:'Damaged guard',photo_url:kind==='red-tag'?'/api/red-tags/1/photo':null,matched_count:1,detail_url:kind==='red-tag'?'/#/red-tag/1':kind==='patrol'?'/#/daily-safety-patrol/1':'/#/reporting-inbox/1'};
     if(kind==='environment')Object.assign(r,{order_id:'WO-1',order_plant:'port-klang'});
     return json({kind,selection:{label:'October 2026'},field:url.searchParams.get('field')||'',values,exclude:url.searchParams.has('exclude'),total:1,page:1,pages:1,page_size:25,matched_items:1,records:[r]});
   }
   if(p==='/api/red-tags/1')return json({finding:{id:1,red_tag_id:'RT2610-001',finding_date:'2026-10-13',section:'FG Store',pic:'Fareez',machine:'Packing line',hazard:'Damaged guard',rank:'A',type_of_stop:'Immediate stop',recommendation:'Repair guard',issued_by:'SHE',user_id:1,assigned_user_id:3,status:'Open',revision:1},updates:[]});
   if(p==='/api/cmms/work-orders/WO-1')return json({attachments:[{kind:'completion',url:'/uploads/work-orders/WO-1/after.png'}]});
   if(p.endsWith('/photo')||p==='/api/cmms/media/WO-1/after.png')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
   if(p.endsWith('/statistics')){requests.push(url.href);const d=structuredClone(fixture[p.startsWith('/api/patrols')?'patrol':p.startsWith('/api/red-tags')?'red':'environment']);if(dense){const entries=Array.from({length:12},(_,i)=>({label:'Production area with a long section or topic name '+(i+1),count:12-i}));for(const key of ['sections','categories'])if(d[key])d[key]=entries;}d.selection.label=url.searchParams.get('period')==='year'?'2026':'October 2026';d.selection.mode=url.searchParams.get('period')||'month';if(empty){d.summary={total:0,to_do:0,awaiting_review:0,completed:0,outstanding:0,completion_rate:null};d.backlog={...d.summary};for(const key of ['statuses','sections','ranks','stops','categories','plants','locations','work_orders'])if(d[key])d[key]=[];d.pic_workload=[];d.unassigned=0;d.trend.points.forEach(x=>x.count=0);}return json(d);}
   if(p==='/api/patrols')return json({patrols:[]});
   if(p==='/api/red-tags/settings')return json({revision:1,sections:[{name:'FG Store',pics:['Fareez']}],assignments:[],accounts:[]});
   if(p==='/api/red-tags')return json({findings:[]});
   if(p.startsWith('/api/'))return json({forms:[],patrols:[],configured:false,plants:[]});
   const name=p==='/'?'index.html':p.slice(1),file=name.startsWith('brand/')||name.startsWith('icons/')?'public/'+name:name;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});const ext=file.split('.').pop();return route.fulfill({contentType:{html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png'}[ext]||'text/plain',body:fs.readFileSync(file)});
 });

 await page.goto('https://she.test/#/dashboard');
 await page.getByRole('heading',{name:'Monthly accident statistic',exact:true}).waitFor();
 await page.getByRole('heading',{name:'Monthly register',exact:true}).waitFor();
 assert.deepEqual(await page.locator('#dashboardSubnav a').allTextContents(),['Dashboard','SHE Summary']);
 assert.deepEqual(await page.locator('.dashboard-area-tabs a').allTextContents(),['Safety','Health','Environment']);
 assert.equal(await page.locator('#monitorForm').count(),0);
 await page.getByRole('link',{name:'Update accident data'}).click();
 await page.getByRole('heading',{name:'Accident Register',exact:true}).waitFor();
 await page.locator('#accidentMonth').selectOption('2026-03');
 await page.getByRole('heading',{name:'Update Mar 2026',exact:true}).waitFor();
 await page.getByRole('link',{name:'View dashboard'}).click();
 await page.locator('#dashboardSubnav a[href="#/she-summary"]').click();
 await page.locator('.she-overview-card').first().waitFor();
 assert.equal(await page.locator('.she-overview-card').count(),6);
 await page.goto('https://she.test/#/patrol-dashboard');await page.locator('.she-patrol-sections').waitFor();assert.equal(await page.locator('[data-dashboard-module]').inputValue(),'patrol-dashboard');
 await page.locator('[data-dashboard-module]').selectOption('red-tag-dashboard');await page.getByRole('heading',{name:'Status distribution',exact:true}).waitFor();
 await page.locator('[data-stat-period]').selectOption('year');await page.waitForFunction(()=>document.querySelector('.she-stat-period')?.textContent.includes('2026'));assert(requests.some(x=>x.includes('period=year')));
 await page.getByRole('tab',{name:'Overview table'}).click();await page.locator('[data-stat-panel=records] .she-record-table').waitFor();await page.getByRole('tab',{name:'Overview',exact:true}).click();
 await page.locator('[data-stat-refresh]').click();await page.waitForTimeout(150);assert.deepEqual(errors,[]);
 await page.waitForTimeout(350);await page.screenshot({path:'.qa-temp/area-safety-dashboard.png',fullPage:true});
 await page.locator('.she-chart-legend li.she-chart-hit').first().click();await page.locator('.she-record-table tbody tr').waitFor();assert(page.url().includes('field=status'));await page.locator('[data-evidence-before] img').waitFor();await page.waitForFunction(()=>document.querySelector('[data-evidence-before] img').naturalWidth>0);
 assert((await page.locator('.she-record-table tbody tr').textContent()).includes('Damaged guard'));
 await page.waitForTimeout(350);await page.screenshot({path:'.qa-temp/area-record-table.png',fullPage:true});
 await page.locator('.she-record-table tbody th a').click();await page.locator('#modalTitle').filter({hasText:'RT2610-001'}).waitFor();await page.locator('#modalClose').click();
 await page.goto('https://she.test/#/red-tag-dashboard');await page.getByRole('tab',{name:'Rank & stop type'}).click();await page.locator('[data-stat-refresh]').click();await page.waitForTimeout(100);assert.equal(await page.getByRole('tab',{name:'Rank & stop type'}).getAttribute('aria-selected'),'true');
 await page.locator('.dashboard-area-tabs a[href="#/health-dashboard"]').click();await page.getByRole('heading',{name:'Health Dashboard'}).waitFor();assert((await page.locator('.category-empty').textContent()).includes('No health modules'));
 await page.locator('.dashboard-area-tabs a[href="#/environment-dashboard"]').click();
 await page.getByRole('heading',{name:'Overview table',exact:true}).waitFor();
 assert.equal(await page.locator('[data-stat-group] option[value="environment"]').textContent(),'Green Eyes');
 assert.deepEqual(await page.locator('[data-dashboard-module] option').evaluateAll(options=>options.map(option=>option.value)),['environment-dashboard','co2-dashboard']);
 assert.equal(await page.locator('.she-chart-tabs').count(),0);
 assert.equal(await page.locator('[data-stat-panel=categories] button.she-column').count(),4);
 assert.equal(await page.locator('[data-stat-panel=monthly] .she-column').count(),12);
 assert.equal(await page.locator('[data-stat-panel=monthly] .she-column-track > span').count(),2);
 const heights=await page.locator('[data-stat-panel=overview] > .she-chart-card').evaluateAll(cards=>cards.map(card=>card.getBoundingClientRect().height));
 assert.equal(heights.length,3);assert.equal(new Set(heights).size,1);
 const afterPhoto=page.locator('[data-stat-panel=records] img[alt="Work order follow-up photo"]');
 await afterPhoto.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-stat-panel=records] img[alt="Work order follow-up photo"]')?.naturalWidth>0);
 await page.locator('[data-stat-group]').selectOption('kaizen');await page.waitForTimeout(100);assert(requests.some(x=>x.includes('group=kaizen')));
 await page.locator('.she-chart-legend li.she-chart-hit').first().click();await page.locator('.dashboard-records-page .she-record-table tbody tr').waitFor();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.waitForTimeout(350);await page.screenshot({path:'.qa-temp/area-record-cards-mobile.png',fullPage:true});
 await page.goto('https://she.test/#/patrol-dashboard');await page.getByRole('heading',{name:'Inspection quality',exact:true}).waitFor();assert.equal(await page.locator('.she-chart-tabs').count(),0);await page.locator('.she-patrol-sections .she-record-table').waitFor();await page.locator('[data-stat-panel=quality] .she-chart-legend li.she-chart-hit').first().focus();await page.keyboard.press('Enter');await page.locator('.dashboard-records-page .she-record-table tbody tr').waitFor();assert(page.url().includes('field=answer'));assert((await page.locator('[data-evidence-before]').textContent()).includes('No photo'));await page.locator('.back-link').click();await page.getByRole('heading',{name:'Inspection quality',exact:true}).waitFor();assert(await page.getByRole('heading',{name:'Inspectors & checklists',exact:true}).isVisible());
 await page.setViewportSize({width:1440,height:900});
 await page.goto('https://she.test/#/environmental');
 await page.locator('.module-card[href="#/environmental-enforcement-register"]').click();
 await page.getByRole('heading',{name:'Environmental Enforcement Register',exact:true}).waitFor();
 await page.locator('#monitorForm').waitFor();
 assert.equal(await page.locator('.dashboard-area-tabs,.monitor-month-chart').count(),0);
 assert(await page.locator('#environmentSubnav a[href="#/environmental-inspection-register"]').isVisible());
 role='user';const count=requests.length;await page.goto('https://she.test/?role=user#/dashboard');await page.waitForURL(url=>!url.hash.includes('dashboard'));assert.equal(await page.locator('.she-summary-card').count(),0);await page.goto('https://she.test/#/safety-dashboard');await page.waitForTimeout(150);assert(!page.url().includes('#/safety-dashboard'));assert.equal(requests.length,count);assert.deepEqual(errors,[]);
 console.log('Area dashboard and evidence table checks passed: module selection, header filters, record details, keyboard activation, remembered tabs, phone layout and access controls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
