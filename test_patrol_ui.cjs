const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const template = {id:0,is_default:true,user_id:null,revision:1,...JSON.parse(fs.readFileSync('patrol-default.json','utf8'))};
const nodes = {};
const handlers = {};
let route = 'daily-safety-patrol';
let saved;
const content = {innerHTML:'',addEventListener(type,callback) { (handlers[type] ||= []).push(callback); }};
const context = vm.createContext({content,structuredClone,console,
  currentUser:{id:1,role:'executive'},location:{hash:'#/daily-safety-patrol'},
  currentRoute:()=>route,icon:()=>'',escapeHtml:v=>String(v),
  localStorage:{getItem:()=>null},setInterval:()=>{},window:{addEventListener:()=>{}},
  document:{addEventListener:()=>{},getElementById:id=>nodes[id] ||= {innerHTML:'',value:id==='checklistTitle' ? template.title : '',hidden:true}},
  api:async (path,method,payload)=>{if(!method) return {templates:[template]}; saved={path,method,payload};return {id:0};},notify:()=>{}
});
vm.runInContext(fs.readFileSync('patrol.js','utf8'),context);
(async()=>{
  await vm.runInContext('renderPatrolForm()',context);
  assert(content.innerHTML.includes('href="#/checklist-builder/0"'));
  assert(content.innerHTML.includes(template.questions[0].label));
  assert.equal((content.innerHTML.match(/data-item-remark=/g) || []).length,23);
  const detail = vm.runInContext(`customPatrolQuestions(${JSON.stringify(template)}, {}, [], 1, {q_general_0:'Pallets at walkway'})`, context);
  assert(detail.includes('Pallets at walkway'));
  assert(!detail.includes('data-item-remark='));
  assert(!vm.runInContext('patrolItemRemark("q_general_0", "Housekeeping", {})',context));
  let storedDraft;
  const remarkInput = {dataset:{itemRemark:'q_general_0'},value:'Check again after lunch'};
  const fields = {remark_q_general_0:remarkInput, q_general_0:{value:'not_ok'}};
  const form = {querySelectorAll:()=>[remarkInput], querySelector:()=>null,
    elements:{remarks:{value:''},namedItem:key=>fields[key] ||= {value:''}}};
  nodes.patrolForm = form;
  context.FormData = function() { this.get = key=>key==='q_general_0' ? 'not_ok' : ''; };
  context.localStorage.setItem = (_,value)=>{storedDraft=value;};
  context.localStorage.getItem = ()=>storedDraft || null;
  vm.runInContext('savePatrolDraft()',context);
  assert.equal(JSON.parse(storedDraft).item_remarks.q_general_0,'Check again after lunch');
  remarkInput.value='';
  vm.runInContext('restorePatrolDraft()',context);
  assert.equal(remarkInput.value,'Check again after lunch');
  context.localStorage.getItem=()=>null;
  context.currentUser.role='user';
  await vm.runInContext('renderPatrolForm()',context);
  assert(!content.innerHTML.includes('href="#/checklist-builder/0"'));
  context.currentUser.role='executive';route='checklist-builder';context.location.hash='#/checklist-builder/0';
  await vm.runInContext('renderChecklistBuilder()',context);
  assert(content.innerHTML.includes('Edit checklist'));
  assert(nodes.builderQuestions.innerHTML.includes('Question 23'));
  assert(nodes.builderItemJump.innerHTML.includes(template.questions[0].label));
  vm.runInContext('initPatrolEvents()',context);
  await handlers.submit[0]({preventDefault(){},target:{id:'checklistBuilder',querySelector:()=>({disabled:false})}});
  assert.equal(saved.path,'/api/patrol-templates/0');
  assert.equal(saved.method,'PATCH');
  assert.equal(saved.payload.questions.length,23);
  console.log('Default checklist UI and save flow passed for executive and user roles.');
})().catch(e=>{console.error(e);process.exitCode=1;});
