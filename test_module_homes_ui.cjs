const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.SHE_QA_PLAYWRIGHT||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SHE_QA_BROWSER});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
  const hiyari={id:9,revision:1,title:'Hiyari Hatto',group:'hiyari-hatto',workflow:'she',icon:'alert',questions:[]};
  const air={id:11,revision:1,title:'Air Leak',group:'air-leak',workflow:'maintenance',questions:[]};
  const template={id:0,is_default:true,revision:1,user_id:null,...JSON.parse(fs.readFileSync('patrol-default.json','utf8'))};
  let delay=true;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname,json=v=>route.fulfill({contentType:'application/json',body:JSON.stringify(v)});
   if(path==='/api/session')return json({user:{id:1,role:'executive',display_name:'SHE Executive'},csrf_token:'test'});
   if(path.startsWith('/api/workspace/modules/')){
    const kind=path.split('/').pop(),title=kind==='red-tag'?'RT-202611-006':kind==='air-leak'?'Air Leak':'Hiyari Hatto';
    return json({counts:{active:3,today:1,history:8,review:1},active:[{id:6,red_tag_id:title,section:'Production',machine:'Packing line',pic:'Sara',status:'Open',hazard:'Guard needs action'}],recent:[{id:6,title,detail:'Production · Packing line',reporter:'Sara',status:'open',status_label:'Open',created_at:1793850000,href:kind==='red-tag'?'#/red-tag/6':'#/reporting-inbox/6'}]});
   }
   if(path==='/api/patrols/summary')return json({scope:'team',date:'2026-11-05',counts:{today:0,month:0,open:0,awaiting_review:0},week:[],recent:[]});
   if(path==='/api/patrol-templates'){if(delay)await new Promise(r=>setTimeout(r,250));return json({templates:[template]});}
   if(path==='/api/patrols')return json({patrols:[]});
   if(path==='/api/red-tags/settings')return json({sections:[{name:'Production',pics:['Sara']}],assignments:[],accounts:[],revision:1});
   if(path==='/api/red-tags'){if(delay)await new Promise(r=>setTimeout(r,250));return json({findings:[]});}
   if(path==='/api/reporting/public')return json({forms:[hiyari],token:'test-token'});
   if(path==='/api/reporting/reports')return json({reports:[]});
   if(path==='/api/reporting/air-leak'){if(delay)await new Promise(r=>setTimeout(r,250));return json({form:air,token:'test-token',reports:[]});}
   if(path==='/api/reporting/notifications')return json({unread:0,latest_id:0,reports:[],push:{enabled:false}});
   if(path.startsWith('/api/'))return json({configured:false,counts:{reports:0,genba:0,patrols:0},recent:[],forms:[],reports:[]});
   let file=path==='/'?'index.html':path.slice(1);if(/^(brand|icons)\//.test(file))file='public/'+file;
   if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({body:fs.readFileSync(file),contentType:({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml'})[file.split('.').pop()]||'text/plain'});
  });
  const checkIndicator=async()=>{
   const gap=await page.locator('.module-tabs').evaluate(nav=>{const a=nav.querySelector('a[aria-current]'),line=nav.querySelector('.module-tab-indicator');return Math.abs(a.getBoundingClientRect().left-line.getBoundingClientRect().left)+Math.abs(a.offsetWidth-line.getBoundingClientRect().width);});
   assert(gap<2,`Indicator is misaligned by ${gap}px`);
  };
  await page.goto('https://she.test/#/patrol-home');await page.locator('[data-patrol-count=today]').filter({hasText:'0'}).waitFor();
  assert.deepEqual(await page.locator('#mobileTabbar .mobile-tab span').allTextContents(),['Home','Patrol','Red Tag','Orders','More']);
  assert.equal(await page.locator('#mobileTabbar a[href="#/red-tag-home"]').count(),1);
  await page.evaluate(()=>{
   window.tabs=document.querySelector('.module-tabs');window.line=window.tabs.querySelector('.module-tab-indicator');window.fromX=window.line.getBoundingClientRect().left;
   const observer=new MutationObserver(()=>{
    const animation=window.line.getAnimations().find(a=>a.transitionProperty==='transform');
    if(!animation)return;
    animation.pause();animation.currentTime=Number(animation.effect.getTiming().duration)/2;
    const nav=document.querySelector('.module-tabs'),left=window.line.getBoundingClientRect().left,target=nav.querySelector('[aria-current]').getBoundingClientRect().left;
    window.indicatorMoving=window.tabs===nav&&window.line===nav.querySelector('.module-tab-indicator')&&left>window.fromX&&left<target;
    window.indicatorAnimation=animation;observer.disconnect();
   });
   observer.observe(window.line,{attributes:true,attributeFilter:['style']});
  });
  await page.locator('.module-tabs a[href="#/patrol-overview"]').click();
  await page.waitForFunction(()=>window.indicatorMoving!==undefined);
  const moving=await page.evaluate(()=>{window.indicatorAnimation.finish();return window.indicatorMoving;});
  assert(moving,'Underline should travel between tabs, using the same indicator element');
  await page.waitForTimeout(350);await checkIndicator();
  for(const [home,module] of [['red-tag-home','red-tag'],['hiyari-home','hiyari-hatto'],['air-leak-home','air-leak']]){
   await page.goto('https://she.test/#/'+home);await page.locator('[data-module-count=active]').filter({hasText:'3'}).waitFor();
   assert.equal(await page.locator(module==='red-tag'?'[data-genba-id]':'.module-home-record').count(),1);
   await page.evaluate(()=>window.moduleTabs=document.querySelector('.module-tabs'));
   for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:844});await page.waitForTimeout(350);await checkIndicator();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${home} overflows at ${width}`);
    if(width===390)await page.screenshot({path:`.qa-temp/${home}-mobile.png`,fullPage:true});
   }
   await page.setViewportSize({width:390,height:844});
   if(module!=='red-tag'){
   await page.locator(`.module-tabs a[href="#/${module}?view=active"]`).click();
   await page.waitForTimeout(400);
   assert(await page.evaluate(()=>window.moduleTabs===document.querySelector('.module-tabs')));
   assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'Current Active');await checkIndicator();
   }
   await page.locator(`.module-tabs a[href="#/${module}?view=history"]`).click();await page.waitForTimeout(400);
   assert(await page.evaluate(()=>window.moduleTabs===document.querySelector('.module-tabs')));
   assert.equal(await page.locator('.module-tabs [aria-current]').textContent(),'History');await checkIndicator();
  }
  await page.goto('https://she.test/#/red-tag-home');await page.locator('[data-module-count=active]').filter({hasText:'3'}).waitFor();
  await page.locator('.patrol-home-hero a').click();await page.locator('#genbaForm').waitFor();await page.locator('#modalClose').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  assert(await page.locator('.module-tab-indicator').evaluate(el=>{const s=getComputedStyle(el);return s.transitionProperty==='none'||parseFloat(s.transitionDuration)<=0.001;}));
  assert.deepEqual(errors,[]);
  console.log('Module homes passed: sliding indicator in motion, resize alignment, bottom Red Tag, three responsive homes, stable active/history tabs, direct new finding, reduced motion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
