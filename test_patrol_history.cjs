const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const context = vm.createContext({
  console, setInterval:()=>{}, window:{addEventListener:()=>{}},
  localStorage:{getItem:()=>null}, document:{addEventListener:()=>{}},
  content:{addEventListener:()=>{}}, escapeHtml:s=>String(s), icon:()=>''
});
vm.runInContext(fs.readFileSync('patrol.js','utf8'), context);
const rows = Array.from({length:25},(_,i)=>({id:i+1,inspector_name:i%2 ? 'Sara':'Aman',
  submitted_by:'Reviewer',title:'Daily checklist',created_at:1791330000+i*60,
  counts:{not_ok:i%3===0 ? 2:0},followup_status:i%2 ? 'resolved':'open',
  attachments:[],update_count:0,remarks:''}));
context.rows = rows;
let markup = vm.runInContext('patrolDailyReportMarkup(rows)',context);
assert.equal((markup.match(/<article /g)||[]).length,10);
assert(markup.includes('1–10 of 25 patrols'));
assert(markup.indexOf('#25') < markup.indexOf('#24'));
markup = vm.runInContext('patrolView.page=2; patrolDailyReportMarkup(rows)',context);
assert.equal((markup.match(/<article /g)||[]).length,5);
assert(markup.includes('21–25 of 25 patrols'));
markup = vm.runInContext("patrolView.search='Sara'; patrolDailyReportMarkup(rows)",context);
assert(markup.includes('11–12 of 12 patrols')); // Out-of-range page clamps.
markup = vm.runInContext("patrolView.page=0; patrolView.status='open'; patrolDailyReportMarkup(rows)",context);
assert(markup.includes('0 patrols'));
markup = vm.runInContext("patrolView.search=''; patrolView.findingsOnly=true; patrolDailyReportMarkup(rows)",context);
assert.equal((markup.match(/<article /g)||[]).length,5);
assert(!markup.includes('All clear'));
assert(markup.includes('Follow-up: Open'));
console.log('Patrol history sorting, pagination, combined filters and empty states passed.');
