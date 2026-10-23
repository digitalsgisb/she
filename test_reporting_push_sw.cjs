const fs=require('fs'),vm=require('vm'),assert=require('assert');
(async()=>{
 const handlers={},shown=[],opened=[];
 const worker={location:{origin:'https://she.test'},addEventListener:(name,fn)=>handlers[name]=fn,
  registration:{showNotification:async(title,options)=>shown.push({title,...options})},
  clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(fs.readFileSync('reporting-push-sw.js','utf8'),{self:worker,URL});
 let task;
 handlers.push({data:{json:()=>({report_id:42,body:'New report',tag:'she-report-42'})},waitUntil:promise=>task=promise});
 await task;assert.equal(shown[0].data.url,'/#/reporting-inbox/42');
 let closed=false;
 handlers.notificationclick({notification:{data:shown[0].data,close:()=>closed=true},waitUntil:promise=>task=promise});
 await task;assert(closed);assert.equal(opened[0],'https://she.test/#/reporting-inbox/42');
 handlers.notificationclick({notification:{data:{url:'https://evil.test'},close:()=>{}},waitUntil:promise=>task=promise});
 await task;assert.equal(opened[1],'https://she.test/#/reporting-inbox');
 console.log('Phone notification payload, report destination and safe click navigation passed.');
})().catch(error=>{console.error(error);process.exit(1);});
